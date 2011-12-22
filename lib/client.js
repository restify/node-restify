// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var crypto = require('crypto');
var EventEmitter = require('events').EventEmitter;
var http = require('http');
var https = require('https');
var url = require('url');
var util = require('util');

var d = require('dtrace-provider');
var retry = require('retry');

var errors = require('./errors');



///-- Globals

var httpError = errors.codeToHttpError;



///--- Helpers

function request(options, callback) {
  assert.ok(options);

  var done = false;
  function _callback(err, req) {
    if (done)
      return false;

    done = true;
    return callback(err, req);
  }

  var operation = retry.operation(options.retry);
  var proto = options.protocol === 'https:' ? https : http;

  return operation.attempt(function retryCallback(currentAttempt) {
    var req = proto.request(options, function requestCallback(res) {
      var err = null;
      if (res.statusCode >= 400)
        err = httpError(res.statusCode);

      return req.emit('result', err, res);
    });

    req.once('error', function onError(err) {
      if (!operation.retry(err))
        return _callback(operation.mainError() || err);

      return false;
    });

    req.once('socket', function onSocket(socket) {
      if (socket.writable)
        return _callback(null, req);

      return socket.once('connect', function onConnect() {
        return _callback(null, req);
      });
    });
  });
}



function read(options, callback) {

  return request(options, function readRequestCallback(connectErr, req) {
    if (connectErr || (!options.readResponse && !options.json)) {
      req.end();
      return callback(connectErr, req);
    }

    req.once('result', function onResult(err, res) {
      if (err || (res.headers['transfer-encoding'] !== 'chunked' &&
                  !res.headers['content-length'])) {
        return callback(err, req, res);
      }

      var hash;
      if (res.headers['content-md5'])
        hash = crypto.createHash('md5');

      res.body = '';
      res.setEncoding('utf8');
      res.on('data', function(chunk) {
        res.body += chunk;
        if (hash)
          hash.update(chunk);
      });

      res.once('end', function() {
        if (hash && res.headers['content-md5'] !== hash.digest('base64'))
          return callback(new Error('BadDigest'), req, res);

        var obj;
        if (options.json) {
          try {
            obj = JSON.parse(res.body);
          } catch (e) {
            return callback(e, req, res);
          }
        }

        return callback(null, req, res, obj || res.body);
      });

      return false;
    });

    return req.end();
  });
}


///--- API

function Client(options) {
  if (typeof(options) !== 'object')
    throw new TypeError('options (object) required');
  if (typeof(options.log4js) !== 'object')
    throw new TypeError('options.log4js (Object) required');
  if (typeof(options.url) !== 'string')
    throw new TypeError('options.url (String) required');

  EventEmitter.call(this);

  this.json = options.json || false;
  this.headers = options.headers || {};
  this.log4js = options.log4js;
  this.log = this.log4js.getLogger('Client');
  this.readResponse = options.readResponse || this.json || false;
  this.retry = options.retry || { retries: 3 };
  this.timeout = options.timeout || false;
  this.url = url.parse(options.url);
}
util.inherits(Client, EventEmitter);
module.exports = Client;


Client.prototype.get = function get(options, callback) {
  var opts = this._options(options);
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (Function) required');

  opts.method = 'GET';
  return read(opts, callback);
};


Client.prototype.getJSON = function getJSON(options, callback) {
  var opts = this._options(options);
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (Function) required');

  opts.method = 'GET';
  opts.json = true;
  return read(opts, callback);
};


Client.prototype.head = function head(options, callback) {
  var opts = this._options(options);
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (Function) required');

  opts.method = 'HEAD';
  return read(opts, callback);
};


Client.prototype._options = function(options) {
  if (typeof(options) !== 'object') {
    if (typeof(options) !== 'string')
      throw new TypeError('path (String) required');

    options = { path: options };
  }

  var self = this;
  var opts = {
    agent: options.agent || self.agent,
    headers: options.headers || {},
    json: options.json || self.json,
    path: options.path || self.path,
    readResponse: options.readResponse || self.readResponse || self.json,
    retry: options.retry || self.retry
  };

  Object.keys(self.url).forEach(function(k) {
    if (!opts[k])
      opts[k] = self.url[k];
  });

  Object.keys(self.headers).forEach(function(k) {
    if (!opts.headers[k])
      opts.headers[k] = self.headers[k];
  });

  return opts;
};





/// Shitty test

var client = new Client({
  url: 'http://localhost:9080',
  log4js: require('./log4js_stub')
});


client.getJSON('/foo/bar', function(err, req, res, obj) {
  assert.ifError(err);

  var str = 'HTTP/1.1 ' + res.statusCode + '\n';
  Object.keys(res.headers).forEach(function(k) {
    str += k + ': ' + res.headers[k] + '\n';
  });

  str += '\n' + JSON.stringify(obj, null, 2);

  console.log('\n\n%s\n\n', str);
});


client.get('/foo/moo', function(connectErr, req) {
  assert.ifError(connectErr);

  req.on('result', function(err, res) {
    assert.ifError(err);
    res.body = '';
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      res.body += chunk;
    });

    res.on('end', function() {
      var str = 'HTTP/1.1 ' + res.statusCode + '\n';
      Object.keys(res.headers).forEach(function(k) {
        str += k + ': ' + res.headers[k] + '\n';
      });

      str += '\n' + res.body;
      console.log('\n\n%s\n\n', str);
    });
  });
});
