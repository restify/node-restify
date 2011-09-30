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
 */
function RestClient(options) {
  if (!options)
    throw new TypeError('options is required');

  // Sigh - this is a hack to enable a large project setting the verbosity
  // of the client to something higher than the default trace without turning
  // up everything (This is useful so you don't have to run wireshark...).
  // This is *not* documented!
  this._log = options._log || log.trace;

  // Stupid JS not having an XOR, and jslint hating the tricky way...
  if (!(options.url || options.socketPath) ||
      (options.url && options.socketPath))
    throw new TypeError('One of options.url, options.socketPath are required');

  if (options.url) {
    this.url = url.parse(options.url);
    this.proto = http;
    if (this.url.protocol === 'https:') {
      this.proto = https;
    } else if (this.url.protocol !== 'http:') {
      throw new TypeError('Invalid URL (protocol): ' + options.url);
    }
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
  if (!this.path &&
      this.url &&
      this.url.pathname &&
      !(this.url.pathname === '/' &&
        options.url[options.url.length - 1] !== '/')) {
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

  this.retryCallback = options.retryCallback || function checkFor50x(code) {
    if (code >= 500)
      return true;
    return false;
  };

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
 * @param {Object} options (optional) with:
 *   - path: resource path.
 *   - body: a JS object that will get marshalled to JSON.
 *   - query: (optional) query params, as object.
 *   - headers: any additional headers to tack on.
 *   - expect: expected HTTP status code. Defaults to 204.
 * @param {Function} callback of the form f(err, obj, headers).
 */
RestClient.prototype.put = function(options, callback) {
  var args = this._processArguments([200, 201], 'PUT', options, callback);
  var opts = args.options;
  var cb = args.callback;

  this._request(args.options, function(err, code, headers, obj, res) {
    if (err) return cb(err);
    if (opts.expect.indexOf(code) === -1) {
      return cb(newError({
        httpCode: code,
        restCode: (obj && obj.code) ? obj.code : undefined,
        message: (obj && obj.message) ? obj.message : obj,
        details: {
          expected: opts.expect,
          statusCode: code,
          headers: headers,
          object: obj
        }
      }));
    }

    return cb(null, obj, headers, res);
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
 * @param {Function} callback of the form function(err, headers).
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
        restCode: (obj && obj.code) ? obj.code : undefined,
        message: (obj && obj.message) ? obj.message : obj,
        details: {
          expected: opts.expect,
          statusCode: code,
          headers: headers,
          object: obj
        }
      }));
    }

    return cb(null, obj, headers, res);
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
 * @param {Function} callback of the form f(err, obj, headers).
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
        restCode: (obj && obj.code) ? obj.code : undefined,
        message: (obj && obj.message) ? obj.message : obj,
        details: {
          expected: opts.expect,
          statusCode: code,
          headers: headers,
          object: obj
        }
      }));
    }

    return cb(null, obj, headers, res);
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
 * @param {Function} callback of the form function(err, headers).
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
        restCode: (obj && obj.code) ? obj.code : undefined,
        message: (obj && obj.message) ? obj.message : obj,
        details: {
          expected: opts.expect,
          statusCode: code,
          headers: headers,
          object: obj
        }
      }));
    }

    return cb(null, headers, res);
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
 * @param {Function} callback of the form function(err, headers).
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
        restCode: (obj && obj.code) ? obj.code : undefined,
        message: (obj && obj.message) ? obj.message : obj,
        details: {
          expected: opts.expect,
          statusCode: code,
          headers: headers,
          object: obj
        }
      }));
    }

    return cb(null, headers, res);
  });
};


RestClient.prototype._request = function(options, callback) {
  assert.ok(options);
  assert.ok(callback);

  var _id = uuid().replace(/-/, '').substr(0, 7); // logging only

  var self = this;

  if (!options.path)
    options.path = '/';

  options.path = options.path.replace(/\/+/g, '/');

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

    if (!data && typeof(options.body) !== 'object')
      data = options.body + '';

    if (data) {
      hash.update(data);
      options.headers['content-type'] = options.contentType;
      options.headers['content-length'] = Buffer.byteLength(data, 'utf8');
      options.headers['content-md5'] = hash.digest('base64');
    } else {
      options.headers['content-length'] = 0;
    }
  } else {
    options.headers['content-length'] = 0;
  }

  var operation = retry.operation(self.retryOptions);
  operation.attempt(function(attempt) {
    if (!options.headers.Date)
      options.headers.Date = utils.newHttpDate(new Date());

    self._log.call(log, 'RestClient(%s, attempt=%d): issuing request %o',
                   _id, attempt, options);

    var req = self.proto.request(options, function(res) {
      self._log.call(log, 'RestClient(%s): %s %s => code=%d, headers=%o', _id,
                     options.method, options.path, res.statusCode, res.headers);

      var err = null;
      res.setEncoding('utf8');
      res.body = '';

      function endResponse() {
        self._log.call(log, 'RestClient(%s): %s %s => body=%s', _id,
                       options.method, options.path, res.body);

        if (self.retryCallback(res.statusCode)) {
          if (operation.retry(new Error()))
            return;

          return callback(newError({
            httpCode: res.statusCode,
            restCode: RestCodes.RetriesExceeded,
            message: 'Maximum number of retries exceeded: ' + attempt,
            headers: res.headers,
            details: res.body
          }));
        }

        if (res.headers['content-length']) {
          var len = parseInt(res.headers['content-length'], 10);
          var actualLen = Buffer.byteLength(res.body);
          if (actualLen !== len) {
            log.trace('RestClient: %s %s, content-length mismatch',
                      options.method, options.path);
            if (operation.retry(new Error())) return;

            return callback(newError({
              httpCode: HttpCodes.InternalError,
              restCode: RestCodes.InvalidHeader,
              message: 'Content-Length ' + len + ' didn\'t match: ' +
                actualLen,
              headers: res.headers,
              details: res.body
            }));
          }
        }

        if (res.headers['content-md5'] && !self.noContentMD5 &&
            options.method !== 'HEAD') {
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
                ' didn\'t match: ' + digest,
              headers: res.headers,
              details: res.body
            });
            if (operation.retry(err)) return;
            return callback(err);
          }
        }

        if (res.body.length > 0) {
          var ct = res.headers['content-type'].split(';')[0];
          switch (ct) {

          case 'application/json':
            try {
              res.params = JSON.parse(res.body);
            } catch (e) {
              return callback(newError({
                httpCode: HttpCodes.InternalError,
                restCode: RestCodes.InvalidHeader,
                message: 'Content-Type was JSON, but it\'s not parsable',
                error: e,
                headers: res.headers,
                details: res.body
              }));
            }
            break;

          case 'application/x-www-form-urlencoded':
            res.params = querystring.parse(res.body);
            break;

          default:
            res.params = res.body;
            break;
          }
        }

        log.trace('RestClient: %s %s: issuing callback',
                  options.method, options.path);
        callback(null, res.statusCode, res.headers, res.params, res);
      }

      if (res.headers['content-length'] ||
          res.headers['transfer-encoding'] === 'chunked') {
        res.on('data', function(chunk) {
          res.body = res.body + chunk;
        });
        res.on('end', endResponse);
      } else {
        endResponse();
      }
    });

    req.on('error', function(err) {
      if (!operation.retry(err)) {
        return callback(newError({
          httpCode: HttpCodes.InternalError,
          restCode: RestCodes.RetriesExceeded,
          error: err,
          message: err.message
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
    contentType: self.contentType,
    headers: {},
    method: method,
    path: self.path.toString()
  };
  utils.extend(self.headers, opts.headers);
  if (self.url) {
    opts.host = self.url.hostname.toString();
    opts.port = (self.url.port ||
                 (self.url.protocol === 'https:' ? 443 : 80)).toString();
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
    } else if (typeof(options) === 'string') {
      opts.path = options;
    } else if (typeof(options) === 'object') {
      var path = opts.path;
      if (options.path)
        path += options.path;

      var headers = opts.headers;
      utils.extend(options, opts);
      opts.path = path;
      opts.headers = headers;
      if (options.headers)
        utils.extend(options.headers, opts.headers);
    } else {
      throw new TypeError('options is an invalid type: ' + typeof(options));
    }
  }

  if (!callback || typeof(callback) !== 'function')
    throw new TypeError('callback must be a function');

  if (opts.query && typeof(opts.query) === 'object') {
    var qs = querystring.stringify(opts.query);
    var qsExists = (opts.path.indexOf('?') === -1);
    if (qs)
      opts.path = opts.path + (qsExists ? '?' : '&') + qs;
  }

  if (!opts.expect)
    opts.expect = [];

  if (!(opts.expect instanceof Array)) {
    var _save = opts.expect;
    opts.expect = [];
    if (typeof(_save) === 'number')
      opts.expect.push(_save);
  }

  if (!opts.expect.length) {
    expect.forEach(function(e) {
      if (opts.expect.indexOf(e) === -1) {
        opts.expect.push(e);
      }
    });
  }

  var obj = {
    options: opts,
    callback: callback
  };

  log.trace('RestClient: _processArguments => %o', obj);
  return obj;
};



module.exports = RestClient;
