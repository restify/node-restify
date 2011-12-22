// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var crypto = require('crypto');
var EventEmitter = require('events').EventEmitter;
var http = require('http');
var https = require('https');
var url = require('url');
var util = require('util');

var mime = require('mime');
var retry = require('retry');

var errors = require('../errors');



///-- Globals

var httpError = errors.codeToHttpError;



///--- API

function HttpClient(options) {
  if (typeof(options) !== 'object')
    throw new TypeError('options (object) required');
  if (typeof(options.dtrace) !== 'object')
    throw new TypeError('options.dtrace (Object) required');
  if (typeof(options.log4js) !== 'object')
    throw new TypeError('options.log4js (Object) required');
  if (typeof(options.url) !== 'string')
    throw new TypeError('options.url (String) required');

  EventEmitter.call(this);

  this.headers = options.headers || {};
  this.log4js = options.log4js;
  this.log = this.log4js.getLogger('Client');
  this.retry = options.retry || { retries: 3 };
  this.timeout = options.timeout || false;
  this.url = url.parse(options.url);
  this.version = options.version || false;

  if (options.accept) {
    if (options.accept.indexOf('/') === -1)
      options.accept = mime.lookup(options.accept);

    this.headers.accept = options.accept;
  }

  if (options.type) {
    if (options.type.indexOf('/') === -1)
      options.type = mime.lookup(options.type);

    this.headers['content-type'] = options.type;
  }
}
util.inherits(HttpClient, EventEmitter);
module.exports = HttpClient;


HttpClient.prototype.del = function del(options, callback) {
  var opts = this._options(options);
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (Function) required');

  opts.method = 'DELETE';
  return this.read(opts, callback);
};


HttpClient.prototype.get = function get(options, callback) {
  var opts = this._options(options);
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (Function) required');

  opts.method = 'GET';
  return this.read(opts, callback);
};


HttpClient.prototype.head = function head(options, callback) {
  var opts = this._options(options);
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (Function) required');

  opts.method = 'HEAD';
  return this.read(opts, callback);
};


HttpClient.prototype.post = function post(options, callback) {
  var opts = this._options(options);
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (Function) required');

  opts.method = 'POST';
  return this.request(opts, callback);
};


HttpClient.prototype.put = function put(options, callback) {
  var opts = this._options(options);
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (Function) required');

  opts.method = 'PUT';
  return this.request(opts, callback);
};


HttpClient.prototype.read = function read(options, callback) {
  if (typeof(options) !== 'object')
    throw new TypeError('options (Object) required');
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (Function) required');

  return this.request(options, function readRequestCallback(err, req) {
    if (!err)
      req.end();

    return callback(err, req);
  });
};

HttpClient.prototype.request = function request(options, callback) {
  if (typeof(options) !== 'object')
    throw new TypeError('options (Object) required');
  if (typeof(callback) !== 'function')
    throw new TypeError('callback (Function) required');

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
};



HttpClient.prototype._options = function(options) {
  if (typeof(options) !== 'object') {
    if (typeof(options) !== 'string')
      throw new TypeError('path (String) required');

    options = { path: options };
  }

  var self = this;
  var opts = {
    agent: options.agent || self.agent,
    headers: options.headers || {},
    path: options.path || self.path,
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

  if (this.version)
    opts.headers['Accept-Version'] = this.version;

  return opts;
};




/*
/// Shitty test

var client = new HttpClient({
  url: 'http://localhost:9080',
  dtrace: require('dtrace-provider'),
  log4js: require('../log4js_stub')
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


var opts = {
  path: '/foo/boo',
  headers: {
    'content-type': 'application/x-www-form-urlencoded',
  }
};
client.post(opts, function(connectErr, req) {
  assert.ifError(connectErr);

  req.write('pet=dog&name=snoopy');
  req.end();

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
*/
