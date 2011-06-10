// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var assert = require('assert');
var crypto = require('crypto');
var util = require('util');
var http = require('http');
var path = require('path');
var querystring = require('querystring');
var url = require('url');

var formidable = require('formidable');
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

  if (path === route.url)
    return {}; // there were no params in this case...

  if (route.regexRoute)
    return route.url.exec(path);

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
  response._accept = 'application/json';
  var accept = null;

  if (request.headers.accept && request.headers.accept !== '*/*') {
    var mediaRanges = request.headers.accept.split(',');
    for (var i = 0; i < mediaRanges.length; i++) {
      var types = mediaRanges[i].split(';')[0].split('/'); // throw away params
      if (!types || types.length !== 2) {
        response.sendError(newError({
          httpCode: HttpCodes.BadRequest,
          restCode: RestCodes.InvalidArgument,
          message: 'Accept header invalid: ' + request.headers.accept
        }));
        return false;
      }

      if (types[0] !== '*') {
        var subTypes = request._config._acceptable[types[0]];
        if (!subTypes)
          continue;
        accept = types[0] + '/';

        if (types[1] !== '*') {
          var subType = null;
          for (var j = 0; j < subTypes.length; j++) {
            if (subTypes[j] === types[1]) {
              subType = subTypes[i];
              break;
            }
          }
          if (subType) {
            accept += subType;
            break;
          }
        } else {
          // This is not technically correct, but for all intents and purposes,
          // it's good enough for now (but, for example text/* would be screwed
          // with this).
          accept = 'application/json';
          break;
        }
      } else {
        accept = 'application/json';
        break;
      }
      accept = null;
    }

    if (!accept) {
      response.sendError(newError({
        httpCode: HttpCodes.NotAcceptable,
        restCode: RestCodes.InvalidArgument,
        message: request.headers.accept + ' unsupported',
        details: request._config.acceptable
      }));
      return false;
    }

    response._accept = accept;
  }


  if (log.trace())
    log.trace('Parsed accept type as: %s', response._accept);

  return true;
}


function _parseAuthorization(req, res) {
  req.authorization = {};

  if (!req.headers.authorization) {
    log.trace('No authorization header present.');
    return true;
  }

  var pieces =  req.headers.authorization.split(' ', 2);
  if (!pieces || pieces.length !== 2) {
    res.sendError(newError({
      httpCode: HttpCodes.BadRequest,
      restCode: RestCodes.InvalidHeader,
      message: 'BasicAuth content is invalid.'
    }));
    return false;
  }

  req.authorization = {
    scheme: pieces[0],
    credentials: pieces[1]
  };

  if (pieces[0] === 'Basic') {
    var decoded = (new Buffer(pieces[1], 'base64')).toString('utf8');
    if (!decoded) {
      res.sendError(newError({
        httpCode: HttpCodes.BadRequest,
        restCode: RestCodes.InvalidHeader,
        message: 'Authorization: Basic content is invalid (not base64).'
      }));
      return false;
    }

    pieces = decoded !== null ? decoded.split(':', 2) : null;
    if (!(pieces !== null ? pieces[0] : null) ||
        !(pieces !== null ? pieces[1] : null)) {
      res.sendError(newError({
        httpCode: HttpCodes.BadRequest,
        restCode: RestCodes.InvalidHeader,
        message: 'Authorization: Basic content is invalid.'
      }));
      return false;
    }

    req.authorization.basic = {
      username: pieces[0],
      password: pieces[1]
    };
    req.username = pieces[0];
  } else {
    log.info('Unknown authorization scheme %s. Skipping processing',
             req.authorization.scheme);
  }

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
  return request.contentType();
}


function _parseApiVersion(request, response) {
  if (request.headers[Constants.XApiVersion] && request._serverVersioned) {
    request._apiVersion = request.headers[Constants.XApiVersion];
    response._apiVersion = request.headers[Constants.XApiVersion];
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


function _parseHead(request, response) {
  assert.ok(request);
  assert.ok(response);

  if (log.trace()) {
    log.trace('_parseHead:\n%s %s HTTP/%s\nHeaders: %o',
              request.method,
              request.url,
              request.httpVersion,
              request.headers);
  }

  if (!_parseAccept(request, response)) return false;
  if (!_parseAuthorization(request, response)) return false;
  if (!_parseDate(request, response)) return false;
  if (!_parseApiVersion(request, response)) return false;
  if (!_parseQueryString(request, response)) return false;
  if (!_parseContentType(request, response)) return false;

  return true;
}


function _parseRequest(request, response, next) {
  assert.ok(request);
  assert.ok(response);
  assert.ok(next);

  var contentType = request.contentType();
  if (contentType === 'multipart/form-data') {
    var form = formidable.IncomingForm();
    form.maxFieldsSize = request._config.maxRequestSize;

    form.on('error', function(err) {
      return response.sendError(newError({
        httpCode: HttpCodes.BadRequest,
        restCode: RestCodes.BadRequest,
        message: err.toString()
      }));
    });

    form.on('field', function(field, value) {
      log.trace('_parseRequest(multipart) field=%s, value=%s', field, value);
      request.params[field] = value;
    });

    form.on('end', function() {
      log.trace('_parseRequset(multipart): req.params=%o', request.params);
      return next();
    });
    form.parse(request);
  } else {
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
        log.trace('_parseRequest: req.body=%s', request.body);

        var contentLen = request.headers['content-length'];
        if (contentLen !== undefined) {
          var actualLen = Buffer.byteLength(request.body, 'utf8');
          if (parseInt(contentLen, 10) !== actualLen) {
            return response.sendError(newError({
              httpCode: HttpCodes.BadRequest,
              restCode: RestCodes.InvalidHeader,
              message: 'Content-Length=' + contentLen +
                ' didn\'t match actual length=' + actualLen
            }));
          }
        }

        var bParams;
        if (contentType === 'application/x-www-form-urlencoded') {
          bParams = querystring.parse(request.body) || {};
        } else if (contentType === 'application/json') {
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

      log.trace('_parseRequest: params parsed as: %o', request.params);
      return next();
    });
  }
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
   *                 - apiVersion: Default API version to support; setting this
   *                            means clients are required to send an
   *                            X-Api-Version header.
   *                               Default: None.
   *                 - clockSkew: If a Date header is present, allow N seconds
   *                              of skew.
   *                               Default: 300
   *                 - logTo: a `Writable Stream` where log messages should go.
   *                               Default: process.stderr.
   *
   * @return {Object} node HTTP server, with restify "magic".
   */
  createServer: function(options) {

    var server = http.createServer(function(request, response) {
      assert.ok(request);
      assert.ok(response);

      request.requestId = response.requestId = uuid().toLowerCase();
      request.startTime = response.startTime = new Date().getTime();
      request._serverVersioned = response._serverVersioned = server._versioned;

      request._apiVersion = server._config.defaultVersion;
      request._config = server._config;
      request.params = {};
      request.uriParams = {};

      response._apiVersion = server._config.defaultVersion;
      response._allowedMethods = [];
      response._config = server._config;

      var route;
      var params;
      var i, k;
      var path = _sanitizePath(request.url);
      request.url = path;

      if (!_parseHead(request, response)) return;

      if (!server.routes[request._apiVersion]) {
        if (log.trace()) {
          log.trace('restify: no routes (at all) found for version %s',
                    request._apiVersion);
        }

        return response.send(HttpCodes.NotFound);
      }

      if (log.trace())
        log.trace('Looking up route for API version: %s', request._apiVersion);

      if (server.routes[request._apiVersion][request.method]) {
        var routes = server.routes[request._apiVersion][request.method];
        for (i = 0; i < routes.length; i++) {
          params = _matches(path, routes[i]);
          if (params) {
            route = routes[i];
            break;
          }
        }
      }

      if (route) {
        server.routes.urls[request._apiVersion][route.url].forEach(function(r) {
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
        for (k in server.routes.urls[request._apiVersion]) {
          if (server.routes.urls[request._apiVersion].hasOwnProperty(k)) {
            route = server.routes.urls[request._apiVersion][k];

            if (log.trace())
              log.trace('restify: 405 path: looking at route %o', route);

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

    if (options) {

      if (options.serverName)
        server._config.serverName = options.serverName;

      if (options.apiVersion)
        server._config.defaultVersion = options.apiVersion;

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

    if (!server._config.defaultVersion)
      server._config.defaultVersion = Constants.NoApiVersion;

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
  }

};
