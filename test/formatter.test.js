// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var restifyClients = require('restify-clients');

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


///--- Tests

before(function (callback) {
    try {
        SERVER = restify.createServer({
            handleUncaughtExceptions: true,
            formatters: {
                'text/sync': function (req, res, body) {
                    return 'sync fmt';
                },
                'text/syncerror': function (req, res, body) {
                    // this is a bad formatter, on purpose.
                    return x.toString(); // eslint-disable-line no-undef
                },
                'text/async': function (req, res, body, cb) {
                    return process.nextTick(function () {
                        cb(null, 'async fmt');
                    });
                },
                'text/asyncerror': function (req, res, body, cb) {
                    return process.nextTick(function () {
                        cb(new Error('foobar'));
                    });
                },
                'application/foo; q=0.9': function (req, res, body) {
                    return 'foo!';
                },
                'application/bar; q=0.1': function (req, res, body) {
                    return 'bar!';
                }
            },
            dtrace: helper.dtrace,
            log: helper.getLog('server'),
            version: ['2.0.0', '0.5.4', '1.4.3']
        });
        SERVER.listen(PORT, '127.0.0.1', function () {
            PORT = SERVER.address().port;
            CLIENT = restifyClients.createStringClient({
                url: 'http://127.0.0.1:' + PORT,
                dtrace: helper.dtrace,
                retry: false,
                agent: false
            });
            SERVER.get('/sync', function (req, res, next) {
                res.send('dummy response');
                return next();
            });
            SERVER.get('/async', function (req, res, next) {
                res.send('dummy response', next);
            });
            SERVER.get('/asyncHandle', function (req, res, next) {
                res.send('dummy resposne', function (err) {
                    res.writeHead(201);
                    res.write('panda');
                    res.end();
                    return next();
                });
            });
            SERVER.get('/missingFormatter', function (req, res, next) {
                delete res.formatters['application/octet-stream'];
                res.setHeader('content-type', 'text/html');
                res.send('dummy response');
                return next();
            });
            SERVER.get('/jsonpSeparators', function (req, res, next) {
                res.setHeader('content-type', 'application/javascript');
                res.send(String.fromCharCode(0x2028)
                         + String.fromCharCode(0x2029));
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


test('GH-845: sync formatter', function (t) {

    CLIENT.get({
        path: '/sync',
        headers: {
            accept: 'text/sync'
        }
    }, function (err, req, res, data) {
        t.ifError(err);
        t.ok(req);
        t.ok(res);
        t.equal(data, 'sync fmt');
        t.end();
    });
});


test('GH-845: sync formatter should blow up', function (t) {

    SERVER.on('uncaughtException', function (req, res, route, err) {
        t.ok(err);
        t.equal(err.name, 'ReferenceError');
        t.equal(err.message, 'x is not defined');
        res.write('uncaughtException');
        res.end();
    });

    CLIENT.get({
        path: '/sync',
        headers: {
            accept: 'text/syncerror'
        }
    }, function (err, req, res, data) {
        t.equal(data, 'uncaughtException');
        t.end();
    });
});


test('GH-845: async formatter', function (t) {

    CLIENT.get({
        path: '/async',
        headers: {
            accept: 'text/async'
        }
    }, function (err, req, res, data) {
        t.ifError(err);
        t.ok(req);
        t.ok(res);
        t.equal(data, 'async fmt');
        t.end();
    });
});


test('GH-845: async formatter error should invoke res.send() callback with err',
function (t) {

    CLIENT.get({
        path: '/asyncHandle',
        headers: {
            accept: 'text/asyncerror'
        }
    }, function (err, req, res, data) {
        t.ifError(err);
        t.ok(req);
        t.ok(res);
        t.equal(res.statusCode, 201);
        t.equal(data, 'panda');
        t.end();
    });

});


test('GH-845: async formatter error should send empty string if passed to next',
function (t) {

    CLIENT.get({
        path: '/async',
        headers: {
            accept: 'text/asyncerror'
        }
    }, function (err, req, res, data) {
        t.ok(err);
        t.equal(res.statusCode, 500);
        t.equal(data, '');
        t.end();
    });
});


test('GH-845: async formatter error should emit FormatterError', function (t) {

    SERVER.on('FormatterError', function (req, res, route, err) {
        t.ok(err);
        t.equal(err.code, 'Formatter');
        res.end('custom formatter error');
    });

    CLIENT.get({
        path: '/async',
        headers: {
            accept: 'text/asyncerror'
        }
    }, function (err, req, res, data) {
        t.ok(err);
        t.equal(res.statusCode, 500);
        t.equal(data, 'custom formatter error');
        t.end();
    });
});


test('GH-1129: sync formatter should invoke res.send callback', function (t) {

    SERVER.on('after', function () {
        // only end the test when server considers request complete
        t.end();
    });

    CLIENT.get({
        path: '/async',
        headers: {
            accept: 'text/sync'
        }
    }, function (err, req, res, data) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.equal(data, 'sync fmt');
    });
});


test('GH-845: should blow up when using async formatter ' +
     'without res.send callback', function (t) {

    SERVER.on('uncaughtException', function (req, res, route, err) {
        t.ok(err);
        t.equal(err.name, 'AssertionError');
        t.equal(err.message, 'async formatter for text/async requires ' +
                'callback to res.send() (func) is required');
        res.write('uncaughtException');
        res.end();
    });

    CLIENT.get({
        path: '/sync',
        headers: {
            accept: 'text/async'
        }
    }, function (err, req, res, data) {
        t.equal(data, 'uncaughtException');
        t.end();
    });
});


test('q-val priority', function (t) {
    var opts = {
        path: '/sync',
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
        path: '/sync',
        headers: {
            accept: '*/*'
        }
    };


    // this test is a little flaky - it will look for first formatter that
    // satisfies q-val but in this test we have a bunch of bad formatters.
    // it appears V8 will use the first found formatter (this case, text/sync).
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
        path: '/sync',
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
        path: '/missingFormatter',
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


test('default jsonp formatter should escape ' +
     'line and paragraph separators', function (t) {

    // ensure client accepts only a type not specified by server
    var opts = {
        path: '/jsonpSeparators',
        headers: {
            accept: 'application/javascript'
        }
    };

    CLIENT.get(opts, function (err, req, res, data) {
        t.ifError(err);
        t.ok(req);
        t.ok(res);
        t.equal(data, '"\\u2028\\u2029"');
        t.end();
    });
});
