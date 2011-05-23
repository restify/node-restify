// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var assert = require('assert');
var crypto = require('crypto');
var util = require('util');
var http = require('http');
var path = require('path');
var querystring = require('querystring');
var url = require('url');

var uuid = require('node-uuid');

var Constants = require('./constants');
var HttpCodes = require('./http_codes');
var RestCodes = require('./rest_codes');
var log = require('./log');
var newError = require('./error').newError;

// Just force this to extend http.ServerResponse
require('./http_extra');



// --- Internal Helpers

/**
 * Cleans up sloppy URL paths, like /foo////bar/// to /foo/bar.
 *
 * @param {String} path the HTTP resource path.
 * @return {String} Cleaned up form of path.
 */
function _sanitizePath(path) {
  assert.ok(path);

  if (log.trace())
    log.trace('_sanitizePath: path=%s', path);

  // Be nice like apache and strip out any //my//foo//bar///blah
  var _path = path.replace(/\/\/+/g, '/');

  // Kill a trailing '/'
  if (_path.lastIndexOf('/') === (_path.length - 1) &&
     _path.length > 1) {
    _path = _path.substr(0, _path.length - 1);
  }

  if (log.trace())
    log.trace('_sanitizePath: returning %s', _path);

  return _path;
}


/**
 * Checks if a mount matches, and if so, returns an object with all
 * the :param variables.
 *
 * @param {String} path (request.url.pathname).
 * @param {Object} route (what was mounted).
 */
function _matches(path, route) {
  assert.ok(path);
  assert.ok(route);

  if (path === route.url) return {}; // there were no params in this case...

  var params = route.urlComponents;
  var components = path.split('/').splice(1);
  var len = components.length;

  if (components.length !== params.length) return null;

  var parsed = {};
  for (var i = 0; i < params.length; i++) {
    var _url = url.parse(components[i]);
    if (params[i] === _url.pathname) continue;
    if (params[i].charAt(0) === ':') {
      parsed[params[i].substr(1)] = _url.pathname;
      continue;
    }
    return null;
  }

  return parsed;
}


function _parseAccept(request, response) {
  response._accept = Constants.ContentTypeJson;
  var tmpAccept = Constants.ContentTypeJson;

  if (request.headers.accept && request.headers.accept !== '*/*') {
    var _mediaRange = request.headers.accept.split(';');
    if (!_mediaRange) {
      response.sendError(newError({
        httpCode: HttpCodes.BadRequest,
        restCode: RestCodes.InvalidArgument,
        message: 'Accept header invalid: ' + request.headers.accept
      }));
      return false;
    }

    var _acceptTypes = _mediaRange[0].split('/');
    if (!_acceptTypes || _acceptTypes.length !== 2) {
      response.sendError(newError({
        httpCode: HttpCodes.BadRequest,
        restCode: RestCodes.InvalidArgument,
        message: 'Accept header invalid: ' + request.headers.accept
      }));
      return false;
    }

    if (_acceptTypes[0] !== '*') {
      var type = request._config._acceptable[_acceptTypes[0]];
      if (!type) {
        if (log.trace())
          log.trace('accept header type doesn\'t match application');

        response.sendError(newError({
          httpCode: HttpCodes.NotAcceptable,
          restCode: RestCodes.InvalidArgument,
          message: request.headers.accept + ' unsupported',
          details: request._config.acceptable
        }));
        return false;
      }
      tmpAccept = _acceptTypes[0] + '/';
    }

    if (_acceptTypes[1] !== '*') {
      var subType;
      var subTypes = request._config._acceptable[_acceptTypes[0]];
      if (subTypes) {
        for (var i = 0; i < subTypes.length; i++) {
          if (subTypes[i] === _acceptTypes[1]) {
            subType = subTypes[i];
            break;
          }
        }
      }

      if (!subType) {
        response.sendError(newError({
          httpCode: HttpCodes.NotAcceptable,
          restCode: RestCodes.InvalidArgument,
          message: request.headers.accept + ' unsupported',
          details: request._config.acceptable
        }));
        return false;
      }
      tmpAccept += subType;
    } else {
      tmpAccept = Constants.ContentTypeJson;
    }
  }

  response._accept = tmpAccept;
  if (log.trace())
    log.trace('Parsed accept type as: %s', response._accept);

  return true;
}


function _parseDate(request, response) {
  if (request.headers.date) {
    try {
      var date = new Date(request.headers.date);
      var now = new Date();

      if (log.trace())
        log.trace('Date: sent=%d, now=%d, allowed=%d',
                  date.getTime(), now.getTime(), request._config.clockSkew);

      if ((now.getTime() - date.getTime()) > request._config.clockSkew) {
        response.sendError(newError({
          httpCode: HttpCodes.BadRequest,
          restCode: RestCodes.InvalidArgument,
          message: 'Date header is too old'
        }));
        return false;
      }
    } catch (e) {
      if (log.trace())
        log.trace('Bad Date header: ' + e);
      response.sendError(newError({
        httpCode: HttpCodes.BadRequest,
        restCode: RestCodes.InvalidArgument,
        message: 'Date header is invalid'
      }));
      return false;
    }
  }

  return true;
}


function _parseContentType(request, response) {
  if (request.contentType() === 'multipart/form-data') {
    response.sendError(newError({
      httpCode: HttpCodes.UnsupportedMediaType,
      restCode: RestCodes.InvalidArgument,
      message: 'multipart/form-data unsupported'
    }));
    return false;
  }
  return request.contentType();
}


function _parseApiVersion(request, response) {
  if (request._config.apiVersion) {
    if (request.headers[Constants.XApiVersion] ||
        (request.headers[Constants.XApiVersion.toLowerCase()] !==
         request._config.apiVersion)) {
      response.sendError(newError({
        httpCode: HttpCodes.Conflict,
        restCode: RestCodes.InvalidArgument,
        message: Constants.XApiVersion + ' must be ' +
          request._config.apiVersion
      }));
    }
  }
  return true;
}


function _parseQueryString(request, response) {
  request._url = url.parse(request.url);
  if (request._url.query) {
    var _qs = querystring.parse(request._url.query);
    for (var k in _qs) {
      if (_qs.hasOwnProperty(k)) {
        assert.ok(!request.params[k]);
        request.params[k] = _qs[k];
      }
    }
  }
  return true;
}


/**
 * Fairly ugly and long method that does the brunt of the
 * work for setting up the processing chain.
 *
 * @param {Object} request node.js request.
 * @param {Object} response node.js response.
 * @param {Function} next the first call in the chain.
 *
 */
function _parseRequest(request, response, next) {
  assert.ok(request);
  assert.ok(response);
  assert.ok(next);

  if (log.trace()) {
    log.trace('_parseRequest:\n%s %s HTTP/%s\nHeaders: %o',
              request.method,
              request.url,
              request.httpVersion,
              request.headers);
  }

  if (!_parseAccept(request, response)) return;
  if (!_parseDate(request, response)) return;
  if (!_parseApiVersion(request, response)) return;
  if (!_parseQueryString(request, response)) return;

  var contentType = _parseContentType(request, response);
  if (!contentType) return;


  request.body = '';
  request.on('data', function(chunk) {
    if (request.body.length + chunk.length > request._config.maxRequestSize) {
      return response.sendError(newError({
        httpCode: HttpCodes.RequestTooLarge,
        restCode: RestCodes.RequestTooLarge,
        message: 'maximum HTTP data size is 8k'
      }));
    }
    request.body += chunk;
  });

  request.on('end', function() {
    if (request.body) {
      var contentLen = request.headers['content-length'];
      if (contentLen !== undefined) {
        if (parseInt(contentLen, 10) !== request.body.length) {
          return response.sendError(newError({
            httpCode: HttpCodes.BadRequest,
            restCode: RestCodes.InvalidHeader,
            message: 'Content-Length=' + contentLen +
              ' didn\'t match actual length=' + request.body.length
          }));
        }
      }
      var bParams;
      if (contentType === Constants.ContentTypeFormEncoded) {
        bParams = querystring.parse(request.body) || {};
      } else if (contentType === Constants.ContentTypeJson) {
        try {
          bParams = JSON.parse(request.body);
        } catch (e) {
          return response.sendError(newError({
            httpCode: HttpCodes.BadRequest,
            restCode: RestCodes.InvalidArgument,
            message: 'Invalid JSON: ' + e.message
          }));
        }
      } else if (contentType) {
        return response.sendError(newError({
          httpCode: HttpCodes.UnsupportedMediaType,
          restCode: RestCodes.InvalidArgument,
          message: contentType + ' unsupported'
        }));
      }

      for (var k in bParams) {
        if (bParams.hasOwnProperty(k)) {
          if (request.params.hasOwnProperty(k)) {
            return response.sendError(newError({
              httpCode: HttpCodes.Conflict,
              restCode: RestCodes.InvalidArgument,
              message: 'duplicate parameter detected: ' + k
            }));
          }
          request.params[k] = bParams[k];
        }
      }
    }

    if (log.trace())
      log.trace('_parseRequest: params parsed as: %o', request.params);

    return next();
  });

}



// --- Publicly available API

module.exports = {

  /**
   * Creates a new restify HTTP server.
   *
   * @param {Object} options a hash of configuration parameters:
   *                 - serverName: String to send back in the Server header.
   *                               Default: node.js.
   *                 - maxRequestSize: Max request size to allow, in bytes.
   *                               Default: 8192.
   *                 - accept: Array of valid MIME types to allow in Accept.
   *                               Default: application/json.
   *                 - clockSkew: If a Date header is present, allow N seconds
   *                              of skew.
   *                               Default: 300
   *                 - apiVersion: Default API version to support; setting this
   *                            means clients are required to send an
   *                            X-Api-Version header.
   *                               Default: None.
   *                 - logTo: a `Writable Stream` where log messages should go.
   *                               Default: process.stderr.
   *
   * @return {Object} node HTTP server, with restify "magic".
   */
  createServer: function(options) {

    var server = http.createServer(function(request, response) {
      assert.ok(request);
      assert.ok(response);

      _response = response;

      request.requestId = response.requestId = uuid().toLowerCase();
      request._config = server._config;
      response._config = server._config;
      request.startTime = response.startTime = new Date().getTime();
      response._allowedMethods = [];

      var route;
      var params;
      var i, k;
      var path = _sanitizePath(request.url);
      request.url = path;
      if (server.routes[request.method]) {
        var routes = server.routes[request.method];
        for (i = 0; i < routes.length; i++) {
          params = _matches(path, routes[i]);
          if (params) {
            route = routes[i];
            break;
          }
        }
      }

      if (route) {
        server.routes.urls[route.url].forEach(function(r) {
          response._allowedMethods.push(r.method);
        });

        if (!request.params) request.params = {};
        if (!request.uriParams) request.uriParams = {};

        for (k in params) {
          if (params.hasOwnProperty(k)) {
            assert.ok(!request.uriParams.hasOwnProperty(k));
            request.uriParams[k] = params[k];
          }
        }

        if (log.trace())
          log.trace('request uri parameters now: %o', request.uriParams);

        var _i = 0;
        _parseRequest(request, response, function() {
          var self = arguments.callee;
          if (route.handlers[_i]) {
            if (log.trace())
              log.trace('Running handler: %s:: %d', request.method, _i);

            return route.handlers[_i++].call(this, request, response, self);
          }
        });
      } else {
        // branch from if(route)
        // Try to send back a meaningful error code (e.g., method not supported
        // rather than just 404).
        // The only way we got here was if the method didn't match, so this
        // loop is solely to send back a 405 rather than a 404.  Sucks we have
        // to do an O(N^2) walk (I guess we could do a tree or something, but
        // bah, whatever, if you have that many urls...).
        var _allow = null;
        var _code = HttpCodes.NotFound;
        for (k in server.routes.urls) {
          if (server.routes.urls.hasOwnProperty(k)) {
            route = server.routes.urls[k];
            var _methods = [];

            for (i = 0; i < route.length; i++) {
              _methods.push(route[i].method);
              if (_matches(path, route[i])) {
                _code = HttpCodes.BadMethod;
              }
            }

            if (_code === HttpCodes.BadMethod) {
              response._allowedMethods = _methods;
              if (request.method === 'OPTIONS') {
                _code = HttpCodes.Ok;
                _allow = _methods.join(', ');
              }
              break;
            }
          }
        }

        if (_allow) {
          response.send(_code, null, { Allow: _allow });
        } else {
          if (request.method === 'OPTIONS')
            _code = HttpCodes.Ok;
          response.send(_code);
        }
      }
    });

    server.logLevel = function(level) {
      return log.level(level);
    };

    server.routes = {};
    server._config = {};

    server._config.apiVersion = null;

    var installedExceptionHandler = false;
    if (options) {

      if (options.apiVersion)
        server._config.apiVersion = options.apiVersion;

      if (options.serverName)
        server._config.serverName = options.serverName;

      if (options.exceptionHandler) {
        process.on('uncaughtException', options.exceptionHandler);
        installedExceptionHandler = true;
      }

      if (options.maxRequestSize)
        server._config.maxRequestSize = options.maxRequestSize;

      if (options.acceptable)
        server._config.acceptable = options.acceptable;

      if (options.accept)
        server._config.acceptable = options.accept;

      if (options.clockSkew)
        server._config.clockSkew = options.clockSkew * 1000;

      if (options.logTo)
        log.writeTo(options.logTo);

    }

    if (!server._config.serverName)
      server._config.serverName = Constants.DefaultServerName;

    if (!server._config.maxRequestSize)
      server._config.maxRequestSize = 8192;

    if (!server._config.clockSkew)
      server._config.clockSkew = 300 * 1000; // Default 5m

    if (!server._config.acceptable) {
      server._config.acceptable = [
        'application/json'
      ];
    }

    server._config._acceptable = {};
    for (var i = 0; i < server._config.acceptable.length; i++) {
      var tmp = server._config.acceptable[i].split('/');

      if (!server._config._acceptable[tmp[0]]) {
        server._config._acceptable[tmp[0]] = [tmp[1]];
      } else {
        var found = false;

        for (var j = 0; j < server._config._acceptable[tmp[0]].length; j++) {
          if (server._config._acceptable[tmp[0]][j] === tmp[1]) {
            found = true;
            break;
          }
        }

        if (!found) {
          server._config._acceptable[tmp[0]].push(tmp[1]);
        }
      }
    }

    if (log.trace())
      log.trace('server will accept types: %o', server._config.acceptable);

    return server;
  },

  LogLevel: log.Level,
  log: log,
  newError: newError,
  HttpCodes: HttpCodes,
  RestCodes: RestCodes

};
