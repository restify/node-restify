// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var restify = require('../lib');

if (require.cache[__dirname + '/lib/helper.js']) {
    delete require.cache[__dirname + '/lib/helper.js'];
}
var helper = require('./lib/helper.js');


///--- Globals

var after = helper.after;
var before = helper.before;
var test = helper.test;

var PORT = process.env.UNIT_TEST_PORT || 0;
var CLIENT;
var SERVER;

var reqCount = 0;


///--- Tests

before(function (callback) {
    try {
        SERVER = restify.createServer({
            formatters: {
                'text/plain': function (req, res, body, cb) {
                    if (reqCount === 0) {
                        return process.nextTick(function () {
                            reqCount++;
                            cb(null, 'async fmt');
                        });
                    } else if (reqCount === 1) {
                        return process.nextTick(function () {
                            reqCount++;
                            cb(new Error('foobar'), 'async fmt');
                        });
                    } else {
                        return cb(null, 'sync fmt');
                    }
                },
                'application/foo; q=0.9': function (req, res, body, cb) {
                    return cb(null, 'foo!');
                },
                'application/bar; q=0.1': function (req, res, body, cb) {
                    return cb(null, 'bar!');
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
                retry: false,
                agent: false
            });
            SERVER.get('/tmp', function (req, res, next) {
                res.send('dummy response');
                return next();
            });
            SERVER.get('/tmp2', function (req, res, next) {
                delete res.formatters['application/octet-stream'];
                res.setHeader('content-type', 'text/html');
                res.send('dummy response');
                return next();
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

test('async formatter error', function (t) {
    SERVER.once('after', function (req, res, route, e) {
        // TODO: add a test here to verify error has been emitted.
        // Pending #845
    });
    CLIENT.get('/tmp', function (err, req, res, data) {
        t.ok(err);
        t.equal(err.statusCode, 500);
        t.ok(req);
        t.ok(res);
        t.notOk(data);
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

test('GH-771 q-val priority on */*', function (t) {
    var opts = {
        path: '/tmp',
        headers: {
            accept: '*/*'
        }
    };
    CLIENT.get(opts, function (err, req, res, data) {
        t.ifError(err);
        t.ok(req);
        t.ok(res);
        t.equal(data, 'sync fmt');
        t.end();
    });
});

test('GH-937 should return 406 when no content-type header set on response ' +
'matching an acceptable type found by matching client', function (t) {

    // ensure client accepts only a type not specified by server
    var opts = {
        path: '/tmp',
        headers: {
            accept: 'text/html'
        }
    };

    CLIENT.get(opts, function (err, req, res, data) {
        t.ok(err);
        t.ok(req);
        t.ok(res);
        t.equal(res.statusCode, 406);
        t.end();
    });
});

test('GH-937 should return 500 when no default formatter found ' +
'and octet-stream is not available', function (t) {

    // ensure client accepts only a type not specified by server
    var opts = {
        path: '/tmp2',
        headers: {
            accept: 'text/html'
        }
    };

    CLIENT.get(opts, function (err, req, res, data) {
        t.ok(err);
        t.ok(req);
        t.ok(res);
        t.equal(res.statusCode, 500);
        t.end();
    });
});
