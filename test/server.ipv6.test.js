// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');
var fs = require('fs');
var http = require('http');

var filed = require('filed');
var uuid = require('node-uuid');

var HttpError = require('../lib/errors').HttpError;
var RestError = require('../lib/errors').RestError;
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

before(function (cb) {
    try {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server'),
            version: ['2.0.0', '0.5.4', '1.4.3']
        });
        SERVER.listen(PORT, '::1', function () {
            PORT = SERVER.address().port;
            CLIENT = restify.createJsonClient({
                url: 'http://[::1]:' + PORT,
                dtrace: helper.dtrace,
                retry: false
            });

            cb();
        });
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});


after(function (cb) {
    try {
        CLIENT.close();
        SERVER.close(function () {
            CLIENT = null;
            SERVER = null;
            cb();
        });
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});

test('url getter for IPv6', function (t) {
    t.equal(SERVER.url, 'http://[::1]:' + PORT);
    t.end();
});

test('get (path only)', function (t) {
    var r = SERVER.get('/foo/:id', function echoId(req, res, next) {
        t.ok(req.params);
        t.equal(req.params.id, 'bar');
        t.equal(req.isUpload(), false);
        res.send();
        next();
    });

    var count = 0;
    SERVER.once('after', function (req, res, route) {
        t.ok(req);
        t.ok(res);
        t.equal(r, route.name);
        if (++count === 2)
        t.end();
    });

    CLIENT.get('/foo/bar', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        if (++count === 2)
        t.end();
    });
});

test('use + get (path only)', function (t) {
    SERVER.use(function (req, res, next) {
        next();
    });
    SERVER.get('/foo/:id', function tester(req, res, next) {
        t.ok(req.params);
        t.equal(req.params.id, 'bar');
        res.send();
        next();
    });

    CLIENT.get('/foo/bar', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});
