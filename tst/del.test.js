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



// --- Tests

exports.setUp = function(test, assert) {
  server = restify.createServer({
    apiVersion: '1.2.3',
    serverName: 'RESTify'
  });

  server.del('/test/:name', function(req, res) {
    res.send(204);
  });

  server.listen(socket, function() {
    test.finish();
  });
};



exports.test_bad_method = function(test, assert) {
  var opts = common.newOptions(socket, '/test/unit');
  opts.method = 'POST';

  http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(405, res.statusCode);
    test.finish();
  }).end();
};


exports.test_not_found = function(test, assert) {
  var opts = common.newOptions(socket, '/' + uuid());
  opts.method = 'DELETE';

  http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 404);
    test.finish();
  }).end();
};


exports.test_success = function(test, assert) {
  var opts = common.newOptions(socket, '/test/unit');
  opts.method = 'DELETE';

  http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 204);
    test.finish();
  }).end();
};


exports.tearDown = function(test, assert) {
  server.on('close', function() {
    test.finish();
  });
  server.close();
};
