// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var crypto = require('crypto');
var util = require('util');

var HttpClient = require('./http_client');



///--- Helpers


///--- API

function StringClient(options) {
  if (typeof(options) !== 'object')
    throw new TypeError('options (object) required');
  if (typeof(options.log4js) !== 'object')
    throw new TypeError('options.log4js (Object) required');

  if (!options.accept)
    options.accept = 'text/plain';
  if (!options.type)
    options.type = 'text/plain';

  HttpClient.call(this, options);

  this.log4js = options.log4js;
  this.log = this.log4js.getLogger('StringClient');
}
util.inherits(StringClient, HttpClient);
module.exports = StringClient;


StringClient.prototype.post = function post(options, body, callback) {
  var opts = this._options(options);
  if (typeof(body) === 'function') {
    callback = body;
    body = null;
  }
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (Function) required');

  opts.method = 'POST';
  return this.write(opts, body, callback);
};


StringClient.prototype.put = function put(options, body, callback) {
  var opts = this._options(options);
  if (typeof(body) === 'function') {
    callback = body;
    body = null;
  }
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (Function) required');

  opts.method = 'PUT';
  return this.write(opts, body, callback);
};


StringClient.prototype.read = function read(options, callback) {
  if (typeof(options) !== 'object')
    throw new TypeError('options (Object) required');
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (Function) required');

  var self = this;
  return this.request(options, function parse(err, req) {
    if (err)
      return callback(err, req);

    req.end();
    return req.once('result', self.parser(req, callback));
  });
}

StringClient.prototype.write = function write(options, body, callback) {
  if (typeof(options) !== 'object')
    throw new TypeError('options (Object) required');
  if (body !== null && typeof(body) !== 'string')
    throw new TypeError('body (String) required');
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (Function) required');

  var self = this;
  return this.request(options, function write(err, req) {
    if (err)
      return callback(err, req);

    if (body)
      req.write(body);

    req.end();
    return req.once('result', self.parser(req, callback));
  });
};


StringClient.prototype.parser = function parser(req, callback) {
  if (typeof(req) !== 'object')
    throw new TypeError('req (Object) required');
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (Function) required');

  return function parseResponse(err, res) {
    if (err || (res.headers['transfer-encoding'] !== 'chunked' &&
                !res.headers['content-length'])) {
      return callback(err, req, res);
    }

    res.body = '';
    res.setEncoding('utf8');

    var hash;
    if (res.headers['content-md5'])
      hash = crypto.createHash('md5');

    res.on('data', function(chunk) {
      res.body += chunk;
      if (hash)
        hash.update(chunk);
    });

    return res.once('end', function() {
      if (hash && res.headers['content-md5'] !== hash.digest('base64'))
        return callback(new Error('BadDigest'), req, res);

      return callback(null, req, res, res.body);
    });
  };
};

/// Shitty test

// var client = new StringClient({
//   url: 'http://localhost:9080',
//   type: 'application/x-www-form-urlencoded',
//   dtrace: require('dtrace-provider').createDTraceProvider('foo'),
//   log4js: require('../log4js_stub')
// });


// client.get('/foo/moo', function(err, req, res, body) {
//   assert.ifError(err);

//   var str = 'HTTP/1.1 ' + res.statusCode + '\n';
//   Object.keys(res.headers).forEach(function(k) {
//     str += k + ': ' + res.headers[k] + '\n';
//   });

//   str += '\n' + body;
//   console.log('\n\n%s\n\n', str);
// });

// var qs = require('querystring');
// client.post('/foo/moo', qs.stringify({be: 'bop'}), function(err, req, res, body) {
//   assert.ifError(err);

//   var str = 'HTTP/1.1 ' + res.statusCode + '\n';
//   Object.keys(res.headers).forEach(function(k) {
//     str += k + ': ' + res.headers[k] + '\n';
//   });

//   str += '\n' + body;
//   console.log('\n\n%s\n\n', str);
// });
