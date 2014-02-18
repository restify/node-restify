// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');
var fs = require('fs');
var http = require('http');

var filed = require('filed');
var uuid = require('node-uuid');

var HttpError = require('../lib/errors').HttpError;
var RestError = require('../lib/errors').RestError;
var restify = require('../lib');

if (require.cache[__dirname + '/lib/helper.js'])
  delete require.cache[__dirname + '/lib/helper.js'];
var helper = require('./lib/helper.js');


///--- Globals

var after = helper.after;
var before = helper.before;
var test = helper.test;

var PORT = process.env.UNIT_TEST_PORT || 0;
var CLIENT;
var SERVER;


///--- Tests

before(function (cb) {
  try {
    SERVER = restify.createServer({
      dtrace: helper.dtrace,
      log: helper.getLog('server'),
      version: ['2.0.0', '0.5.4', '1.4.3'],
      etag: true
    });
    SERVER.listen(PORT, '127.0.0.1', function () {
      PORT = SERVER.address().port;
      CLIENT = restify.createJsonClient({
        url: 'http://127.0.0.1:' + PORT,
        dtrace: helper.dtrace,
        retry: false
      });

      cb();
    });
  } catch (e) {
    console.error(e.stack);
    process.exit(1);
  }
});


after(function (cb) {
  try {
    CLIENT.close();
    SERVER.close(function () {
      CLIENT = null;
      SERVER = null;
      cb();
    });
  } catch (e) {
    console.error(e.stack);
    process.exit(1);
  }
});


test('ETag header should be valid', function (t) {
  SERVER.get('/', function tester(req, res, next) {
    res.send('hello world');
    next();
  });

  CLIENT.get('/', function (err, _, res, obj) {
    t.ifError(err);
    t.equal(res.statusCode, 200);
    t.equal(res.headers.etag, '"1027534212"');
    t.equal(obj, 'hello world');
    t.end();
  });
});


test('Custom ETag header shouldn\'t be overwritten', function (t) {
  SERVER.get('/', function tester(req, res, next) {
    res.header('ETag', 'myETag');
    res.send('hello world');
    next();
  });

  CLIENT.get('/', function (err, _, res, obj) {
    t.ifError(err);
    t.equal(res.statusCode, 200);
    t.equal(res.headers.etag, 'myETag');
    t.equal(obj, 'hello world');
    t.end();
  });
});


test('Response should be 304', function (t) {
  SERVER.get('/', function tester(req, res, next) {
    res.send('hello world');
    next();
  });

  var opts = {
    hostname: '127.0.0.1',
    port: PORT,
    path: '/',
    method: 'GET',
    agent: false,
    headers: {
      'if-none-match': '"1027534212"'
    }
  };
  http.request(opts, function (res) {
    t.equal(res.statusCode, 304);
    t.equal(res.headers.etag, '"1027534212"');
    t.end();
  }).end();
});


test('Non matching "if-none-match" header should be 200', function (t) {
  SERVER.get('/', function tester(req, res, next) {
    res.send('hello world');
    next();
  });

  var opts = {
    hostname: '127.0.0.1',
    port: PORT,
    path: '/',
    method: 'GET',
    agent: false,
    headers: {
      'if-none-match': '"aaa"'
    }
  };
  http.request(opts, function (res) {
    t.equal(res.statusCode, 200);
    t.equal(res.headers.etag, '"1027534212"');
    t.end();
  }).end();
});
