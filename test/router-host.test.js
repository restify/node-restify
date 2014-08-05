// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');
var restify = require('../lib');
if (require.cache[__dirname + '/lib/helper.js'])
    delete require.cache[__dirname + '/lib/helper.js'];
var helper = require('./lib/helper.js');


///--- Globals
var after = helper.after;
var before = helper.before;
var test = helper.test;

var PORT = process.env.UNIT_TEST_PORT || 0;
var CLIENT;
var SERVER;

///--- Tests

before(function(callback) {
    try {
        SERVER = restify.createServer();
        SERVER.get({
            path: '/hello',
            host: 'subdomain1.example.com'
        }, function(req, res, next) {
            res.end('hello from subdomain 1');
            next();
        });
        SERVER.get({
            path: '/baz',
            host: 'subdomain1.example.com'
        }, function(req, res, next) {
            res.end('baz from subdomain 1');
            next();
        });
        SERVER.get({
            path: '/hello',
            host: 'subdomain2.example.com'
        }, function(req, res, next) {
            res.end('hello from subdomain 2');
            next();
        });
        SERVER.get({
            path: '/bar',
            host: 'subdomain2.example.com'
        }, function(req, res, next) {
            res.end('bar from subdomain 2');
            next();
        });
        SERVER.get('/foo', function(req, res, next) {
            res.end('foo from any domain');
            next();
        });
        SERVER.listen(PORT, '127.0.0.1', function () {
            PORT = SERVER.address().port;
            CLIENT = restify.createStringClient({
                url: 'http://127.0.0.1:' + PORT,
                dtrace: helper.dtrace,
                retry: false,
                agent: false
            });
            process.nextTick(callback);
        });
    }
    catch(e) {
        console.error(e.stack);
        process.exit(1);
    }
});

after(function(callback) {
    try {
        SERVER.close(callback);
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});

test('request for /hello in subdomain 1', function(t) {
    CLIENT.headers['Host'] = 'subdomain1.example.com';
    CLIENT.get('/hello', function(err, req, res, data) {
        t.ifError(err);
        t.equal('hello from subdomain 1', data);
        t.end();
    });
});

test('request for /bar in subdomain 1', function(t) {
    CLIENT.headers['Host'] = 'subdomain1.example.com';
    CLIENT.get('/bar', function(err, req, res, data) {
        // t.ifError(err);
        t.equal(res.statusCode, 404);
        t.end();
    });
});

test('request for /bar in subdomain 2', function(t) {
    CLIENT.headers['Host'] = 'subdomain2.example.com';
    CLIENT.get('/bar', function(err, req, res, data) {
        t.ifError(err);
        t.equal('bar from subdomain 2', data);
        t.end();
    });
});

test('request for /hello in subdomain 2', function(t) {
    CLIENT.headers['Host'] = 'subdomain2.example.com';
    CLIENT.get('/hello', function(err, req, res, data) {
        t.ifError(err);
        t.equal('hello from subdomain 2', data);
        t.end();
    });
});

test('request for /baz in subdomain 2', function(t) {
    CLIENT.headers['Host'] = 'subdomain2.example.com';
    CLIENT.get('/baz', function(err, req, res, data) {
        // t.ifError(err);
        t.equal(res.statusCode, 404);
        t.end();
    });
});

test('request for /baz in subdomain 1', function(t) {
    CLIENT.headers['Host'] = 'subdomain1.example.com';
    CLIENT.get('/baz', function(err, req, res, data) {
        t.ifError(err);
        t.equal('baz from subdomain 1', data);
        t.end();
    });
});

test('request for /foo in subdomain 1', function(t) {
    CLIENT.headers['Host'] = 'subdomain1.example.com';
    CLIENT.get('/foo', function(err, req, res, data) {
        t.ifError(err);
        t.equal('foo from any domain', data);
        t.end();
    });
});

test('request for /foo in subdomain 2', function(t) {
    CLIENT.headers['Host'] = 'subdomain2.example.com';
    CLIENT.get('/foo', function(err, req, res, data) {
        t.ifError(err);
        t.equal('foo from any domain', data);
        t.end();
    });
});