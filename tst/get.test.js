// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var http = require('httpu');
var uuid = require('node-uuid');

var common = require('./lib/common');
var restify = require('../lib/restify');



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

  server.get('/', function(req, res) {
    res.send(200);
  });
  server.get('/test/:name', function(req, res) {
    var obj = {
      name: req.uriParams.name
    };

    if (req.params.query) obj.query = req.params.query;

    res.send(200, obj);
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
    assert.equal(res.statusCode, 405);
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


exports.test_get_root = function(test, assert) {
  var opts = common.newOptions(socket);
  http.get(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 200);
    test.finish();
  }).end();
};


exports.test_get_with_uri_params = function(test, assert) {
  var opts = common.newOptions(socket, '/test/foo');

  http.get(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 200);
    common.checkContent(assert, res, function() {
      assert.ok(res.params.name);
      assert.equal(res.params.name, 'foo');
      test.finish();
    });
  }).end();
};


exports.test_with_query_param = function(test, assert) {
  var opts = common.newOptions(socket, '/test/foo?query=bar');

  http.get(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 200);
    common.checkContent(assert, res, function() {
      assert.ok(res.params.name);
      assert.equal(res.params.name, 'foo');
      assert.ok(res.params.query);
      assert.equal(res.params.query, 'bar');
      test.finish();
    });
  }).end();
};


exports.tearDown = function(test, assert) {
  server.on('close', function() {
    test.finish();
  });
  server.close();
};
