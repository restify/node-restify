// Copyright 2012 Mark Cavage <mcavage@gmail.com> All rights reserved.

var http = require('http');

var d = require('dtrace-provider');
var Logger = require('bunyan');
var test = require('tap').test;
var uuid = require('node-uuid');

var createClient = require('../lib').createClient;
var HttpError = require('../lib/errors').HttpError;
var RestError = require('../lib/errors').RestError;
var Request = require('../lib/request');
var Response = require('../lib/response');
var restify = require('../lib');
var throttle = require('../lib/plugins/throttle');



///--- Globals

var DTRACE = d.createDTraceProvider('throttleUnitTest');
var PORT = process.env.UNIT_TEST_PORT || 12345;
var client;
var server;
var username = uuid();
var password = uuid();



//--- Tests

test('setup', function (t) {
  server = restify.createServer({
    dtrace: DTRACE
  });
  t.ok(server);

  server.use(function (req, res, next) {
    if (req.params.name)
      req.username = req.params.name;

    return next();
  });

  server.use(throttle({
    burst: 1,
    rate: 0.5,
    username: true,
    overrides: {
      'admin': {
        burst: 0,
        rate: 0
      },
      'special': {
        burst: 3,
        rate: 1
      }
    }
  }));

  server.get('/test/:name', function (req, res, next) {
    res.send();
    return next();
  });

  server.listen(PORT, '127.0.0.1', function () {
    client = createClient({
      dtrace: DTRACE,
      name: 'throttleUnitTest',
      type: 'string',
      url: 'http://127.0.0.1:' + PORT
    });
    t.ok(client);
    t.end();
  });
});


test('ok', function (t) {
  client.get('/test/throttleMe', function (err, req, res, body) {
    t.ifError(err);
    t.equal(res.statusCode, 200);
    t.end();
  });
});


test('throttled', function (t) {
  client.get('/test/throttleMe', function (err, req, res, body) {
    t.ok(err);
    t.equal(err.statusCode, 429);
    t.ok(err.message);
    t.equal(res.statusCode, 429);
    setTimeout(function () { t.end(); }, 2100);
  });
});


test('ok after tokens', function (t) {
  client.get('/test/throttleMe', function (err, req, res, body) {
    t.ifError(err);
    t.equal(res.statusCode, 200);
    t.end();
  });
});


test('override limited', function (t) {
  client.get('/test/special', function (err, req, res, body) {
    t.ifError(err);
    t.equal(res.statusCode, 200);
    t.end();
  });
});


test('override limited (not throttled)', function (t) {
  client.get('/test/special', function (err, req, res, body) {
    t.ifError(err);
    t.equal(res.statusCode, 200);
    t.end();
  });
});


test('override unlimited', function (t) {
  client.get('/test/admin', function (err, req, res, body) {
    t.ifError(err);
    t.equal(res.statusCode, 200);
    t.end();
  });
});


test('override unlimited (not throttled)', function (t) {
  client.get('/test/admin', function (err, req, res, body) {
    t.ifError(err);
    t.equal(res.statusCode, 200);
    t.end();
  });
});


test('teardown', function (t) {
  server.close(function () {
    t.end();
  });
});
