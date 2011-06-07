// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var assert = require('assert');
var crypto = require('crypto');
var http = require('http');
var path = require('path');
var querystring = require('querystring');
var url = require('url');

var uuid = require('node-uuid');

var Constants = require('./constants');
var HttpCodes = require('./http_codes');
var log = require('./log');
var utils = require('./utils');



////////////////////////
// Prototype extensions
////////////////////////

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
  headers['Access-Control-Allow-Methods'] = this._allowedMethods.join(', ');

  if (!headers['Access-Control-Allow-Methods'])
    delete headers['Access-Control-Allow-Methods'];

  if (!_opts.noClose)
    headers.Connection = 'close';

  if (this._apiVersion &&
      this._serverVersioned &&
      this._apiVersion !== Constants.NoApiVersion)
    headers[Constants.XApiVersion] = this._apiVersion;

  headers.Date = utils.newHttpDate(now);
  headers.Server = this._config.serverName;
  headers[Constants.XRequestId] = this.requestId;
  headers[Constants.XResponseTime] = this._time;

  if (_opts.body && _opts.code !== HttpCodes.NoContent) {
    headers['Content-Type'] = this._accept;
    switch (this._accept) {
    case Constants.ContentTypeJson:
      data = JSON.stringify(_opts.body);
      break;
    case Constants.ContentTypeXml:
      throw new Error('XML not yet supported');
    default:
      throw new Error('Somehow response.send has an unknown accept type: ' +
                      this._accept);
    }
  }

  this._bytes = 0;
  if (data) {
    data = data + '\n';
    this._bytes = data.length;
    if (_opts.code !== HttpCodes.NoContent) {
      headers['Content-Length'] = data.length;
      if (!_opts.noContentMD5) {
        var hash = crypto.createHash('md5');
        hash.update(data);
        headers['Content-MD5'] = hash.digest(encoding = 'base64');
      }
    } else {
      headers['Content-Length'] = 0;
    }
  } else {
    if (!_opts.noEnd) {
      headers['Content-Length'] = 0;
    }
  }

  if (log.trace()) {
    log.trace('response.send: code=%d, headers=%o, body=%s',
              _opts.code, headers, data);
  }

  this.writeHead(_opts.code, headers);
  if (!_opts.noEnd) {
    if (_opts.code !== HttpCodes.NoContent && data) {
      this.write(data);
    }
    this.end();
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

  if (error.details) {
    _e.details = error.details;
  }

  return this.send(error.httpCode, _e);
};


/**
 * Adds a route for handling.
 *
 * This method supports the notion of versioned routes.  Basically, the routing
 * table looks like this:
 *
 * {
 *   '1.2.3':
 *     {
 *       'GET':
 *         {
 *           '/foo/bar': [f(req, res, next), ...],
 *         }
 *      }
 * }
 *
 * An identical "reverse" index is kept for mapping URLs to methods (so just
 * mentally swap foo/bar and GET above).
 *
 * @param {String} method HTTP method.
 * @param {String} url the HTTP resource.
 * @param {Array} handlers an array of function(req, res, next).
 * @param {String} version version for this route.
 *
 */
http.Server.prototype._mount = function _mount(method, url, handlers, version) {
  if (version !== Constants.NoApiVersion)
    this._versioned = true;

  if (!this.routes) this.routes = {};
  if (!this.routes[version]) this.routes[version] = {};
  if (!this.routes[version][method]) this.routes[version][method] = [];
  if (!this.routes.urls) this.routes.urls = {};
  if (!this.routes.urls[version]) this.routes.urls[version] = {};
  if (!this.routes.urls[version][url]) this.routes.urls[version][url] = [];

  var _handlers = [];
  if (handlers instanceof Function) {
    _handlers.push(handlers);
  } else {
    handlers.forEach(function(h) {
      if (h instanceof Function) {
        _handlers.push(h);
      } else {
        log.warn('Non-function passed to mount: %s', h);
      }
    });
  }

  var r = {
    method: method,
    url: url,
    handlers: _handlers,
    version: version,
    regexRoute: false
  };

  if (url instanceof RegExp) {
    r.regexRoute = true;
  } else {
    r.urlComponents = url.split('/').slice(1);
  }

  this.routes[version][method].push(r);
  this.routes.urls[version][url].push(r);

  if (log.trace())
    log.trace('restify._mount: routes now %o', this.routes);
};


http.Server.prototype.del = function() {
  var args = Array.prototype.slice.call(arguments);
  var offset = 1;
  var url = args[0];
  var version = this._config.defaultVersion;


  if (!args[0] || (typeof(args[0]) !== 'string' &&
                   !(args[0] instanceof RegExp)))
    throw new TypeError('argument 0 must be a string (version or url)');

  if (!args[1])
    throw new TypeError('argument 1 is required (handler chain or url)');

  if (typeof(args[1]) === 'string') {
    version = args[0];
    url = args[1];
    offset = 2;
  }

  var handlers = utils.mergeFunctionArguments(args, offset);

  return this._mount('DELETE', url, handlers, version);
};


http.Server.prototype.get = function() {
  var args = Array.prototype.slice.call(arguments);
  var offset = 1;
  var url = args[0];
  var version = this._config.defaultVersion;

  if (!args[0] || (typeof(args[0]) !== 'string' &&
                   !(args[0] instanceof RegExp)))
    throw new TypeError('argument 0 must be a string (version or url)');

  if (!args[1])
    throw new TypeError('argument 1 is required (handler chain or url)');

  if (typeof(args[1]) === 'string') {
    version = args[0];
    url = args[1];
    offset = 2;
  }

  var handlers = utils.mergeFunctionArguments(args, offset);

  return this._mount('GET', url, handlers, version);
};


http.Server.prototype.head = function() {
  var args = Array.prototype.slice.call(arguments);
  var offset = 1;
  var url = args[0];
  var version = this._config.defaultVersion;

  if (!args[0] || (typeof(args[0]) !== 'string' &&
                   !(args[0] instanceof RegExp)))
    throw new TypeError('argument 0 must be a string (version or url)');

  if (!args[1])
    throw new TypeError('argument 1 is required (handler chain or url)');

  if (typeof(args[1]) === 'string') {
    version = args[0];
    url = args[1];
    offset = 2;
  }

  var handlers =  utils.mergeFunctionArguments(args, offset);

  return this._mount('HEAD', url, handlers, version);
};


http.Server.prototype.post = function() {
  var args = Array.prototype.slice.call(arguments);
  var offset = 1;
  var url = args[0];
  var version = this._config.defaultVersion;

  if (!args[0] || (typeof(args[0]) !== 'string' &&
                   !(args[0] instanceof RegExp)))
    throw new TypeError('argument 0 must be a string (version or url)');

  if (!args[1])
    throw new TypeError('argument 1 is required (handler chain or url)');

  if (typeof(args[1]) === 'string') {
    version = args[0];
    url = args[1];
    offset = 2;
  }

  var handlers = utils.mergeFunctionArguments(args, offset);

  return this._mount('POST', url, handlers, version);
};


http.Server.prototype.put = function() {
  var args = Array.prototype.slice.call(arguments);
  var offset = 1;
  var url = args[0];
  var version = this._config.defaultVersion;

  if (!args[0] || (typeof(args[0]) !== 'string' &&
                   !(args[0] instanceof RegExp)))
    throw new TypeError('argument 0 must be a string (version or url)');

  if (!args[1])
    throw new TypeError('argument 1 is required (handler chain or url)');

  if (typeof(args[1]) === 'string') {
    version = args[0];
    url = args[1];
    offset = 2;
  }

  var handlers = utils.mergeFunctionArguments(args, offset);

  return this._mount('PUT', url, handlers, version);
};
