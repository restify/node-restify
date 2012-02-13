// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var EventEmitter = require('events').EventEmitter;
var Logger = require('bunyan');
var test = require('tap').test;

var HttpError = require('../lib/errors').HttpError;
var RestError = require('../lib/errors').RestError;
var Request = require('../lib/request');
var Response = require('../lib/response');

var getRequest = require('./stubs').getRequest;
var getResponse = require('./stubs').getResponse;



///--- Tests

test('throws on missing options', function (t) {
  t.throws(function () {
    return new Response();
  }, new TypeError('options (Object) required'));
  t.end();
});


test('throws on missing Logger', function (t) {
  t.throws(function () {
    return new Response({});
  }, new TypeError('options.log (Object) required'));
  t.end();
});


test('throws on missing response', function (t) {
  t.throws(function () {
    return new Response({
      log: new Logger({name: 'restify/test/response'})
    });
  }, new TypeError('options.response (http.OutgoingMessage) required'));
  t.end();
});


test('throws on missing request', function (t) {
  t.throws(function () {
    return new Response({
      log: new Logger({name: 'restify/test/response'}),
      response: {}
    });
  }, new TypeError('options.request (Request) required'));
  t.end();
});


test('throws on bad version type', function (t) {
  t.throws(function () {
    return new Response({
      log: new Logger({name: 'restify/test/response'}),
      response: {},
      request: getRequest(),
      version: 123
    });
  }, new TypeError('options.version (String) required'));
  t.end();
});


test('properties', function (t) {
  var res = getResponse();
  t.ok(res);
  t.ok(res.code);
  t.ok(res.headers);
  t.ok(res.requestId);
  t.ok(res.statusCode);
  t.end();
});


test('header throws on bad type', function (t) {
  t.throws(function () {
    getResponse().header(123);
  }, new TypeError('name (String) required'));
  t.end();
});


test('header (get)', function (t) {
  var res = getResponse();
  res.setHeader('foo', 'bar');
  t.equal(res.header('foo'), 'bar');
  t.equal(res.get('foo'), 'bar');
  t.end();
});


test('header (set)', function (t) {
  var res = getResponse();
  res.header('foo', 'bar');
  res.set({
    'bar': ['baz', 'bebop']
  });

  t.equal(res.header('foo'), 'bar');
  t.equivalent(res.get('bar'), ['baz', 'bebop']);
  t.end();
});


test('send plain string no code', function (t) {
  var res = getResponse();
  res.res.on('end', function (code, headers, data) {
    t.equal(code, 200);
    t.ok(headers);
    t.equal(headers['Content-Type'], 'text/plain; charset=UTF-8');
    t.equal(data[0], 'hello world');
    t.end();
  });
  res.contentType = 'text';
  res.send('hello world');
});


test('send plain string with code', function (t) {
  var res = getResponse();
  res.res.on('end', function (code, headers, data) {
    t.equal(code, 100);
    t.ok(headers);
    t.equal(headers['Content-Type'], 'text/plain; charset=UTF-8');
    t.equal(data[0], 'hello world');
    t.end();
  });
  res.contentType = 'text';
  res.send(100, 'hello world');
});


test('send(json)', function (t) {
  var res = getResponse();
  res.res.on('end', function (code, headers, data) {
    t.equal(code, 200);
    t.ok(headers);
    t.equal(headers['Content-Type'], 'application/json');
    t.equivalent(JSON.parse(data[0]), {hello: 'world'});
    t.end();
  });
  res.contentType = 'json';
  res.send({hello: 'world'});
});


test('json', function (t) {
  var res = getResponse();
  res.res.on('end', function (code, headers, data) {
    t.equal(code, 200);
    t.ok(headers);
    t.equal(headers['Content-Type'], 'application/json');
    t.equivalent(JSON.parse(data[0]), {hello: 'world'});
    t.end();
  });
  res.json({hello: 'world'});
});


test('json with code', function (t) {
  var res = getResponse();
  res.res.on('end', function (code, headers, data) {
    t.equal(code, 100);
    t.ok(headers);
    t.equal(headers['Content-Type'], 'application/json');
    t.equivalent(JSON.parse(data[0]), {hello: 'world'});
    t.end();
  });
  res.json(100, {hello: 'world'});
});


test('send(buffer)', function (t) {
  var res = getResponse();
  res.res.on('end', function (code, headers, data) {
    t.equal(code, 200);
    t.ok(headers);
    t.equal(headers['Content-Type'], 'application/octet-stream');
    t.equal(data[0].toString(), 'hello world');
    t.end();
  });

  res.contentType = 'binary';
  res.send(new Buffer('hello world'));
});


test('send(Error)', function (t) {
  var res = getResponse();
  res.res.on('end', function (code, headers, data) {
    t.equal(code, 500);
    t.ok(headers);
    t.equal(headers['Content-Type'], 'application/json');
    t.equal(JSON.parse(data[0]).message, 'hello world');
    t.end();
  });

  res.send(new Error('hello world'));
});


test('send(HttpError)', function (t) {
  var res = getResponse();
  res.res.on('end', function (code, headers, data) {
    t.equal(code, 409);
    t.ok(headers);
    t.equal(headers['Content-Type'], 'application/json');
    t.equal(JSON.parse(data[0]).message, 'hello world');
    t.end();
  });

  res.send(new HttpError(409, 'hello world'));
});


test('send(RestError)', function (t) {
  var res = getResponse();
  res.res.on('end', function (code, headers, data) {
    t.equal(code, 409);
    t.ok(headers);
    t.equal(headers['Content-Type'], 'application/json');
    t.equal(JSON.parse(data[0]).code, 'FooError');
    t.equal(JSON.parse(data[0]).message, 'hello world');
    t.end();
  });

  res.send(new RestError(409, 'FooError', 'hello world'));
});


test('check headers', function (t) {
  var res = getResponse();
  res.methods.push('GET');
  res.defaultHeaders();
  res.res.on('end', function (code, headers, data) {
    t.equal(code, 200);
    t.ok(headers);
    t.equal(headers['Access-Control-Allow-Origin'], '*');
    t.ok(['Access-Control-Allow-Headers']);
    t.ok(headers['Access-Control-Expose-Headers']);
    t.equal(headers['Access-Control-Allow-Methods'], 'GET');
    t.equal(headers['Content-Type'], 'application/json');
    t.ok(headers['Content-Length']);
    t.ok(headers['Content-MD5']);
    t.ok(headers['Date']);
    t.ok(headers['Server']);
    t.ok(headers['X-Request-Id']);
    t.ok(headers['X-Response-Time'] !== undefined);
    t.equal(JSON.parse(data[0]), 'hello world');
    t.end();
  });

  res.send('hello world');
});


test('GH-68 res.header() shoud take a Date object', function (t) {
  var res = getResponse();

  res.res.on('end', function (code, headers, data) {
    t.ok(headers.foo);
    t.ok(/\w{3}, \d{2} \w{3} \d{4} (\d{2}:){2}/.test(headers.foo));
    t.end();
  });

  res.header('foo', new Date());
  res.send('hello world');
});


test('GH-66 support res.charSet=...', function (t) {
  var res = getResponse();

  res.res.on('end', function (code, headers, data) {
    t.equal(headers['Content-Type'], 'text/plain; charset=iso-8859-1');
    t.end();
  });

  res.charSet = 'iso-8859-1';
  res.contentType = 'text/plain';
  res.send('hello world');
});
