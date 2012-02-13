// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var EventEmitter = require('events').EventEmitter;

var Logger = require('bunyan');
var test = require('tap').test;

var Request = require('../lib/request');

var getRequest = require('./stubs').getRequest;



///--- Tests

test('throws on missing options', function (t) {
  t.throws(function () {
    return new Request();
  }, new TypeError('options (Object) required'));
  t.end();
});


test('throws on missing Logger', function (t) {
  t.throws(function () {
    return new Request({});
  }, new TypeError('options.log (Object) required'));
  t.end();
});


test('throws on missing request', function (t) {
  t.throws(function () {
    return new Request({
      log: new Logger({name: 'restify/test/request'})
    });
  }, new TypeError('options.request (http.IncomingMessage) required'));
  t.end();
});


test('properties', function (t) {
  var req = getRequest();
  t.ok(req.contentType);
  t.ok(req.connection);
  t.ok(req.headers);
  t.ok(req.httpVersion);
  t.ok(req.id);
  t.ok(req.method);
  t.ok(req.path);
  t.ok(req.secure);
  t.ok(req.trailers);
  t.ok(req.url);
  t.end();
});


test('accepts', function (t) {
  var req = getRequest();
  t.throws(function () {
    req.accepts(123);
  }, new TypeError('type (String) required'));
  t.ok(req.accepts('application/json'));
  t.ok(req.accepts('json'));
  t.ok(req.accepts('text/plain'));
  t.notOk(req.accepts('foo/plain'));
  t.ok(req.accepts('bar/foo'));
  t.end();
});


test('header', function (t) {
  var req = getRequest();
  t.throws(function () {
    req.header(123);
  }, new TypeError('name (String) required'));
  t.equal(req.header('Content-Type'), 'application/xml; charset=en_us');
  t.end();
});

test('is', function (t) {
  var req = getRequest();
  t.equal(req.contentType, 'application/xml');
  t.ok(req.is('application/xml'));
  t.ok(req.is('xml'));
  t.notOk(req.is('json'));
  t.end();
});
