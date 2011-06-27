// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var assert = require('assert');
var crypto = require('crypto');
var http = require('http');
var https = require('https');
var path = require('path');
var querystring = require('querystring');
var url = require('url');

var formidable = require('formidable');
var semver = require('semver');
var uuid = require('node-uuid');

var HttpCodes = require('./http_codes');
var RestCodes = require('./rest_codes');
var log = require('./log');
var newError = require('./error').newError;

// Just force this to extend http.ServerResponse
require('./http_extra');



///--- Internal Helpers

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

  if (route.regex)
    return route.url.exec(path);

  if (path === route.url)
    return {}; // there were no params if it was an exact match

  var params = route.urlComponents;
  var components = path.split('/').splice(1);
  var len = components.length;

  if (components.length !== params.length)
    return null;

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
  req.username = 'anonymous';
  if (!req.headers.authorization) {
    log.trace('No authorization header present.');
    return true;
  }

  var pieces = req.headers.authorization.split(' ', 2);
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
    log.debug('Unknown authorization scheme %s. Skipping processing',
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
  if (request.headers['x-api-version'])
    request._version = request.headers['x-api-version'];

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

  log.trace('_parseHead:\n%s %s HTTP/%s\nHeaders: %o',
            request.method,
            request.url,
            request.httpVersion,
            request.headers);

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
      request.body += chunk;
      if (request.body.length > request._config.maxRequestSize) {
        return response.sendError(newError({
          httpCode: HttpCodes.RequestTooLarge,
          restCode: RestCodes.RequestTooLarge,
          message: 'maximum HTTP data size is 8k'
        }));
      }
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


function _handleNoRoute(server, request, response) {
  assert.ok(server);
  assert.ok(request);
  assert.ok(response);

  var code = HttpCodes.NotFound;
  var headers = {};

  // This is such a one-off that it's saner to just handle it as such
  if (request.method === 'OPTIONS' &&
      request.url === '*') {
    code = HttpCodes.Ok;
  } else {
    var urls = server.routes.urls;
    for (var u in urls) {
      if (urls.hasOwnProperty(u)) {
        var route = urls[u];
        var methods = [];
        var versions = [];

        var matched = false;
        for (var i = 0; i < route.length; i++) {
          if (methods.indexOf(route[i].method) === -1)
            methods.push(route[i].method);

          if (route[i].version && versions.indexOf(route[i].version) === -1)
            versions.push(route[i].version);

          if (_matches(request.url, route[i]))
            matched = true;
        }

        if (matched) {
          code = HttpCodes.BadMethod;
          response._allowedMethods = methods;
          if (versions.length) {
            headers['x-api-versions'] = versions.join(', ');
            if (methods.indexOf(request.method) !== -1)
              code = HttpCodes.RetryWith;
          }

          if (request.method === 'OPTIONS') {
            code = HttpCodes.Ok;
            headers.Allow = methods.join(', ');
          }
        }
      }
    }
  }

  response.send(code, null, headers);
  return log.w3cLog(request, response, function() {});
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
   *                 - version: Default API version to support; setting this
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

    var server;

    function httpMain(request, response) {
      assert.ok(request);
      assert.ok(response);

      var route;
      var path = _sanitizePath(request.url);
      request.url = path;
      request.username = '';

      request.requestId = response.requestId = uuid().toLowerCase();
      request.startTime = response.startTime = new Date().getTime();

      request._config = server._config;
      request.params = {};
      request.uriParams = {};

      response._method = request.method;
      response._allowedMethods = [];
      response._config = server._config;

      if (!_parseHead(request, response))
        return log.w3cLog(request, response, function() {});

      if (!server.routes[request.method])
        return _handleNoRoute(server, request, response);

      var routes = server.routes[request.method];
      for (var i = 0; i < routes.length; i++) {

        var params = _matches(path, routes[i]);
        if (params) {
          // If the server isn't using versioning, just ignore
          // whatever the client sent as a version header.
          // If the server is, the client MUST send a version
          // header.  Unless the server is configured
          // with weak versioning.
          var ok = true;
          if (routes[i].version && !server.weakVersions) {
            if (request._version) {
              if (routes[i].semver) {
                ok = semver.satisfies(routes[i].version, request._version);
              } else {
                ok = (routes[i].version === request._version);
              }
            } else {
              ok = false;
            }
          }

          if (ok) {
            request.uriParams = params;
            route = routes[i];
            if (route.version)
              response._version = route.version;

            for (var j = 0; j < server.routes.urls[route.url].length; j++) {
              var r = server.routes.urls[route.url][j];
              response._allowedMethods.push(r.method);
            }
            break;
          }
        }
      }

      if (!route)
        return _handleNoRoute(server, request, response);

      log.trace('%s %s route found -> %o', request.method, request.url, route);

      var handler = 0;
      var chain;
      var stage = 0;

      function runChain() {
        return _parseRequest(request, response, function() {
          var next = arguments.callee;

          if (chain.length > 1) {
            // Check if we need to skip to the post chain
            if ((stage === 0 && response.responseSent) ||
                (stage === 1 && response.errorSent)) {
              stage = 2;
              handler = 0;
            }
          }

          if (!chain[stage])
            return;

          if (!chain[stage][handler]) {
            if (++stage >= chain.length)
              return;

            handler = 0;
          }

          if (chain[stage][handler])
            return chain[stage][handler++].call(this, request, response, next);
        });
      }

      if (route.handlers.pre &&
          route.handlers.main &&
          route.handlers.post) {

        chain = [
          route.handlers.pre,
          route.handlers.main,
          route.handlers.post
        ];

      } else {
        chain = [route.handlers.main];
      }

      return runChain();
    } // end httpMain

    if (options && options.cert && options.key) {
      server = https.createServer(options, httpMain);
    } else {
      server = http.createServer(httpMain);
    }

    server.logLevel = function(level) {
      return log.level(level);
    };

    server.routes = {};
    server._config = {};

    if (options) {

      if (options.serverName)
        server._config.serverName = options.serverName;

      if (options.apiVersion && !options.version)
        options.version = options.apiVersion;

      if (options.version)
        server._config.version = options.version;

      if (options.maxRequestSize)
        server._config.maxRequestSize = options.maxRequestSize;

      if (options.acceptable)
        server._config.acceptable = options.acceptable;

      if (options.accept)
        server._config.acceptable = options.accept;

      if (options.clockSkew)
        server._config.clockSkew = options.clockSkew * 1000;

      if (options.logTo)
        log.stderr(options.logTo);

      if (options.fullErrors)
        server._config.fullErrors = true;

      if (options.sendErrorLogger)
        server._config.sendErrorLogger = options.sendErrorLogger;
    }

    if (!server._config.serverName)
      server._config.serverName = 'node.js';

    if (!server._config.maxRequestSize)
      server._config.maxRequestSize = 8192;

    if (!server._config.clockSkew)
      server._config.clockSkew = 300 * 1000; // Default 5m

    if (!server.sendErrorLogLevel)
      server._config.sendErrorLogger = log.warn;

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

    log.trace('server will accept types: %o', server._config.acceptable);

    return server;
  }

};
