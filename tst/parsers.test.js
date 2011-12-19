// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var http = require('http');

var test = require('tap').test;
var uuid = require('node-uuid');

var HttpError = require('../lib/errors').HttpError;
var RestError = require('../lib/errors').RestError;
var log4js = require('../lib/log4js_stub');
var parsers = require('../lib/plugins');
var Request = require('../lib/request');
var Response = require('../lib/response');
var Server = require('../lib/server');



///--- Globals

var PORT = process.env.UNIT_TEST_PORT || 12345;
var SERVER;



///--- Helpers

function request(path, headers, callback) {
  if (typeof(path) === 'function') {
    callback = path;
    path = headers = false;
  }

  var opts = {
    hostname: '127.0.0.1',
    port: PORT,
    path: path || '/foo/bar',
    agent: false,
    method: 'GET',
    headers: headers || {}
  };

  return http.request(opts, callback);
}




///--- Tests

test('setup', function(t) {
  SERVER = new Server({
    log4js: log4js
  });

  SERVER.use(parsers.acceptParser(SERVER.acceptable));
  SERVER.use(parsers.authorizationParser());
  SERVER.use(parsers.dateParser());
  SERVER.use(parsers.queryParser());

  SERVER.get('/foo/:id', function(req, res, next) {
    res.send();
    return next();
  });

  SERVER.listen(PORT, '127.0.0.1', function() {
    t.end();
  });
});


test('accept ok', function(t) {
  request(function(res) {
    t.equal(res.statusCode, 200);
    t.end();
  }).end();
});


test('406', function(t) {
  request('/foo/bar', { accept: 'foo/bar' }, function(res) {
    t.equal(res.statusCode, 406);
    t.end();
  }).end();
});


test('authorization basic ok', function(t) {
  var authz = 'Basic ' + new Buffer('user:secret').toString('base64');
  request('/foo/bar', { authorization: authz }, function(res) {
    t.equal(res.statusCode, 200);
    t.end();
  }).end();
});


test('authorization basic invalid', function(t) {
  var authz = 'Basic bogus';
  request('/foo/bar', { authorization: authz }, function(res) {
    t.equal(res.statusCode, 400);
    t.end();
  }).end();
});


test('teardown', function(t) {
  SERVER.close(function() {
    t.end();
  });
});
