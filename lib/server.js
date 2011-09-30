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
var xml2js = require('xml2js');

var HttpCodes = require('./http_codes');
var RestCodes = require('./rest_codes');
var log = require('./log');
var newError = require('./error').newError;
var sprintf = require('./sprintf').sprintf;

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
    // Don't use URL.parse, as it doesn't handle strings
    // with ':' in them for this case. Regardless of what the
    // RFC says about this, people do it.
    var frag = components[i];
    if (frag.indexOf('?') !== -1)
      frag = frag.split('?', 2)[0];

    if (params[i] === frag)
      continue;

    if (params[i].charAt(0) === ':') {
      if (/.+\.\w+$/.test(frag))
        frag = frag.split(/\.\w+$/)[0];

      parsed[params[i].substr(1)] = frag;
      continue;
    }

    return null;
  }

  return parsed;
}


function _parseAccept(request, response) {
  assert.ok(request);
  assert.ok(response);
  assert.ok(request._config.acceptable);
  assert.ok(request._config.acceptable.length);

  if (!request.headers.accept) {
    log.trace('_parseAccept: no accept header sent, using `default`');
    response._accept = request.headers.accept = request._config.acceptable[0];
    return true;
  }

  var mediaRanges = request.headers.accept.split(',');
  for (var i = 0; i < mediaRanges.length; i++) {
    var _accept = new RegExp(mediaRanges[i].split(';')[0].replace(/\*/g, '.*'));
    for (var j = 0; j < request._config.acceptable.length; j++) {
      if (_accept.test(request._config.acceptable[j])) {
        response._accept = request._config.acceptable[j];
        log.trace('Parsed accept type as: %s', response._accept);
        return true;
      }
    }
  }

  response.sendError(newError({
    httpCode: HttpCodes.NotAcceptable,
    restCode: RestCodes.InvalidArgument,
    message: request.headers.accept + ' unsupported',
    details: request._config.acceptable
  }));
  return false;
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

    if (decoded !== null) {
      var idx = decoded.indexOf(':');
      if (idx === -1) {
        pieces = [decoded];
      } else {
        pieces = [decoded.slice(0, idx), decoded.slice(idx + 1)];
      }
    }

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
      function done(err, bParams) {
        if (err) {
          return response.sendError(newError({
            httpCode: HttpCodes.BadRequest,
            restCode: RestCodes.InvalidArgument,
            message: 'Invalid Content: ' + err.message
          }));
        }

        Object.keys(bParams).forEach(function(k) {
          if (request.params.hasOwnProperty(k)) {
            return response.sendError(newError({
              httpCode: HttpCodes.Conflict,
              restCode: RestCodes.InvalidArgument,
              message: 'duplicate parameter detected: ' + k
            }));
          }
          request.params[k] = bParams[k];
        });

        log.trace('_parseRequest: params parsed as: %o', request.params);
        return next();
      }

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
        if (request._config.contentHandlers[contentType]) {
          try {
            bParams = request._config.contentHandlers[contentType](request.body,
                                                                   request,
                                                                   response,
                                                                   done);
            if (bParams)
              return done(null, bParams);
          } catch (e) {
            return done(e);
          }
        } else if (contentType) {
          return response.sendError(newError({
            httpCode: HttpCodes.UnsupportedMediaType,
            restCode: RestCodes.InvalidArgument,
            message: contentType + ' unsupported'
          }));
        }
      } else {
        return done(null, {});
      }
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
   *                 - contentHandlers: An object of
   *                               'type'-> function(body, req, res).
   *                               Built in content types are:
   *                                 - application/json
   *                                 - application/x-www-form-urlencoded
   *                 - contentWriters: An object of
   *                            'type' -> function(obj, req, res).
   *                     - Additionally supports application/javascript (jsonp)
   *                 - headers: An object of global headers that are sent back
   *                            on all requests.  Restify automatically sets:
   *                             - X-Api-Version (if versioned)
   *                             - X-Request-Id
   *                             - X-Response-Time
   *                             - Content-(Length|Type|MD5)
   *                             - Access-Control-Allow-(Origin|Methods|Headers)
   *                             - Access-Control-Expose-Headers
   *                            If you don't set those particular keys, restify
   *                            fills in default functions; if you do set them,
   *                            you can fully override restify's defaults.
   *                            Note that like contentWriters, this is an object
   *                            with a string key as the header name, and the
   *                            value is a function of the form f(response)
   *                            which must return a string.
   *
   * @return {Object} node HTTP server, with restify "magic".
   */
  createServer: function(options) {
    var k;
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

      response.request = request;
      response._method = request.method;
      response._allowedMethods = ['OPTIONS'];
      response._config = server._config;
      response._sent = false;
      response._errorSent = false;
      response._formatError = server._config.formatError;

      // HTTP and HTTPS are different -> joyent/node GH #1005
      var addr = request.connection.remoteAddress;
      if (!addr) {
        if (request.connection.socket) {
          addr = request.connection.socket.remoteAddress;
        } else {
          addr = 'unknown';
        }
      }
      request._remoteAddress = addr;
      response._remoteAddress = addr;

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
        return _parseRequest(request, response, function(had_err) {
          var next = arguments.callee;

          if (had_err)
            response.sendError(had_err);

          if (chain.length > 1) {
            // Check if we need to skip to the post chain
            if ((stage === 0 && response._sent) ||
                (stage === 1 && response._errorSent)) {
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
    server._config.contentHandlers = {};
    server._config.contentWriters = {};
    server._config.headers = {};

    if (!options)
      options = {};

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

    // begin contentHandlers/writers
    if (!options.contentHandlers)
      options.contentHandlers = {};
    if (!options.contentWriters)
      options.contentWriters = {};
    if (typeof(options.contentHandlers) !== 'object')
      throw new TypeError('contentHandlers must be an object');
    if (typeof(options.contentWriters) !== 'object')
      throw new TypeError('contentWriters must be an object');

    if (!options.contentHandlers['application/json'])
      options.contentHandlers['application/json'] = function(body, req, res) {
        return JSON.parse(body);
      };

    if (!options.contentHandlers['application/x-www-form-urlencoded'])
      options.contentHandlers['application/x-www-form-urlencoded'] =
      function(body, req, res) {
        return querystring.parse(body) || {};
      };

    if (!options.contentWriters['application/json'])
      options.contentWriters['application/json'] = function(obj, req, res) {
        return JSON.stringify(obj);
      };

    if (!options.contentWriters['application/x-www-form-urlencoded'])
      options.contentWriters['application/x-www-form-urlencoded'] =
      function(obj, req, res) {
        return querystring.stringify(obj) + '\n';
      };

    if (!options.contentHandlers['application/xml'])
      options.contentHandlers['application/xml'] =
      function(body, req, res, callback) {
        var parser = new xml2js.Parser();
        parser.addListener('end', function(result) {
          if (!result)
            result = {};

          Object.keys(result).forEach(function(k) {
            try {
              if (typeof(result[k]) === 'object' &&
                  typeof(result[k]['@']) === 'object' &&
                  result[k]['@'].type &&
                  result[k]['#']) {
                switch (result[k]['@'].type) {
                case 'integer':
                  result[k] = parseInt(result[k]['#'], 10);
                  break;
                case 'boolean':
                  result[k] = /^true$/i.test(result[k]['#']);
                  break;
                default:
                  result[k] = result[k]['#'];
                  break;
                }
              }
            } catch (e) {}
          });
          if (result.id && typeof(result.id) === 'object')
            delete result.id;
          return callback(null, result);
        });
        parser.parseString(body);
      };

    if (!options.contentWriters['application/xml']) {
      options.contentWriters['application/xml'] =
      function(obj) {
        assert.equal(typeof(obj), 'object');

        var res = '<?xml version="1.0" encoding="UTF-8"?>\n';

        function serialize(key, val, indent) {
          var str = '';

          switch (typeof(val)) {
          case 'string':
          case 'boolean':
            str += sprintf('%s<%s>%s</%s>\n', indent, key, val + '', key);
            break;
          case 'number':
            str += sprintf('%s<%s type="integer">%s</%s>\n',
                           indent, key, val + '', key);
            break;

          case 'object':
            if (Array.isArray(val)) {
              val.forEach(function(v) {
                str += serialize(key, v, indent + ' ');
              });
            } else if (val === null) {
              str += sprintf('%s<%s/>\n', indent, key);
            } else {
            str += sprintf('%s<%s>\n', indent, key);
              Object.keys(val).forEach(function(k) {
              str += serialize(k, val[k], indent + '  ');
              });
              str += sprintf('%s</%s>\n', indent, key);
            }
            break;
          default:
            break;
          }

          return str;
        }

        Object.keys(obj).forEach(function(key) {
          res += serialize(key, obj[key], '');
        });
        return res;
      };
    }

    if (!options.contentWriters['application/javascript'])
      options.contentWriters['application/javascript'] =
      function(obj, req, res) {
        var query = url.parse(req.url, true).query;
        var cbName = query && query.callback ? query.callback : 'callback';
        var response = {
          code: res.code,
          data: obj
        };
        res.code = 200;
        return cbName + '(' + JSON.stringify(response) + ');';
      };

    Object.keys(options.contentHandlers).forEach(function(k) {
      if (typeof(options.contentHandlers[k]) !== 'function')
        throw new TypeError('contentHandlers must be functions');

      server._config.contentHandlers[k] = options.contentHandlers[k];
    });
    Object.keys(options.contentWriters).forEach(function(k) {
      if (typeof(options.contentWriters[k]) !== 'function')
        throw new TypeError('contentWriters must be functions');

      server._config.contentWriters[k] = options.contentWriters[k];
    });
    // end contentHandlers/writers

    if (options.formatError)
      server._config.formatError = options.formatError;

    if (options.headers) {
      if (typeof(options.headers) !== 'object')
        throw new TypeError('headers must be an object');

      for (k in options.headers) {
        if (options.headers.hasOwnProperty(k)) {
          if (typeof(options.headers[k]) !== 'function')
            throw new TypeError('headers values must be functions');

          server._config.headers[k] = options.headers[k];
        }
      }
    }

    if (!server._config.formatError)
      server._config.formatError = function(res, e) {
        if (res._accept === 'application/xml')
          e = { error: e };

        return e;
      };

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

    var foundXApiVersion = false;
    var foundXRequestId = false;
    var foundXResponseTime = false;
    var foundContentLength = false;
    var foundContentType = false;
    var foundContentMD5 = false;
    var foundACAO = false;
    var foundACAM = false;
    var foundACAH = false;
    var foundACEH = false;
    for (k in server._config.headers) {
      if (server._config.headers.hasOwnProperty(k)) {
        var h = k.toLowerCase();
        switch (h) {
        case 'x-api-version':
          foundXApiVersion = true;
          break;
        case 'x-request-id':
          foundXRequestId = true;
          break;
        case 'x-response-time':
          foundXResponseTime = true;
          break;
        case 'content-length':
          foundContentLength = true;
          break;
        case 'content-type':
          foundContentType = true;
          break;
        case 'content-md5':
          foundContentMD5 = true;
          break;
        case 'access-control-allow-origin':
          foundACAO = true;
          break;
        case 'access-control-allow-method':
          foundACAM = true;
          break;
        case 'access-control-allow-headers':
          foundACAH = true;
          break;
        case 'access-control-expose-headers':
          foundACEH = true;
          break;
        }
      }
    }

    if (!foundXApiVersion) {
      server._config.headers['X-Api-Version'] = function(res) {
        return res._version;
      };
    }
    if (!foundXRequestId) {
      server._config.headers['X-Request-Id'] = function(res) {
        return res.requestId;
      };
    }
    if (!foundXResponseTime) {
      server._config.headers['X-Response-Time'] = function(res) {
        return res._time;
      };
    }
    if (!foundContentLength) {
      server._config.headers['Content-Length'] = function(res) {
        if (!res.options.noEnd && res._method !== 'HEAD' && res._data) {
          res._bytes = Buffer.byteLength(res._data, 'utf8');
          return res._bytes;
        }
      };
    }
    if (!foundContentMD5) {
      server._config.headers['Content-MD5'] = function(res) {
        if (res._data && res.options.code !== 204) {
          if (!res.options.noContentMD5) {
            var hash = crypto.createHash('md5');
            hash.update(res._data);
            return hash.digest('base64');
          }
        }
      };
    }
    if (!foundContentType) {
      server._config.headers['Content-Type'] = function(res) {
        if (res._data && res.options.code !== 204)
          return res._accept;
      };
    }
    if (!foundACAO) {
      server._config.headers['Access-Control-Allow-Origin'] = function(res) {
        return '*';
      };
    }
    if (!foundACAM) {
      server._config.headers['Access-Control-Allow-Methods'] = function(res) {
        if (res._allowedMethods && res._allowedMethods.length)
          return res._allowedMethods.join(', ');
      };
    }
    if (!foundACAH) {
      server._config.headers['Access-Control-Allow-Headers'] = function(res) {
        return [
          'Accept',
          'Content-Type',
          'Content-Length',
          'Date',
          'X-Api-Version'
        ].join(', ');
      };
    }
    if (!foundACEH) {
      server._config.headers['Access-Control-Expose-Headers'] = function(res) {
        return [
          'X-Api-Version',
          'X-Request-Id',
          'X-Response-Time'
        ].join(', ');
      };
    }

    return server;
  }

};
