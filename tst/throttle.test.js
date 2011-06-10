// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var http = require('httpu');
var uuid = require('node-uuid');

var common = require('./lib/common');
var restify = require('../lib/restify');
restify.log.level(restify.LogLevel.Trace);


// --- Globals

var options = {};
var server = null;
var socket = '/tmp/.' + uuid();
var username = uuid();
var password = uuid();



// --- Tests

exports.setUp = function(test, assert) {
  server = restify.createServer({
    apiVersion: '1.2.3',
    serverName: 'RESTify'
  });

  var throttle = restify.createThrottle({
    requests: 1,
    seconds: 2,
    username: true,
    overrides: {
      'admin': {
        requests: 0,
        seconds: 0
      },
      'special': {
        requests: 3,
        seconds: 1
      }
    }
  });

  server.get('/test/:name',
             function(req, res, next) {
               req.username = req.uriParams.name;
               return next();
             },
             throttle,
             function(req, res, next) {
               res.send(200);
               return next();
             }
            );

  server.listen(socket, function() {
    test.finish();
  });
};


exports.test_ok = function(test, assert) {
  var opts = common.newOptions(socket, '/test/throttleMe');
  opts.method = 'GET';

  http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 200);
    test.finish();
  }).end();
};


exports.test_throttled = function(test, assert) {
  var opts = common.newOptions(socket, '/test/throttleMe');
  opts.method = 'GET';

  http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 403);
    common.checkContent(assert, res, function() {
      assert.ok(res.params);
      assert.equal(res.params.code, 'RequestThrottled');
      assert.ok(res.params.message);
      setTimeout(function() { test.finish(); }, 1000);
    });
  }).end();
};


exports.test_ok_after_window = function(test, assert) {
  var opts = common.newOptions(socket, '/test/throttleMe');
  opts.method = 'GET';

  http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 200);
    test.finish();
  }).end();
};


exports.test_override_limited = function(test, assert) {
  var opts = common.newOptions(socket, '/test/special');
  opts.method = 'GET';

  http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 200);
    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.statusCode, 200);
      test.finish();
    }).end();
  }).end();
};


exports.test_override_unlimited = function(test, assert) {
  var opts = common.newOptions(socket, '/test/admin');
  opts.method = 'GET';

  http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 200);
    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.statusCode, 200);
      test.finish();
    }).end();
  }).end();
};


exports.tearDown = function(test, assert) {
  server.on('close', function() {
    test.finish();
  });
  server.close();
};
