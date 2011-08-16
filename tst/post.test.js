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
  restify.log.level(restify.LogLevel.Trace);

  server = restify.createServer({
    apiVersion: '1.2.3',
    serverName: 'RESTify'
  });

  server.post('/test/:name', function(req, res) {
    var obj = {
      name: req.uriParams.name
    };

    if (req.params.query) obj.query = req.params.query;
    if (req.params.json) obj.json = req.params.json;
    if (req.params.form) obj.form = req.params.form;

    res.send(200, obj);
  });

  server.listen(socket, function() {
    test.finish();
  });
};


exports.test_bad_method = function(test, assert) {
  var opts = common.newOptions(socket, '/test/unit');
  opts.method = 'GET';

  http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 405);
    test.finish();
  }).end();
};


exports.test_not_found = function(test, assert) {
  var opts = common.newOptions(socket, '/' + uuid());
  opts.method = 'POST';

  http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 404);
    test.finish();
  }).end();
};


exports.test_basic_success = function(test, assert) {
  var opts = common.newOptions(socket, '/test/' + uuid());
  opts.method = 'POST';

  http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 200);
    test.finish();
  }).end();
};


exports.test_query_param = function(test, assert) {
  var opts = common.newOptions(socket, '/test/' + uuid() + '?query=foo');
  opts.method = 'POST';

  http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 200);
    common.checkContent(assert, res, function() {
      assert.ok(res.params);
      assert.equal(res.params.query, 'foo');
      test.finish();
    });
  }).end();
};


exports.test_json_param = function(test, assert) {
  var opts = common.newOptions(socket, '/test/' + uuid());
  opts.method = 'POST';

  var req = http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 200);
    common.checkContent(assert, res, function() {
      assert.ok(res.params);
      assert.equal(res.params.json, 'foo');
      test.finish();
    });
  });

  req.write(JSON.stringify({json: 'foo'}));
  req.end();
};


exports.test_json_param_content_length = function(test, assert) {
  var content = JSON.stringify({json: 'foo'});

  var opts = common.newOptions(socket, '/test/' + uuid());
  opts.headers['Content-Length'] = content.length;
  opts.method = 'POST';

  var req = http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 200);
    common.checkContent(assert, res, function() {
      assert.ok(res.params);
      assert.equal(res.params.json, 'foo');
      test.finish();
    });
  });

  req.write(content);
  req.end();
};


exports.test_form_param = function(test, assert) {
  var opts = common.newOptions(socket, '/test/' + uuid());
  opts.method = 'POST';
  opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';

  var req = http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 200);
    common.checkContent(assert, res, function() {
      assert.ok(res.params);
      assert.equal(res.params.form, 'bar');
      test.finish();
    });
  });

  req.write('form=bar');
  req.end();
};


exports.test_merge_params = function(test, assert) {
  var content = 'form=bar';
  var opts = common.newOptions(socket, '/test/' + uuid() + '?query=foo');
  opts.method = 'POST';
  opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
  opts.headers['Content-Length'] = content.length;

  var req = http.request(opts, function(res) {
    common.checkResponse(assert, res);
    assert.equal(res.statusCode, 200);
    common.checkContent(assert, res, function() {
      assert.ok(res.params);
      assert.equal(res.params.form, 'bar');
      assert.equal(res.params.query, 'foo');
      test.finish();
    });
  });

  req.write(content);
  req.end();
};


exports.test_multibyte = function(test, assert) {
  var content = '\u00bd + \u00bc = \u00be';
  var opts = common.newOptions(socket, '/test/' + uuid());
  opts.method = 'POST';
  opts.headers['Content-Type'] = 'text/plain';
  opts.headers['Content-Length'] = 12;

  var req = http.request(opts, function(res) {
    common.checkResponse(assert, res);
    // We know the server checks content-len before
    // it checks content-type, so good enough.
    assert.equal(res.statusCode, 415);
    test.finish();
  });

  req.write(content);
  req.end();
};


exports.tearDown = function(test, assert) {
  server.on('close', function() {
    test.finish();
  });
  server.close();
};
