// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var assert = require('assert');
var crypto = require('crypto');
var util = require('util');
var http = require('http');
var httpu = require('httpu');
var https = require('https');
var path = require('path');
var querystring = require('querystring');
var url = require('url');
var util = require('util');

var retry = require('retry');
var uuid = require('node-uuid');

var log = require('./log');
var newError = require('./error').newError;
var HttpCodes = require('./http_codes');
var RestCodes = require('./rest_codes');
var utils = require('./utils');



// --- Publicly available API

/**
 * Constructor.
 *
 * Tacks in the following headers automatically:
 *
 * - Date
 * - Accept: application/json
 *
 * On data:
 * - Content-Type: application/json
 * - Content-Length
 * - Content-MD5
 *
 * @param {Object} options the usual pattern with:
 *   - url: base url to communicate with (required).
 *   - path: HTTP Resource (default: '/' || path from url).
 *   - headers: Any additional HTTP headers to send on all requests.
 *   - contentType: one of the supported serialization formats, which is
 *       either `application/json` or application/x-www-form-urlencoded. Default
 *       is JSON.
 *   - version: Default version to use in x-api-version (optional).
 *   - retryOptions: options to pass to node-retry. Defaults to 3 retries after
 *       a 500ms wait.
 *   - noContentMD5: skip content-md5 checking.
 *
 *
 */
function RestClient(options) {
  if (!options) throw new TypeError('options is required');

  if (!(!options.url !== !options.socketPath)) // JS XOR...
    throw new TypeError('One of options.url, options.socketPath are required');

  if (options.url) {
    this.url = url.parse(options.url);
    this.proto = http;
    if (this.url.protocol === 'https:') this.proto = https;
  }
  if (options.socketPath) {
    this.socketPath = options.socketPath;
    this.proto = httpu;
  }
  assert.ok(this.proto);

  // https://github.com/joyent/node/issues/711 introduced a bug, IMO,
  // where `pathname=="/"` even for, e.g., "http://example.com". Ignore
  // the '/' in that case.
  this.path = options.path || '';
  if (!this.path && this.url
      && !(this.url.pathname === '/'
           && options.url[options.url.length-1] !== '/'))
  {
    this.path = this.url.pathname;
  }

  this.headers = {
    Accept: 'application/json'
  };
  if (options.version)
    this.headers['x-api-version'] = options.version;

  if (options.headers)
    utils.extend(options.headers, this.headers);

  this.retryOptions = options.retryOptions || { retries: 3, minTimeout: 500 };

  if (options.contentType) {
    if ((options.contentType !== 'application/json') &&
        (options.contentType !== 'application/x-www-form-urlencoded')) {
      throw new TypeError('options.contentType ' +
                          options.contentType +
                          ' is not supported');
    }
    this.contentType = options.contentType;
  } else {
    this.contentType = 'application/json';
  }
  this.noContentMD5 = options.noContentMD5;

  if (log.trace()) {
    log.trace('RestClient: constructed %s',
              require('util').inspect(this, false, 1));
  }
}


/**
 * Does an HTTP PUT against a resource; defaults to path from constructor.
 *
 * @param {Object} optional options with:
 *   - path: resource path.
 *   - body: a JS object that will get marshalled to JSON.
 *   - query: (optional) query params, as object.
 *   - headers: any additional headers to tack on.
 *   - expect: expected HTTP status code. Defaults to 204.
 * @callback {Function} (optional) callback of the form f(err, obj, headers).
 */
RestClient.prototype.put = function(options, callback) {
  log.trace('RestClient.put options=%o', options);
  var args = this._processArguments([200, 201], 'PUT', options, callback);
  var opts = args.options;
  var cb = args.callback;

  this._request(args.options, function(err, code, headers, obj, res) {
    if (err) return cb(err);
    if (opts.expect.indexOf(code) === -1) {
      return cb(newError({
        httpCode: code,
        details: {
          expected: opts.expect,
          statusCode: code,
          headers: headers,
          object: obj
        }
      }));
    }

    return callback(null, obj, headers);
  });
};


/**
 * Does an HTTP POST against a resource; defaults to path from constructor.
 *
 * @param {Object} options with:
 *   - path: (optional) resource path.
 *   - body: (optional) JS object.
 *   - query: (optional) query params, as object.
 *   - headers: (optional) any additional headers to tack on.
 *   - version: (optional) override the default version.
 *   - expect: (optional) expected HTTP status code. Defaults to 200.
 * @callback {Function} (optional) callback of the form function(err, headers).
 */
RestClient.prototype.post = function(options, callback) {
  var args = this._processArguments([200, 201], 'POST', options, callback);
  var opts = args.options;
  var cb = args.callback;

  this._request(args.options, function(err, code, headers, obj, res) {
    if (err) return cb(err);
    if (opts.expect.indexOf(code) === -1) {
      return cb(newError({
        httpCode: code,
        details: {
          expected: opts.expect,
          statusCode: code,
          headers: headers,
          object: obj
        }
      }));
    }

    return callback(null, obj, headers);
  });
};


/**
 * Does an HTTP GET against a resource; defaults to path from constructor.
 *
 * @param {Object} options with:
 *   - path: (optional) resource path.
 *   - query: (optional) query params, as object.
 *   - headers: (optional) any additional headers to tack on.
 *   - version: (optional) override the default version.
 *   - expect: (optional) expected HTTP status code. Defaults to 200.
 * @callback {Function} (optional) callback of the form f(err, obj, headers).
 */
RestClient.prototype.get = function(options, callback) {
  var args = this._processArguments([200], 'GET', options, callback);
  var opts = args.options;
  var cb = args.callback;

  this._request(args.options, function(err, code, headers, obj, res) {
    if (err) return cb(err);
    if (opts.expect.indexOf(code) === -1) {
      return cb(newError({
        httpCode: code,
        details: {
          expected: opts.expect,
          statusCode: code,
          headers: headers,
          object: obj
        }
      }));
    }

    return callback(null, obj, headers, res);
  });
};


/**
 * Does an HTTP DELETE against a resource; defaults to path from constructor.
 *
 * @param {Object} options with:
 *   - path: (optional) resource path.
 *   - query: (optional) query params, as object.
 *   - headers: (optional) any additional headers to tack on.
 *   - version: (optional) override the default version.
 *   - expect: (optional) expected HTTP status code. Defaults to 204.
 * @callback {Function} (optional) callback of the form function(err, headers).
 */
RestClient.prototype.del = function(options, callback) {
  var args =
    this._processArguments([200, 202, 204], 'DELETE', options, callback);
  var opts = args.options;
  var cb = args.callback;

  this._request(args.options, function(err, code, headers, obj, res) {
    if (err) return cb(err);
    if (opts.expect.indexOf(code) === -1) {
      return cb(newError({
        httpCode: code,
        details: {
          expected: opts.expect,
          statusCode: code,
          headers: headers,
          object: obj
        }
      }));
    }

    return callback(null, headers);
  });
};


/**
 * Does an HTTP HEAD against a resource; defaults to path from constructor.
 *
 * @param {Object} options with:
 *   - path: (optional) resource path.
 *   - query: (optional) query params, as object.
 *   - headers: (optional) any additional headers to tack on.
 *   - version: (optional) override the default version.
 *   - expect: (optional) expected HTTP status code. Defaults to 204.
 * @callback {Function} (optional) callback of the form function(err, headers).
 */
RestClient.prototype.head = function(options, callback) {
  var args = this._processArguments([200, 204], 'HEAD', options, callback);
  var opts = args.options;
  var cb = args.callback;

  this._request(args.options, function(err, code, headers, obj, res) {
    if (err) return cb(err);
    if (opts.expect.indexOf(code) === -1) {
      return cb(newError({
        httpCode: code,
        details: {
          expected: opts.expect,
          statusCode: code,
          headers: headers,
          object: obj
        }
      }));
    }

    return callback(null, headers);
  });
};


RestClient.prototype._request = function(options, callback) {
  assert.ok(options);
  assert.ok(callback);

  var self = this;

  var data = null;
  if (options.body &&
      options.method !== 'DELETE' &&
      options.method !== 'HEAD' &&
      options.method !== 'GET') {

    var hash = crypto.createHash('md5');
    if (this.contentType === 'application/json') {
      data = JSON.stringify(options.body);
    } else if (this.contentType === 'application/x-www-form-urlencoded') {
      data = querystring.stringify(options.body);
    }

    hash.update(data);
    options.headers['content-type'] = this.contentType;
    options.headers['content-length'] = data.length;
    options.headers['content-md5'] = hash.digest('base64');
  }

  var operation = retry.operation(self.retryOptions);
  operation.try(function(attempt) {
    options.headers.Date = utils.newHttpDate(new Date());
    log.trace('RestClient(attempt=%d): issuing request %o', attempt, options);
    var req = self.proto.request(options, function(res) {
      log.trace('RestClient: %s %s => code=%d, headers=%o',
                options.method, options.path, res.statusCode, res.headers);
      var err = null;
      if (res.statusCode >= 500) {
        if (operation.retry(new Error())) return;

        return callback(newError({
          httpCode: res.statusCode,
          restCode: RestCodes.RetriesExceeded,
          message: 'Maximum number of retries exceeded: ' + attempt,
          details: res.headers
        }));
      }

      res.setEncoding('utf8');
      res.body = '';
      res.on('data', function(chunk) {
        res.body = res.body + chunk;
      });

      res.on('end', function() {
        log.trace('RestClient: %s %s => body=%s',
                  options.method, options.path, res.body ? res.body : ' ');

        if (res.headers['content-length']) {
          var len = parseInt(res.headers['content-length'], 10);
          if (res.body.length !== len) {
            log.trace('RestClient: %s %s, content-length mismatch',
                      options.method, options.path);
            if (operation.retry(new Error())) return;

            return callback(newError({
              httpCode: HttpCodes.InternalError,
              restCode: RestCodes.InvalidHeader,
              message: 'Content-Length ' + len + ' didn\'t match: ' +
                res.body.length,
            }));
          }
        }

        if (res.headers['content-md5'] && !self.noContentMD5) {
          var hash = crypto.createHash('md5');
          hash.update(res.body);
          var digest = hash.digest('base64');
          if (res.headers['content-md5'] !== digest) {
            log.trace('RestClient: %s %s, content-md5 mismatch',
                      options.method, options.path);
            err = newError({
              httpCode: HttpCodes.InternalError,
              restCode: RestCodes.InvalidHeader,
              message: 'Content-MD5 ' + res.headers['content-md5'] +
                ' didn\'t match: ' + digest
            });
            if (operation.retry(err)) return;
            return callback(err);
          }
        }

        if (res.body.length > 0) {
          switch (res.headers['content-type']) {

          case 'application/json':
            try {
              res.params = JSON.parse(res.body);
            } catch (e) {
              return callback(newError({
                httpCode: HttpCodes.InternalError,
                restCode: RestCodes.InvalidHeader,
                message: 'Content-Type was JSON, but it\'s not parsable',
                error: e
              }));
            }
            break;

          case 'application/x-www-form-urlencoded':
            res.params = querystring.parse(res.body);
            break;

          default:
            res.params = {};
            break;
          }
        }

        log.trace('RestClient: %s %s: issuing callback',
                  options.method, options.path);
        callback(null, res.statusCode, res.headers, res.params, res);
      });
    });

    req.on('error', function(err) {
      if (!operation.retry(err)) {
        return callback(newError({
          httpCode: HttpCodes.InternalError,
          restCode: RestCodes.RetriesExceeded,
          error: err,
          message: 'HTTP Client error event'
        }));
      }
    });

    if (data) req.write(data);
    req.end();
  });
};


RestClient.prototype._newHttpOptions = function(method) {
  assert.ok(method);

  var self = this;
  var opts = {
    headers: {},
    method: method,
    path: self.path.toString()
  };
  utils.extend(self.headers, opts.headers);
  if (self.url) {
    opts.host = self.url.hostname.toString();
    if (self.url.port !== undefined) {
      opts.port = self.url.port.toString();
    }
  } else {
    opts.socketPath = self.socketPath.toString();
  }

  return opts;
};


RestClient.prototype._processArguments = function(expect,
                                                  method,
                                                  options,
                                                  callback) {
  var opts = this._newHttpOptions(method);
  if (options) {
    if (typeof(options) === 'function') {
      callback = options;
    } else {
      var headers = opts.headers;
      var path = opts.path + options.path;
      utils.extend(options, opts);
      opts.headers = headers;
      if (options.headers) {
        utils.extend(options.headers, opts.headers);
      }
      opts.path = path;
    }
  }
  if (callback && typeof(callback) !== 'function')
    throw new TypeError('callback must be a function');

  if (opts.query && typeof(opts.query) === 'object') {
    var qs = querystring.stringify(opts.query);
    opts.path = opts.path + ((opts.path.indexOf('?') === -1) ? '?' : '&') + qs;
  }

  if (!(opts.expect instanceof Array)) {
    var _save = opts.expect;
    opts.expect = [];
    if (typeof(_save) === 'number')
      opts.expect.push(_save);
  }

  expect.forEach(function(e) {
    if (opts.expect.indexOf(e) === -1) {
      opts.expect.push(e);
    }
  });

  var obj = {
    options: opts,
    callback: callback
  };

  log.trace('RestClient: _processArguments => %o', obj);
  return obj;
};



module.exports = RestClient;
