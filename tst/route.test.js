// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var test = require('tap').test;

var log4js = require('../lib/log4js_stub');
var Route = require('../lib/route');



///--- Tests

test('throws on missing options', function(t) {
  t.throws(function() {
    return new Route();
  }, new TypeError('options (Object) required'));
  t.end();
});


test('throws on missing log4js', function(t) {
  t.throws(function() {
    return new Route({});
  }, new TypeError('options.log4js (Object) required'));
  t.end();
});


test('throws on missing url', function(t) {
  t.throws(function() {
    return new Route({
      log4js: log4js
    });
  }, new TypeError('url must be a String'));
  t.end();
});


test('throws on url wrong type', function(t) {
  t.throws(function() {
    return new Route({
      log4js: log4js,
      url: 123
    });
  }, new TypeError('url must be a String'));
  t.end();
});


test('throws on setting url incorrectly', function(t) {
  var r = new Route({
    log4js: log4js,
    url: '/foo'
  });
  t.throws(function() {
    r.url = 123;
  }, new TypeError('url must be a String'));
  t.end();
});


test('throws on bad version', function(t) {
  t.throws(function() {
    return new Route({
      log4js: log4js,
      url: '/foo/bar',
      version: 123
    });
  }, new TypeError('options.version must be a String'));
  t.end();
});


test('throws on bad handlers (not array)', function(t) {
  t.throws(function() {
    return new Route({
      log4js: log4js,
      url: '/foo/bar',
      handlers: 123
    });
  }, new TypeError('options.handlers must be an Array of Functions'));
  t.end();
});


test('throws on bad handlers (not function)', function(t) {
  t.throws(function() {
    return new Route({
      log4js: log4js,
      url: '/foo/bar',
      handlers: [123]
    });
  }, new TypeError('options.handlers must be an Array of Functions'));
  t.end();
});


test('construct with default method and name', function(t) {
  var route = new Route({
    log4js: log4js,
    url: '/foo/:bar'
  });
  t.ok(route);
  t.equal(route.method, 'GET');
  t.equal(route.url, '/foo/:bar');
  t.equal(route.name, 'GET /foo/:bar');
  t.end();
});


test('construct with explicit method and version', function(t) {
  var route = new Route({
    log4js: log4js,
    url: '/foo/:bar',
    method: 'PUT',
    version: '1.2.3'
  });
  t.ok(route);
  t.ok(route.pattern);
  t.equal(route.method, 'PUT');
  t.equal(route.url, '/foo/:bar');
  t.equal(route.name, 'PUT /foo/:bar (1.2.3)');
  t.end();
});


test('construct with regex url and chain', function(t) {
  var route = new Route({
    log4js: log4js,
    url: /foo\/(\w+)/,
    method: 'PUT',
    name: 'PutFoo',
    handlers: [function(req, res, next) {}]
  });
  t.ok(route);
  t.ok(route.pattern);
  t.equal(route.method, 'PUT');
  t.equal(route.url, '/foo\\/(\\w+)/');
  t.equal(route.name, 'PutFoo');
  t.end();
});


test('test matches no params', function(t) {
  var route = new Route({
    log4js: log4js,
    url: '/foo/bar',
    method: 'GET'
  });
  t.ok(route);
  t.equivalent(route.matches({
    method: 'GET',
    path: '/foo/bar'
  }), {});
  t.notOk(route.matches({
    method: 'GET',
    path: '/foo/boo'
  }));
  t.notOk(route.matches({
    method: 'PUT',
    path: '/foo/bar'
  }));
  t.end();
});


test('test matches params', function(t) {
  var route = new Route({
    log4js: log4js,
    url: '/foo/:bar',
    method: 'GET'
  });
  t.ok(route);
  t.equivalent(route.matches({
    method: 'GET',
    path: '/foo/car'
  }), { bar: 'car' });
  t.notOk(route.matches({
    method: 'GET',
    path: '/foo/boo/bar'
  }));
  t.notOk(route.matches({
    method: 'PUT',
    path: '/foo/bar'
  }));
  t.end();
});


test('test matches multiple params', function(t) {
  var route = new Route({
    log4js: log4js,
    url: '/foo/:one/bar/:two',
    method: 'GET'
  });
  t.ok(route);
  t.equivalent(route.matches({
    method: 'GET',
    path: '/foo/car/bar/chevy'
  }), { one: 'car', two: 'chevy' });
  t.notOk(route.matches({
    method: 'GET',
    path: '/foo/boo/bar'
  }));
  t.notOk(route.matches({
    method: 'PUT',
    path: '/foo/bar'
  }));
  t.end();
});


test('test matches regex', function(t) {
  var route = new Route({
    log4js: log4js,
    url: /^\/foo\/(\w+)$/,
    method: 'GET'
  });
  t.ok(route);
  t.equivalent(route.matches({
    method: 'GET',
    path: '/foo/car'
  }), {0: 'car'});
  t.notOk(route.matches({
    method: 'GET',
    path: '/foo/boo/bar'
  }));
  t.notOk(route.matches({
    method: 'PUT',
    path: '/foo/bar'
  }));
  t.end();
});


test('test matches version', function(t) {
  var route = new Route({
    log4js: log4js,
    url: '/foo/:bar',
    method: 'GET',
    version: '1.2.3'
  });
  t.ok(route);
  t.equivalent(route.matches({
    method: 'GET',
    path: '/foo/car'
  }), { bar: 'car' });
  t.notOk(route.matches({
    method: 'GET',
    path: '/foo/car',
    version: '3.2.1'
  }));
  t.end();
});


test('run routes', function(t) {
  var route = new Route({
    log4js: log4js,
    url: '/foo/:bar',
    method: 'GET'
  });
  t.ok(route);
  var invoked = 0;
  route.use([
    function(req, res, next) {
      invoked++;
      return next();
    },
    function(req, res, next) {
      invoked++;
      return next();
    },
    function(req, res, next) {
      return next(new Error('foo'));
    }
  ]);
  route.once('done', function() {
    t.equal(invoked, 2);
    t.end();
  });

  // Stub this out
  route.run({}, { send: function() {} });
});


test('toString', function(t) {
  t.equal(new Route({
    log4js: log4js,
    url: '/foo/:bar',
    method: 'GET'
  }).toString(), 'GET /foo/:bar');

  t.equal(new Route({
    log4js: log4js,
    url: '/foo/:bar',
    method: 'GET',
    version: '1.2.3'
  }).toString(), 'GET /foo/:bar (version=1.2.3)');

  t.equal(new Route({
    log4js: log4js,
    url: '/foo/:bar',
    method: 'GET',
    version: '1.2.3',
    name: 'GetFoo'
  }).toString(), 'GET /foo/:bar (version=1.2.3)');

  t.end();
});
