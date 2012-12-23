// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var http = require('http');

var uuid = require('node-uuid');

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
var USERNAME = uuid();
var PASSWORD = uuid();



///--- Tests






//--- Tests

test('setup', function (t) {
        SERVER = restify.createServer({
                dtrace: helper.dtrace,
                log: helper.getLog('server')
        });

        SERVER.use(function ghettoAuthenticate(req, res, next) {
                if (req.params.name)
                        req.username = req.params.name;

                next();
        });

        SERVER.use(restify.throttle({
                burst: 1,
                rate: 0.5,
                username: true,
                overrides: {
                        'admin': {
                                burst: 0,
                                rate: 0
                        },
                        'special': {
                                burst: 3,
                                rate: 1
                        }
                }
        }));

        SERVER.get('/test/:name', function (req, res, next) {
                res.send();
                next();
        });

        SERVER.listen(PORT, '127.0.0.1', function () {
                PORT = SERVER.address().port;
                CLIENT = restify.createJsonClient({
                        url: 'http://127.0.0.1:' + PORT,
                        dtrace: helper.dtrace,
                        retry: false
                });

                t.end();
        });
});


test('ok', function (t) {
        CLIENT.get('/test/throttleMe', function (err, _, res) {
                t.ifError(err);
                t.equal(res.statusCode, 200);
                t.end();
        });
});


test('throttled', function (t) {
        CLIENT.get('/test/throttleMe', function (err, _, res) {
                t.ok(err);
                t.equal(err.statusCode, 429);
                t.ok(err.message);
                t.equal(res.statusCode, 429);
                setTimeout(function () { t.end(); }, 2100);
        });
});


test('ok after tokens', function (t) {
        CLIENT.get('/test/throttleMe', function (err, _, res) {
                t.ifError(err);
                t.equal(res.statusCode, 200);
                t.end();
        });
});


test('override limited', function (t) {
        CLIENT.get('/test/special', function (err, _, res) {
                t.ifError(err);
                t.equal(res.statusCode, 200);
                t.end();
        });
});


test('override limited (not throttled)', function (t) {
        CLIENT.get('/test/special', function (err, _, res) {
                t.ifError(err);
                t.equal(res.statusCode, 200);
                t.end();
        });
});


test('override unlimited', function (t) {
        CLIENT.get('/test/admin', function (err, _, res) {
                t.ifError(err);
                t.equal(res.statusCode, 200);
                t.end();
        });
});


test('override unlimited (not throttled)', function (t) {
        CLIENT.get('/test/admin', function (err, _, res) {
                t.ifError(err);
                t.equal(res.statusCode, 200);
                t.end();
        });
});


test('shutdown', function (t) {
        SERVER.close(function () {
                t.end();
        });
});
