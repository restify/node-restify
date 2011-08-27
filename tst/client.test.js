// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var http = require('httpu');
var uuid = require('node-uuid');

var common = require('./lib/common');
var restify = require('../lib/restify');
restify.log.level(restify.LogLevel.Trace);


// --- Globals

var client = null;
var server = null;
var socket = '/tmp/.' + uuid();



// --- Tests

exports.setUp = function(test, assert) {
  server = restify.createServer({
    apiVersion: '1.2.3',
    serverName: 'RESTify'
  });

  function handle(req, res, next) {
    var code = req.params.code || 200;
    req.params.name = req.uriParams.name;
    res.send(code, req.method !== 'HEAD' ? req.params : null);
  }

  server.put('/test/:name', handle);
  server.post('/test/:name', handle);
  server.get('/test/:name', handle);
  server.del('/test/:name', handle);
  server.head('/test/:name', handle);
  server.head('/fail', function(req, res, next) {
    res.send(503);
  });

  server.listen(socket, function() {
    client = restify.createClient({
      socketPath: socket,
      version: '1.2.3',
      retryOptions: {
        retries: 1
      }
    });
    test.finish();
  });
};

exports.test_put_utf8 = function(test, assert) {
  var req = {
    path: '/test/foo',
    expect: 200,
    body: {
      foo: 'Iñtërnâtiônàlizætiøn',
      code: 200
    }
  };

  client.put(req, function(err, obj) {
    assert.ifError(err);
    assert.ok(obj);
    assert.equal(obj.name, 'foo');
    assert.equal(obj.foo, 'Iñtërnâtiônàlizætiøn');
    test.finish();
  });
};

exports.test_put_expect = function(test, assert) {
  var req = {
    path: '/test/foo',
    expect: 200,
    body: {
      foo: 'bar',
      code: 200
    }
  };

  client.put(req, function(err, obj) {
    assert.ifError(err);
    assert.ok(obj);
    assert.equal(obj.name, 'foo');
    assert.equal(obj.foo, 'bar');
    test.finish();
  });
};


exports.test_put_no_expect = function(test, assert) {
  var req = {
    path: '/test/foo',
    expect: [204],
    body: {
      foo: 'bar',
      code: 204
    }
  };

  client.put(req, function(err, obj) {
    assert.ifError(err);
    test.finish();
  });
};


exports.test_post_expect = function(test, assert) {
  var req = {
    path: '/test/foo',
    expect: 201,
    body: {
      foo: 'bar'
    },
    query: {
      code: 201
    }
  };

  client.post(req, function(err, obj, headers) {
    assert.ifError(err);
    assert.ok(obj);
    assert.ok(headers);
    assert.equal(obj.name, 'foo');
    assert.equal(obj.foo, 'bar');
    test.finish();
  });
};


exports.test_post_expect = function(test, assert) {
  var req = {
    path: '/test/foo',
    body: {
      foo: 'bar'
    },
    query: {
      code: 200
    }
  };

  client.post(req, function(err, obj, headers) {
    assert.ifError(err);
    assert.ok(obj);
    assert.ok(headers);
    assert.equal(obj.name, 'foo');
    assert.equal(obj.foo, 'bar');
    test.finish();
  });
};


exports.test_get_expect = function(test, assert) {
  var req = {
    path: '/test/foo',
    expect: 200,
    query: {
      foo: 'bar',
      code: 200
    }
  };

  client.get(req, function(err, obj) {
    assert.ifError(err);
    assert.ok(obj);
    assert.equal(obj.name, 'foo');
    assert.equal(obj.foo, 'bar');
    test.finish();
  });
};


exports.test_get_no_expect = function(test, assert) {
  var req = {
    path: '/test/foo',
    query: {
      foo: 'bar',
      code: 200
    }
  };

  client.get(req, function(err, obj) {
    assert.ifError(err);
    assert.ok(obj);
    assert.equal(obj.name, 'foo');
    assert.equal(obj.foo, 'bar');
    test.finish();
  });
};


exports.test_del_expect = function(test, assert) {
  var req = {
    path: '/test/foo',
    expect: 200,
    query: {
      code: 200
    }
  };

  client.del(req, function(err, headers) {
    assert.ifError(err);
    assert.ok(headers);
    test.finish();
  });
};


exports.test_del_no_expect = function(test, assert) {
  var req = {
    path: '/test/foo',
    query: {
      code: 204
    }
  };

  client.del(req, function(err, headers) {
    assert.ifError(err);
    assert.ok(headers);
    test.finish();
  });
};


exports.test_head_expect = function(test, assert) {
  var req = {
    path: '/test/foo',
    expect: 200,
    query: {
      code: 200
    }
  };

  client.head(req, function(err, headers) {
    assert.ifError(err);
    assert.ok(headers);
    test.finish();
  });
};


exports.test_head_no_expect = function(test, assert) {
  var req = {
    path: '/test/foo',
    query: {
      code: 204
    }
  };

  client.head(req, function(err, headers) {
    assert.ifError(err);
    assert.ok(headers);
    test.finish();
  });
};


exports.test_retries = function(test, assert) {
  var req = {
    path: '/fail'
  };

  client.head(req, function(err, headers) {
    assert.ok(!headers);
    assert.ok(err);
    assert.equal(err.name, 'HttpError');
    assert.equal(err.httpCode, 503);
    assert.equal(err.restCode, 'RetriesExceeded');
    assert.equal(err.message, 'Maximum number of retries exceeded: 2');
    test.finish();
  });
};


exports.test_form_url_encoding = function(test, assert) {
  var _client = restify.createClient({
    socketPath: socket,
    version: '1.2.3',
    contentType: 'application/x-www-form-urlencoded',
    retryOptions: {
      retries: 1
    }
  });

  var req = {
    path: '/test/foo',
    body: {
      foo: 'bar'
    },
    query: {
      code: 200
    }
  };

  _client.post(req, function(err, obj, headers) {
    assert.ifError(err);
    assert.ok(obj);
    assert.ok(headers);
    assert.equal(obj.name, 'foo');
    assert.equal(obj.foo, 'bar');
    test.finish();
  });
};


exports.test_head_string = function(test, assert) {
  client.head('/test/foo?code=204', function(err, headers) {
    assert.ifError(err);
    assert.ok(headers);
    test.finish();
  });
};


exports.test_get_string = function(test, assert) {
  client.get('/test/foo', function(err, headers) {
    assert.ifError(err);
    assert.ok(headers);
    test.finish();
  });
};


exports.test_put_string = function(test, assert) {
  client.put('/test/foo', function(err, headers) {
    assert.ifError(err);
    assert.ok(headers);
    test.finish();
  });
};


exports.test_post_string = function(test, assert) {
  client.post('/test/foo', function(err, headers) {
    assert.ifError(err);
    assert.ok(headers);
    test.finish();
  });
};


exports.test_del_string = function(test, assert) {
  client.del('/test/foo', function(err, headers) {
    assert.ifError(err);
    assert.ok(headers);
    test.finish();
  });
};


exports.test_url_in_constructor = function(test, assert) {
  var client = restify.createClient({
    path: '/test/foo',
    socketPath: socket,
    version: '1.2.3',
    retryOptions: {
      retries: 1
    }
  });

  client.del(function(err, headers) {
    assert.ifError(err);
    assert.ok(headers);
    test.finish();
  });
};


exports.test_url_prefix = function(test, assert) {
  var client = restify.createClient({
    path: '/test',
    socketPath: socket,
    version: '1.2.3',
    retryOptions: {
      retries: 1
    }
  });

  client.del({ path: '/foo' }, function(err, headers) {
    assert.ifError(err);
    assert.ok(headers);
    test.finish();
  });
};


exports.tearDown = function(test, assert) {
  server.on('close', function() {
    test.finish();
  });
  server.close();
};
