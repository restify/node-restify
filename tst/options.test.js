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

exports.test_options_with_resource = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.put('/', _handler);
  server.del('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    opts.method = 'OPTIONS';

    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.statusCode, 200);
      assert.ok(res.headers.allow);
      assert.ok(res.headers.allow, 'GET, PUT, DELETE');
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_options_wildcard_resource = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.put('/', _handler);
  server.del('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '*');
    opts.method = 'OPTIONS';

    http.request(opts, function(res) {
      res._skipAllowedMethods = true;
      common.checkResponse(assert, res);
      assert.equal(res.statusCode, 200);
      assert.ok(!res.headers.allow);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_create_default_version = function(test, assert) {
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
