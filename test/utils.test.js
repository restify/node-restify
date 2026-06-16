'use strict';
/* eslint-disable func-names */

var mergeQs = require('../lib/utils').mergeQs;
var parseRequestUrl = require('../lib/utils').parseRequestUrl;
var parseUrlQuery = require('../lib/utils').parseUrlQuery;
var formatUrl = require('../lib/utils').formatUrl;
var normalizeArrays = require('../lib/utils').normalizeArrays;

if (require.cache[__dirname + '/lib/helper.js']) {
    delete require.cache[__dirname + '/lib/helper.js'];
}
var helper = require('./lib/helper.js');

///--- Globals

var test = helper.test;

// parseRequestUrl

test(module, 'parseRequestUrl: plain path', function(t) {
    var r = parseRequestUrl('/foo/bar');

    t.equal(r.pathname, '/foo/bar');
    t.equal(r.search, null);
    t.equal(r.query, null);
    t.equal(r.hash, null);
    t.equal(r.path, '/foo/bar');
    t.equal(r.href, '/foo/bar');
    t.equal(r.hostname, null);
    t.equal(r.port, null);
    t.done();
});

test(module, 'parseRequestUrl: path with query string', function(t) {
    var r = parseRequestUrl('/foo?a=1&b=2');

    t.equal(r.pathname, '/foo');
    t.equal(r.search, '?a=1&b=2');
    t.equal(r.query, 'a=1&b=2');
    t.equal(r.path, '/foo?a=1&b=2');
    t.equal(r.href, '/foo?a=1&b=2');
    t.done();
});

test(module, 'parseRequestUrl: path with hash', function(t) {
    var r = parseRequestUrl('/foo/bar#section');

    t.equal(r.pathname, '/foo/bar');
    t.equal(r.hash, '#section');
    t.equal(r.search, null);
    t.equal(r.href, '/foo/bar#section');
    t.done();
});

test(module, 'parseRequestUrl: absolute URL', function(t) {
    var r = parseRequestUrl('http://example.com/foo?x=1');

    t.equal(r.pathname, '/foo');
    t.equal(r.search, '?x=1');
    t.equal(r.query, 'x=1');
    t.equal(r.hostname, 'example.com');
    t.equal(r.port, null);
    t.equal(r.path, '/foo?x=1');
    t.done();
});

test(module, 'parseRequestUrl: absolute URL with port', function(t) {
    var r = parseRequestUrl('http://example.com:8080/foo');

    t.equal(r.pathname, '/foo');
    t.equal(r.hostname, 'example.com');
    t.equal(r.port, '8080');
    t.equal(r.search, null);
    t.done();
});

test(module, 'parseRequestUrl: OPTIONS * request-target', function(t) {
    var r = parseRequestUrl('*');

    t.equal(r.pathname, '*');
    t.equal(r.search, null);
    t.equal(r.query, null);
    t.equal(r.hash, null);
    t.equal(r.path, '*');
    t.equal(r.href, '*');
    t.done();
});

// parseUrlQuery

test(module, 'parseUrlQuery: simple params become object', function(t) {
    var sp = new URL('/foo?a=1&b=2', 'http://localhost').searchParams;

    t.deepEqual(parseUrlQuery(sp), { a: '1', b: '2' });
    t.done();
});

test(module, 'parseUrlQuery: duplicate keys accumulate into array', function(
    t
) {
    var sp = new URL('/foo?a=1&a=2&b=3', 'http://localhost').searchParams;

    t.deepEqual(parseUrlQuery(sp), { a: ['1', '2'], b: '3' });
    t.done();
});

test(module, 'parseUrlQuery: no query returns empty object', function(t) {
    var sp = new URL('/foo', 'http://localhost').searchParams;

    t.deepEqual(parseUrlQuery(sp), {});
    t.done();
});

// formatUrl

test(module, 'formatUrl: pathname only', function(t) {
    t.equal(formatUrl({ pathname: '/foo/bar' }), '/foo/bar');
    t.done();
});

test(module, 'formatUrl: hostname + pathname', function(t) {
    t.equal(
        formatUrl({
            protocol: 'http',
            hostname: 'example.com',
            pathname: '/foo'
        }),
        'http://example.com/foo'
    );
    t.done();
});

test(module, 'formatUrl: hostname + port + pathname', function(t) {
    t.equal(
        formatUrl({
            protocol: 'http',
            hostname: 'example.com',
            port: '8080',
            pathname: '/foo'
        }),
        'http://example.com:8080/foo'
    );
    t.done();
});

test(module, 'formatUrl: pathname + query object', function(t) {
    t.equal(
        formatUrl({ pathname: '/foo', query: { a: '1', b: '2' } }),
        '/foo?a=1&b=2'
    );
    t.done();
});

test(module, 'formatUrl: string passthrough', function(t) {
    t.equal(formatUrl('/already/a/string'), '/already/a/string');
    t.equal(formatUrl('http://example.com/foo'), 'http://example.com/foo');
    t.done();
});

test(module, 'formatUrl: array query values become repeated params', function(
    t
) {
    t.equal(
        formatUrl({ pathname: '/foo', query: { a: ['1', '2'] } }),
        '/foo?a=1&a=2'
    );
    t.done();
});

// normalizeArrays

test(module, 'normalizeArrays', function(t) {
    var obj25 = {};
    for (var i = 0; i < 25; i++) {
        obj25[String(i)] = 'v' + i;
    }
    var result1 = normalizeArrays({ items: obj25 });
    t.ok(Array.isArray(result1.items), 'items should be an array');
    t.equal(result1.items.length, 25, 'all 25 items present');

    var result2 = normalizeArrays(obj25);
    t.ok(Array.isArray(result2), 'result should be an array');
    t.equal(result2.items.length, 25, 'all 25 items present');

    // passthrough: real arrays and plain objects are unchanged
    t.deepEqual(normalizeArrays({ a: [1, 2, 3] }), { a: [1, 2, 3] });
    t.deepEqual(normalizeArrays({ name: 'alex' }), { name: 'alex' });

    t.done();
});

// mergeQs

test(module, 'merge qs', function(t) {
    var qs1 = mergeQs(undefined, { a: 1 });
    t.deepEqual(qs1, { a: 1 });

    var qs2 = mergeQs({ a: 1 }, null);
    t.deepEqual(qs2, { a: 1 });

    var qs3 = mergeQs({ a: 1 }, { a: 2 });
    t.deepEqual(qs3, { a: [1, 2] });

    var qs4 = mergeQs({ a: 1 }, { b: 2 });
    t.deepEqual(qs4, { a: 1, b: 2 });

    var qs5 = mergeQs(null, null);
    t.deepEqual(qs5, {});

    t.done();
});
