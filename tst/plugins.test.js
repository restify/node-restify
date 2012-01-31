// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var http = require('http');

var d = require('dtrace-provider');
var test = require('tap').test;
var uuid = require('node-uuid');

var HttpError = require('../lib/errors').HttpError;
var RestError = require('../lib/errors').RestError;
var log4js = require('../lib/log4js_stub');
var plugins = require('../lib/plugins');
var Request = require('../lib/request');
var Response = require('../lib/response');
var Server = require('../lib/server');



///--- Globals

var DTRACE = d.createDTraceProvider('restifyUnitTest');
var PORT = process.env.UNIT_TEST_PORT || 12345;
var SERVER;



///--- Helpers

function request(path, headers, callback) {
  if (typeof(path) === 'function') {
    callback = path;
    path = headers = false;
  }
  if (typeof(headers) === 'function') {
    callback = headers;
    headers = false;
  }

  var opts = {
    hostname: '127.0.0.1',
    port: PORT,
    path: path || '/foo/bar',
    agent: false,
    method: 'GET',
    headers: headers || {}
  };

  return http.request(opts, callback);
}




///--- Tests

test('setup', function(t) {
  SERVER = new Server({
    dtrace: DTRACE,
    log4js: log4js
  });

  SERVER.use(plugins.acceptParser(SERVER.acceptable));
  SERVER.use(plugins.authorizationParser());
  SERVER.use(plugins.dateParser());
  SERVER.use(plugins.queryParser());

  SERVER.get('/foo/:id', function(req, res, next) {
    res.send();
    return next();
  });

  DTRACE.enable();
  SERVER.listen(PORT, '127.0.0.1', function() {
    t.end();
  });
});


test('accept ok', function(t) {
  request(function(res) {
    t.equal(res.statusCode, 200);
    t.end();
  }).end();
});


test('406', function(t) {
  request('/foo/bar', { accept: 'foo/bar' }, function(res) {
    t.equal(res.statusCode, 406);
    t.end();
  }).end();
});


test('authorization basic ok', function(t) {
  var authz = 'Basic ' + new Buffer('user:secret').toString('base64');
  request('/foo/bar', { authorization: authz }, function(res) {
    t.equal(res.statusCode, 200);
    t.end();
  }).end();
});


test('authorization basic invalid', function(t) {
  var authz = 'Basic bogus';
  request('/foo/bar', { authorization: authz }, function(res) {
    t.equal(res.statusCode, 400);
    t.end();
  }).end();
});


test('query ok', function(t) {
  SERVER.get('/query/:id', function(req, res, next) {
    t.equal(req.params.id, 'foo');
    t.equal(req.params.name, 'markc');
    t.equal(req.query.name, 'markc');
    res.send();
    return next();
  });

  request('/query/foo?id=bar&name=markc', function(res) {
    t.equal(res.statusCode, 200);
    t.end();
  }).end();
});


test('body url-encoded ok', function(t) {
  SERVER.post('/bodyurl/:id', plugins.bodyParser(), function(req, res, next) {
    t.equal(req.params.id, 'foo');
    t.equal(req.params.name, 'markc');
    t.equal(req.params.phone, '(206) 555-1212');
    res.send();
    return next();
  });

  var opts = {
    hostname: '127.0.0.1',
    port: PORT,
    path: '/bodyurl/foo?name=markc',
    agent: false,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };
  var client = http.request(opts, function(res) {
    t.equal(res.statusCode, 200);
    t.end();
  });
  client.write('phone=(206)%20555-1212&name=somethingelse');
  client.end();
});


test('body url-encoded ok (no params)', function(t) {
  SERVER.post('/bodyurl2/:id',
              plugins.bodyParser({ mapParams: false }),
              function(req, res, next) {
                t.equal(req.params.id, 'foo');
                t.equal(req.params.name, 'markc');
                t.notOk(req.params.phone);
                t.equal(req.body.phone, '(206) 555-1212');
                res.send();
                return next();
              });

  var opts = {
    hostname: '127.0.0.1',
    port: PORT,
    path: '/bodyurl2/foo?name=markc',
    agent: false,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };
  var client = http.request(opts, function(res) {
    t.equal(res.statusCode, 200);
    t.end();
  });
  client.write('phone=(206)%20555-1212&name=somethingelse');
  client.end();
});


test('body json ok', function(t) {
  SERVER.post('/bodyjson/:id',
              plugins.bodyParser(),
              function(req, res, next) {
    t.equal(req.params.id, 'foo');
    t.equal(req.params.name, 'markc');
    t.equal(req.params.phone, '(206) 555-1212');
    res.send();
    return next();
  });

  var opts = {
    hostname: '127.0.0.1',
    port: PORT,
    path: '/bodyjson/foo?name=markc',
    agent: false,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  var client = http.request(opts, function(res) {
    t.equal(res.statusCode, 200);
    t.end();
  });
  client.write(JSON.stringify({
    phone: '(206) 555-1212',
    name: 'somethingelse'
  }));
  client.end();
});


test('body json ok (no params)', function(t) {
  SERVER.post('/bodyjson2/:id',
              plugins.bodyParser({ mapParams: false }),
              function(req, res, next) {
                t.equal(req.params.id, 'foo');
                t.equal(req.params.name, 'markc');
                t.notOk(req.params.phone);
                t.equal(req.body.phone, '(206) 555-1212');
                res.send();
                return next();
              });

  var opts = {
    hostname: '127.0.0.1',
    port: PORT,
    path: '/bodyjson2/foo?name=markc',
    agent: false,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  var client = http.request(opts, function(res) {
    t.equal(res.statusCode, 200);
    t.end();
  });
  client.write(JSON.stringify({
    phone: '(206) 555-1212',
    name: 'somethingelse'
  }));
  client.end();
});


test('date expired', function(t) {
  request('/foo/bar', { date: 'Tue, 15 Nov 1994 08:12:31 GMT' }, function(res) {
    t.equal(res.statusCode, 400);
    res.setEncoding('utf8');
    res.body = '';
    res.on('data', function(chunk) {
      res.body += chunk;
    });
    res.on('end', function() {
      t.equal(JSON.parse(res.body).message, 'Date header is too old');
      t.end();
    });
  }).end();
});


test('teardown', function(t) {
  SERVER.close(function() {
    t.end();
  });
});
