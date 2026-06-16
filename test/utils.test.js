'use strict';
/* eslint-disable func-names */

var mergeQs = require('../lib/utils').mergeQs;
var parseRequestUrl = require('../lib/utils').parseRequestUrl;
var parseUrlQuery = require('../lib/utils').parseUrlQuery;
var formatUrl = require('../lib/utils').formatUrl;

if (require.cache[__dirname + '/lib/helper.js']) {
    delete require.cache[__dirname + '/lib/helper.js'];
}
var helper = require('./lib/helper.js');

///--- Globals

var test = helper.test;

// parseRequestUrl

test('parseRequestUrl: plain path', function(t) {
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

test('parseRequestUrl: path with query string', function(t) {
    var r = parseRequestUrl('/foo?a=1&b=2');

    t.equal(r.pathname, '/foo');
    t.equal(r.search, '?a=1&b=2');
    t.equal(r.query, 'a=1&b=2');
    t.equal(r.path, '/foo?a=1&b=2');
    t.equal(r.href, '/foo?a=1&b=2');
    t.done();
});

test('parseRequestUrl: path with hash', function(t) {
    var r = parseRequestUrl('/foo/bar#section');

    t.equal(r.pathname, '/foo/bar');
    t.equal(r.hash, '#section');
    t.equal(r.search, null);
    t.equal(r.href, '/foo/bar#section');
    t.done();
});

test('parseRequestUrl: absolute URL', function(t) {
    var r = parseRequestUrl('http://example.com/foo?x=1');

    t.equal(r.pathname, '/foo');
    t.equal(r.search, '?x=1');
    t.equal(r.query, 'x=1');
    t.equal(r.hostname, 'example.com');
    t.equal(r.port, null);
    t.equal(r.path, '/foo?x=1');
    t.done();
});

test('parseRequestUrl: absolute URL with port', function(t) {
    var r = parseRequestUrl('http://example.com:8080/foo');

    t.equal(r.pathname, '/foo');
    t.equal(r.hostname, 'example.com');
    t.equal(r.port, '8080');
    t.equal(r.search, null);
    t.done();
});

test('parseRequestUrl: OPTIONS * request-target', function(t) {
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

test('parseUrlQuery: simple params become object', function(t) {
    var sp = new URL('/foo?a=1&b=2', 'http://localhost').searchParams;

    t.deepEqual(parseUrlQuery(sp), { a: '1', b: '2' });
    t.done();
});

test('parseUrlQuery: duplicate keys accumulate into array', function(t) {
    var sp = new URL('/foo?a=1&a=2&b=3', 'http://localhost').searchParams;

    t.deepEqual(parseUrlQuery(sp), { a: ['1', '2'], b: '3' });
    t.done();
});

test('parseUrlQuery: no query returns empty object', function(t) {
    var sp = new URL('/foo', 'http://localhost').searchParams;

    t.deepEqual(parseUrlQuery(sp), {});
    t.done();
});

// formatUrl

test('formatUrl: pathname only', function(t) {
    t.equal(formatUrl({ pathname: '/foo/bar' }), '/foo/bar');
    t.done();
});

test('formatUrl: hostname + pathname', function(t) {
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

test('formatUrl: hostname + port + pathname', function(t) {
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

test('formatUrl: pathname + query object', function(t) {
    t.equal(
        formatUrl({ pathname: '/foo', query: { a: '1', b: '2' } }),
        '/foo?a=1&b=2'
    );
    t.done();
});

test('formatUrl: string passthrough', function(t) {
    t.equal(formatUrl('/already/a/string'), '/already/a/string');
    t.equal(formatUrl('http://example.com/foo'), 'http://example.com/foo');
    t.done();
});

test('formatUrl: array query values become repeated params', function(t) {
    t.equal(
        formatUrl({ pathname: '/foo', query: { a: ['1', '2'] } }),
        '/foo?a=1&a=2'
    );
    t.done();
});

// mergeQs

test('merge qs', function(t) {
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
