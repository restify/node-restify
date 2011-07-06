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

exports.test_accept_default = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    opts.headers.accept = 'application/json';

    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.headers.server, 'node.js');
      assert.equal(res.statusCode, 200);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_accept_bad = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    opts.headers.accept = 'application/xml';

    http.request(opts, function(res) {
      res._skipAllowedMethods = true;
      common.checkResponse(assert, res);
      assert.equal(res.headers.server, 'node.js');
      assert.equal(res.statusCode, 406);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_accept_partial_wildcard = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    opts.headers.accept = 'application/*';

    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.headers.server, 'node.js');
      assert.equal(res.statusCode, 200);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_accept_double_wildcard = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    opts.headers.accept = '*/*';

    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.headers.server, 'node.js');
      assert.equal(res.statusCode, 200);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_accept_explicit = function(test, assert) {
  var server = restify.createServer({
    accept: ['text/html']
  });
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    opts.headers.accept = 'text/html';

    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.headers.server, 'node.js');
      assert.equal(res.statusCode, 200);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_multiple_accept = function(test, assert) {
  var server = restify.createServer({
    accept: ['text/html', 'text/xml']
  });
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    opts.headers.accept = 'text/xml';

    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.headers.server, 'node.js');
      assert.equal(res.statusCode, 200);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_firefox_accept = function(test, assert) {
  var server = restify.createServer({
  });
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    opts.headers.accept =
      'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.headers.server, 'node.js');
      assert.equal(res.statusCode, 200);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};

