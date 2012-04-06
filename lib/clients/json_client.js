// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var crypto = require('crypto');
var util = require('util');

var codeToHttpError = require('../errors/http_error').codeToHttp;
var RestError = require('../errors').RestError;
var StringClient = require('./string_client');



///--- API

function JsonClient(options) {
  if (typeof (options) !== 'object')
    throw new TypeError('options (object) required');

  options.accept = 'application/json';
  options.name = options.name || 'JsonClient';
  options.contentType = 'application/json';

  StringClient.call(this, options);

  this._super = StringClient.prototype;
}
util.inherits(JsonClient, StringClient);
module.exports = JsonClient;


JsonClient.prototype.write = function write(options, body, callback) {
  if (typeof (options) !== 'object')
    throw new TypeError('options (Object) required');
  if (body !== null && typeof (body) !== 'object')
    throw new TypeError('body (Object) required');
  if (typeof (callback) !== 'function')
    throw new TypeError('callback (Function) required');

  body = JSON.stringify(body);
  return this._super.write.call(this, options, body, callback);
};


JsonClient.prototype.parse = function parse(req, callback) {
  if (typeof (req) !== 'object')
    throw new TypeError('req (Object) required');
  if (typeof (callback) !== 'function')
    throw new TypeError('callback (Function) required');

  return this._super.parse.call(this, req, function (err, req, res, data) {
    var obj;
    try {
      if (data) {
        obj = JSON.parse(data);
      } else {
        obj = {};
      }
    } catch (e) {
      return callback(e, req, res, null);
    }

    if (res && res.statusCode >= 400) {
      // Upcast error to a RestError (if we can)
      // Be nice and handle errors like { error: { code: '', message: '' } }
      // in addition to { code: '', message: '' }.
      if (obj.code || (obj.error && obj.error.code)) {
        err = new RestError(res.statusCode,
                            obj.code || obj.error.code,
                            obj.message || obj.error.message);
      } else if (!err) {
        err = codeToHttpError(res.statusCode, obj.message || '', data);
      }
    }

    if (err)
      err.body = obj;

    return callback((err || null), req, res, obj);
  });
};
