// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var assert = require('assert');
var crypto = require('crypto');
var http = require('http');
var https = require('https');
var path = require('path');
var querystring = require('querystring');
var url = require('url');
var util = require('util');

var semver = require('semver');
var uuid = require('node-uuid');

var Constants = require('./constants');
var HttpCodes = require('./http_codes');
var log = require('./log');
var utils = require('./utils');



///--- Misc. extensions

http.STATUS_CODES[420] = 'Slow Down';
http.STATUS_CODES[449] = 'Retry with an x-api-version header';


///--- Prototype extensions

http.IncomingMessage.prototype.contentType = function contentType() {
  var type = this.headers['content-type'];
  var ndx;

  // RFC2616 section 7.2.1
  if (!type)
    return 'application/octet-stream';

  ndx = type.indexOf(';');
  if (ndx === -1)
    return type;

  return type.substring(0, ndx);
};


http.ServerResponse.prototype.send = function(options) {
  var _opts = {};
  var data;
  var now = new Date();

  if (!options) throw new TypeError('options required');
  if (typeof(options) === 'object') {
    _opts = options;
    if (!_opts.code || typeof(_opts.code) !== 'number') {
      throw new TypeError('options.code must be a number');
    }
  } else if (typeof(options) === 'number' || typeof(options) === 'string') {
    // support legacy api
    _opts.code = parseInt(arguments[0], 10);
    _opts.body = arguments[1];
    _opts.headers = arguments[2];
  } else {
    throw new TypeError('invalid argument type: ' + typeof(options));
  }

  this._code = _opts.code;
  this._time = now.getTime() - this.startTime;

  var headers;
  if (!_opts.headers) {
    headers = {};
  } else {
    headers = _opts.headers;
  }

  // These headers allow strict clients (i.e. Google Chrome) to know that
  // this server does allow itself to be invoked from pages that aren't
  // part of the same origin policy.
  headers['Access-Control-Allow-Origin'] = '*';
  if (this._allowedMethods && this._allowedMethods.length)
    headers['Access-Control-Allow-Methods'] = this._allowedMethods.join(', ');

  if (!_opts.noClose)
    headers.Connection = 'close';

  if (this._version)
    headers['X-Api-Version'] = this._version;

  headers.Date = utils.newHttpDate(now);
  headers.Server = this._config.serverName;
  headers['X-Request-Id'] = this.requestId;
  headers['X-Response-Time'] = this._time;

  if (_opts.body && _opts.code !== HttpCodes.NoContent) {
    headers['Content-Type'] = this._accept;
    switch (this._accept) {
    case Constants.ContentTypeXml:
      throw new Error('XML not yet supported');

    case Constants.ContentTypeFormEncoded:
      data = querystring.stringify(_opts.body);
      break;

    default:
      data = JSON.stringify(_opts.body);
      break;
    }
  }

  this._bytes = 0;
  if (data && _opts.code !== HttpCodes.NoContent) {
    data = data + '\n';
    this._bytes = Buffer.byteLength(data, 'utf8');

    if (!_opts.noContentMD5) {
      var hash = crypto.createHash('md5');
      hash.update(data);
      headers['Content-MD5'] = hash.digest('base64');
    }
  }

  if (!_opts.noEnd && this._method !== 'HEAD')
    headers['Content-Length'] = this._bytes;

  log.trace('response.send: code=%d, headers=%o, body=%s',
            _opts.code, headers, data);

  this.writeHead(_opts.code, headers);
  if (_opts.code !== HttpCodes.NoContent && this._method !== 'HEAD' && data)
    this.write(data);

  if (!_opts.noEnd) {
    this.end();
    this.responseSent = true;
    this.emit('responseSent');
  }
};


http.ServerResponse.prototype.sendError = function sendError(error) {
  if (!error || !error.restCode || !error.message || !error.httpCode) {
    log.warn('Unknown error being returned: %s', error);
    return this.send(HttpCodes.InternalError);
  }
  this.sentError = error;
  var _e = {
    code: error.restCode,
    message: error.message
  };

  if (this._config.fullErrors) {
    if (error.details)
      _e.details = error.details;
    if (error.error)
      _e.cause = error.error;
    if (error.stack)
      _e.stack = error.stack;
  }

  this.send(error.httpCode, _e, error.headers);
  this.errorSent = true;
  this.emit('errorSent');

  if (!this._config.noSendErrorLogs) {
    var msg = 'ErrorSent(requestId=%s): HttpCode=%d, RestCode=%s, ' +
      'message=%s:\n%s';
    this._config.sendErrorLogger(msg,
                                 this.requestId,
                                 error.httpCode,
                                 error.restCode,
                                 error.message,
                                 error.stack);
  }
};


/**
 * Moute a route on the sever.
 *
 * This API is internal only, but basically our routing table looks like:
 *
 * {
 *   'GET': [
 *     {
 *       method: 'GET',
 *       url: '/foo/:id',
 *       regex: false,
 *       version: '1.2.3,
 *       semver: true
 *     }
 *   ]
 * }
 *
 * An inverse mapping of url -> route is kept so we can return 405 on error.
 *
 * @param {String} method the request method.
 * @param {String} url the request url. Can also be an instance of RegExp.
 * @param {Object} handlers the handler chain.  Needs pre, main, post.
 * @param {String} version optional version to attach to this route.
 * @return {Object} this so you can chain.
 */
http.Server.prototype._mount =
https.Server.prototype._mount = function(method, url, handlers, version) {

  assert.ok(method);
  assert.ok(url);
  assert.ok(handlers);
  assert.equal(typeof(handlers), 'object');

  if (!this.routes) this.routes = {};
  if (!this.routes[method]) this.routes[method] = [];
  if (!this.routes.urls) this.routes.urls = {};
  if (!this.routes.urls[url]) this.routes.urls[url] = [];

  var route = {
    method: method,
    url: url,
    regex: false,
    handlers: handlers
  };
  if (version) {
    route.version = version;
    if (semver.valid(version))
      route.semver = true;
  }

  if (url instanceof RegExp) {
    route.regex = true;
  } else {
    route.urlComponents = url.split('/').slice(1);
  }

  log.trace('server: adding route %o', route);

  this.routes[method].push(route);
  this.routes.urls[url].push(route);

  return this;
};


/**
 * Read the restify man pages to get a feel for how this works.
 * The params are explicitly *not* listed in the function scoping
 * since we play all nature of varargs games to make the API easy
 * to consume.
 */
http.Server.prototype._prepareMountArgs =
https.Server.prototype._prepareMountArgs = function(args) {

  assert.ok(args);
  assert.ok((args instanceof Array));

  var self = this;
  var offset = 1;

  if (args[0] === undefined ||
      (typeof(args[0]) !== 'string' &&
       !(args[0] instanceof RegExp) &&
       (args[0] !== null)))
    throw new TypeError('argument 0 must be a string (version or url)');

  if (!args[1] ||
      ((!(args[1] instanceof Array) && !(args[1] instanceof Function)) &&
       (typeof(args[1]) !== 'string' && !(args[1] instanceof RegExp))))
    throw new TypeError('argument 1 is required (handler chain or url)');

  var obj = {
    url: args[0],
    handlers: {},
    version: self._config.version
  };

  if ((typeof(args[1]) === 'string') || (args[1] instanceof RegExp)) {
    obj.version = args[0];
    obj.url = args[1];
    offset = 2;
  }

  if (((args.length - 2) - (offset + 1) >= 0) &&
      (args[offset] instanceof Array) &&
      (args[args.length - 1] instanceof Array)) {
    // Basically, we treat the fact that both the first handler and the last
    // handler were arrays and that there is "something" in between as a key to
    // treat them as 'pre' and 'post'. Otherwise we just flatten the whole thing
    // out into a single handler chain.
    obj.handlers.pre = args[offset];
    obj.handlers.post = args[args.length - 1];
    obj.handlers.main =
      utils.mergeFunctionArguments(args, offset + 1, args.length - 1);
  } else {
    obj.handlers.main =
      utils.mergeFunctionArguments(args, offset, args.length);
  }

  if (!obj.url || !(obj.url instanceof RegExp) && obj.url.charAt(0) !== '/')
    throw new TypeError('Invalid resource path: ' + obj.url);

  return obj;
};


http.Server.prototype.get =
https.Server.prototype.get = function() {
  var args = Array.prototype.slice.call(arguments);
  var obj = this._prepareMountArgs(args);

  return this._mount('GET', obj.url, obj.handlers, obj.version);
};


http.Server.prototype.head =
https.Server.prototype.head = function() {
  var args = Array.prototype.slice.call(arguments);
  var obj = this._prepareMountArgs(args);

  return this._mount('HEAD', obj.url, obj.handlers, obj.version);
};


http.Server.prototype.post =
https.Server.prototype.post = function() {
  var args = Array.prototype.slice.call(arguments);
  var obj = this._prepareMountArgs(args);

  return this._mount('POST', obj.url, obj.handlers, obj.version);
};


http.Server.prototype.put =
https.Server.prototype.put = function() {
  var args = Array.prototype.slice.call(arguments);
  var obj = this._prepareMountArgs(args);

  return this._mount('PUT', obj.url, obj.handlers, obj.version);
};


http.Server.prototype.del =
https.Server.prototype.del = function() {
  var args = Array.prototype.slice.call(arguments);
  var obj = this._prepareMountArgs(args);

  return this._mount('DELETE', obj.url, obj.handlers, obj.version);
};
