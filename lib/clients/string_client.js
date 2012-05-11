// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var crypto = require('crypto');
var qs = require('querystring');
var util = require('util');

var HttpClient = require('./http_client');



///--- Helpers


///--- API

function StringClient(options) {
  if (typeof (options) !== 'object')
    throw new TypeError('options (object) required');

  options.accept = options.accept || 'text/plain';
  options.name = options.name || 'StringClient';
  options.contentType =
    options.contentType || 'application/x-www-form-urlencoded';

  HttpClient.call(this, options);
}
util.inherits(StringClient, HttpClient);
module.exports = StringClient;


StringClient.prototype.post = function post(options, body, callback) {
  var opts = this._options('POST', options);
  if (typeof (body) === 'function') {
    callback = body;
    body = null;
  }
  if (typeof (callback) !== 'function')
    throw new TypeError('callback (Function) required');

  return this.write(opts, body, callback);
};


StringClient.prototype.put = function put(options, body, callback) {
  var opts = this._options('PUT', options);
  if (typeof (body) === 'function') {
    callback = body;
    body = null;
  }
  if (typeof (callback) !== 'function')
    throw new TypeError('callback (Function) required');

  return this.write(opts, body, callback);
};


StringClient.prototype.read = function read(options, callback) {
  if (typeof (options) !== 'object')
    throw new TypeError('options (Object) required');
  if (typeof (callback) !== 'function')
    throw new TypeError('callback (Function) required');

  var self = this;
  return this.request(options, function parse(err, req) {
    if (err)
      return callback(err, req);

    req.end();
    return req.once('result', self.parse(req, callback));
  });
};


StringClient.prototype.write = function write(options, body, callback) {
  if (typeof (options) !== 'object')
    throw new TypeError('options (Object) required');
  if (body !== null && typeof (body) !== 'string') {
    if (typeof (body) !== 'object')
      throw new TypeError('body (String) required');

    body = qs.stringify(body);
  }
  if (typeof (callback) !== 'function')
    throw new TypeError('callback (Function) required');

  var self = this;
  options.headers = options.headers || {};
  options.headers['content-length'] = Buffer.byteLength(body);

  var hash = crypto.createHash('md5');
  hash.update(body);
  options.headers['content-md5'] = hash.digest('base64');

  return this.request(options, function write(err, req) {
    if (err)
      return callback(err, req);

    if (body) {
      self.log.trace('sending body -> %s', body);
      req.end(body);
    } else {
      req.end();
    }

    return req.once('result', self.parse(req, callback));
  });
};


StringClient.prototype.parse = function parse(req, callback) {
  if (typeof (req) !== 'object')
    throw new TypeError('req (Object) required');
  if (typeof (callback) !== 'function')
    throw new TypeError('callback (Function) required');

  return function parseResponse(err, res) {
    if (res) {
      if (res.headers['transfer-encoding'] !== 'chunked' &&
          !res.headers['content-length']) {
        return callback(err, req, res);
      }

      var body = '';
      res.setEncoding('utf8');

      var hash;
      if (res.headers['content-md5'] && req.method !== 'HEAD')
        hash = crypto.createHash('md5');

      res.on('data', function (chunk) {
        body += chunk;
        if (hash)
          hash.update(chunk);
      });

      return res.once('end', function () {
        res.log.trace('body received:\n%s', body);

        res.body = body;

        if (hash && res.headers['content-md5'] !== hash.digest('base64'))
          return callback(new Error('BadDigest'), req, res);

        if (err) {
          err.body = body;
          err.message = body;
        }

        return callback(err, req, res, body);
      });
    } else {
      return callback(err, req, null, null);
    }
  };
};
