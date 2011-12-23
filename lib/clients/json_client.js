// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var crypto = require('crypto');
var util = require('util');

var StringClient = require('./string_client');



///--- API

function JSONClient(options) {
  if (typeof(options) !== 'object')
    throw new TypeError('options (object) required');
  if (typeof(options.log4js) !== 'object')
    throw new TypeError('options.log4js (Object) required');

  options.accept = 'application/json';
  options.type = 'application/json';

  if (!options.name)
    options.name = 'JSONClient';

  StringClient.call(this, options);

  this._super = StringClient.prototype;
}
util.inherits(JSONClient, StringClient);
module.exports = JSONClient;


JSONClient.prototype.write = function write(options, body, callback) {
  if (typeof(options) !== 'object')
    throw new TypeError('options (Object) required');
  if (body !== null && typeof(body) !== 'object')
    throw new TypeError('body (Object) required');
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (Function) required');

  body = JSON.stringify(body);
  return this._super.write.call(this, options, body, callback);
};


JSONClient.prototype.parser = function parser(req, callback) {
  if (typeof(req) !== 'object')
    throw new TypeError('req (Object) required');
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (Function) required');

  var self = this;
  return this._super.parser.call(this, req, function(err, req, res, data) {
    if (err)
      return callback(err, req, res, data);

    try {
      return callback(err, req, res, (data ? JSON.parse(data) : {}));
    } catch (e) {
      return callback(e, req, res, data);
    }
  });
};




// /// Shitty test

var log4js = require('../log4js_stub')
log4js.setGlobalLogLevel('TRACE');
var client = new JSONClient({
  url: 'http://localhost:9080',
  name: 'MooClient',
  dtrace: require('dtrace-provider').createDTraceProvider('foo'),
  log4js: log4js
});


client.get('/foo/moo', function(err, req, res, obj) {
  assert.ifError(err);

  console.log(JSON.stringify(obj, null, 2));
});


client.post('/foo/moo', {be: 'bop'}, function(err, req, res, obj) {
  assert.ifError(err);

  console.log(JSON.stringify(obj, null, 2));
});
