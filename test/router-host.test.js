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
            path: '/',
            host: 'subdomain1.example.com'
        }, function(req, res, next) {
            res.end('hello from subdomain 1');
            next();
        });
        SERVER.get({
            path: '/',
            host: 'subdomain2.example.com'
        }, function(req, res, next) {
            res.end('hello from subdomain 2');
            next();
        });
        SERVER.get('/foo', function(req, res, next) {
            res.end('hello from foo');
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

test('request for / in subdomain 1', function(t) {
    CLIENT.headers['Host'] = 'subdomain1.example.com';
    CLIENT.get('/', function(err, req, res, data) {
        t.ifError(err);
        t.equal('hello from subdomain 1', data);
        t.end();
    });
});

test('request for / in subdomain 2', function(t) {
    CLIENT.headers['Host'] = 'subdomain2.example.com';
    CLIENT.get('/', function(err, req, res, data) {
        t.ifError(err);
        t.equal('hello from subdomain 2', data);
        t.end();
    });
});

test('request for /foo in subdomain 1', function(t) {
    CLIENT.headers['Host'] = 'subdomain1.example.com';
    CLIENT.get('/foo', function(err, req, res, data) {
        t.ifError(err);
        t.equal('hello from foo', data);
        t.end();
    });
});

test('request for /foo in subdomain 2', function(t) {
    CLIENT.headers['Host'] = 'subdomain2.example.com';
    CLIENT.get('/foo', function(err, req, res, data) {
        t.ifError(err);
        t.equal('hello from foo', data);
        t.end();
    });
});