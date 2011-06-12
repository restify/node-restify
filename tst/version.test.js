// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var fs = require('fs');
var http = require('httpu');
var uuid = require('node-uuid');

var common = require('./lib/common');
var restify = require('../lib/restify');

var log = restify.log;
log.level(log.Level.Trace);



// --- Globals

var socket = '/tmp/.' + uuid();


var _handler = function(req, res, next) {
  res.send(200);
  return next();
};



// --- Helpers

function _pad(val) {
  if (parseInt(val, 10) < 10) {
    val = '0' + val;
  }
  return val;
}


function _rfc822(date) {
  var months = ['Jan',
                'Feb',
                'Mar',
                'Apr',
                'May',
                'Jun',
                'Jul',
                'Aug',
                'Sep',
                'Oct',
                'Nov',
                'Dec'];
  var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getUTCDay()] + ', ' +
    _pad(date.getUTCDate()) + ' ' +
    months[date.getUTCMonth()] + ' ' +
    date.getUTCFullYear() + ' ' +
    _pad(date.getUTCHours()) + ':' +
    _pad(date.getUTCMinutes()) + ':' +
    _pad(date.getUTCSeconds()) +
    ' GMT';
}



// --- Tests

exports.test_no_version = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.statusCode, 200);
      assert.ok(!res.headers['x-api-version']);
      assert.equal(res.headers.server, 'node.js');
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_default_version = function(test, assert) {
  var server = restify.createServer({
    apiVersion: '1.2.3'
  });
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.headers['x-api-version'], '1.2.3');
      assert.equal(res.headers.server, 'node.js');
      assert.equal(res.statusCode, 200);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_explicit_version = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('1.2.3', '/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.headers['x-api-version'], '1.2.3');
      assert.equal(res.headers.server, 'node.js');
      assert.equal(res.statusCode, 200);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_multiple_version = function(test, assert) {
  var server = restify.createServer({
    version: '1.2.3'
  });
  var socket = '/tmp/.' + uuid();

  server.get('1.2.4', '/', function(req, res, next) { return res.send(201); });
  server.get('/', function(req, res, next) { return res.send(200); });
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.ok(res.headers['x-api-version'], '1.2.3');
      assert.equal(res.headers.server, 'node.js');
      assert.equal(res.statusCode, 200);

      opts = common.newOptions(socket, '/');
      opts.headers['x-api-version'] = '1.2.4';
      http.request(opts, function(res) {
        common.checkResponse(assert, res);
        assert.equal(res.headers['x-api-version'], '1.2.4');
        assert.equal(res.statusCode, 201);
        server.on('close', function() {
          test.finish();
        });
        server.close();
      }).end();
    }).end();
  });
};


exports.test_no_semver = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('v1', '/', function(req, res, next) { return res.send(200); });
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    opts.headers['X-Api-Version'] = 'v1';
    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.headers['x-api-version'], 'v1');
      assert.equal(res.statusCode, 200);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_semver = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('1.2.3', '/', function(req, res, next) { return res.send(200); });
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    opts.headers['X-Api-Version'] = '>=1.2';
    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.headers['x-api-version'], '1.2.3');
      assert.equal(res.statusCode, 200);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_invalid_version = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('1.2.3', '/', function(req, res, next) { return res.send(200); });
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    opts.headers['X-Api-Version'] = '>=2.2';
    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.statusCode, 449);
      assert.ok(res.headers['x-api-versions']);
      console.log(JSON.stringify(res.headers, null, 2));
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};
