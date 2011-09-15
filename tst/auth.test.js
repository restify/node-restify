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
var trickyPassword = 'pass:word';



// --- Tests

exports.setUp = function(test, assert) {
  server = restify.createServer({
    apiVersion: '1.2.3',
    serverName: 'RESTify'
  });

  function authenticate(req, res, next) {
    if (!req.authorization.basic ||
        req.authorization.basic.username !== username ||
        (req.authorization.basic.password !== password &&
         req.authorization.basic.password !== trickyPassword)) {
      res.send(401);
    }
    return next();
  }

  server.get('/test/:name', authenticate, function(req, res, next) {
    res.send(200);
    return next();
  }, restify.log.w3cLog);

  server.listen(socket, function() {
    test.finish();
  });
};


exports.test_ok = function(test, assert) {
  var opts = common.newOptions(socket, '/test/unit');
  opts.method = 'GET';
  opts.headers.authorization = 'Basic ' +
    new Buffer(username + ':' + password, 'utf8').toString('base64');

  http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 200);
    test.finish();
  }).end();
};

exports.test_tricky_password = function(test, assert) {
  var opts = common.newOptions(socket, '/test/unit');
  opts.method = 'GET';
  opts.headers.authorization = 'Basic ' +
    new Buffer(username + ':' + 'pass:word', 'utf8').toString('base64');

  http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 200);
    test.finish();
  }).end();
};

exports.test_no_auth = function(test, assert) {
  var opts = common.newOptions(socket, '/test/unit');
  opts.method = 'GET';

  http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 401);
    test.finish();
  }).end();
};


exports.test_bad_user = function(test, assert) {
  var opts = common.newOptions(socket, '/test/unit');
  opts.method = 'GET';
  opts.headers.authorization = 'Basic ' +
    new Buffer('...:' + password, 'utf8').toString('base64');

  http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 401);
    test.finish();
  }).end();
};


exports.test_bad_scheme = function(test, assert) {
  var opts = common.newOptions(socket, '/test/unit');
  opts.method = 'GET';
  opts.headers.authorization = uuid();

  http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 400);
    test.finish();
  }).end();
};


exports.test_bad_basic = function(test, assert) {
  var opts = common.newOptions(socket, '/test/unit');
  opts.method = 'GET';
  opts.headers.authorization = 'Basic ImNotValidBase64';

  http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 400);
    test.finish();
  }).end();
};

exports.tearDown = function(test, assert) {
  server.on('close', function() {
    test.finish();
  });
  server.close();
};
