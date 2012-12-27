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

var isFirstRequest = true;


///--- Tests

before(function (callback) {
        try {
                SERVER = restify.createServer({
                        formatters: {
                                'text/plain': function (req, res, body, cb) {
                                        if (isFirstRequest) {
                                                process.nextTick(function () {
                                                        isFirstRequest = false;
                                                        cb(null, 'async fmt');
                                                });
                                                return (this);
                                        }

                                        return ('sync fmt');
                                },
                                'application/foo; q=0.9': function () {
                                        return ('foo!');
                                }
                        },
                        dtrace: helper.dtrace,
                        log: helper.getLog('server'),
                        version: ['2.0.0', '0.5.4', '1.4.3']
                });
                SERVER.listen(PORT, '127.0.0.1', function () {
                        PORT = SERVER.address().port;
                        CLIENT = restify.createStringClient({
                                url: 'http://127.0.0.1:' + PORT,
                                dtrace: helper.dtrace,
                                retry: false
                        });
                        SERVER.get('/tmp', function (req, res) {
                                res.send('dummy response');
                        });
                        process.nextTick(callback);
                });
        } catch (e) {
                console.error(e.stack);
                process.exit(1);
        }
});


after(function (callback) {
        try {
                SERVER.close(callback);
        } catch (e) {
                console.error(e.stack);
                process.exit(1);
        }
});


test('async formatter', function (t) {
        CLIENT.get('/tmp', function (err, req, res, data) {
                t.ifError(err);
                t.ok(req);
                t.ok(res);
                t.equal(data, 'async fmt');
                t.end();
        });
});

test('sync formatter', function (t) {
        CLIENT.get('/tmp', function (err, req, res, data) {
                t.ifError(err);
                t.ok(req);
                t.ok(res);
                t.equal(data, 'sync fmt');
                t.end();
        });
});


test('q-val priority', function (t) {
        var opts = {
                path: '/tmp',
                headers: {
                        accept: 'application/*'
                }
        };
        CLIENT.get(opts, function (err, req, res, data) {
                t.ifError(err);
                t.ok(req);
                t.ok(res);
                t.equal(data, 'foo!');
                t.end();
        });
});