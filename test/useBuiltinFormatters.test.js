'use strict';
/* eslint-disable func-names */

var assert = require('assert-plus');
var restifyClients = require('restify-clients');
var vasync = require('vasync');

var restify = require('../lib');
var restifyBuiltinFormatters = restify.formatters;
var shallowCopy = require('../lib/utils').shallowCopy;

if (require.cache[__dirname + '/lib/helper.js']) {
    delete require.cache[__dirname + '/lib/helper.js'];
}
var helper = require('./lib/helper.js');

///--- Globals

var before = helper.before;
var test = helper.test;

var CLIENT;
var CUSTOM_FORMATTERS;
var SERVER;

function getFormatterName(formatterString) {
    assert.string(formatterString, 'formatterString');
    return formatterString.split(';')[0];
}

///--- Tests

before(function(callback) {
    try {
        Object.keys(restifyBuiltinFormatters).forEach(function mockFormatter(
            formatterKey
        ) {
            var formatterName = formatterKey.split(';')[0];

            restifyBuiltinFormatters[formatterKey] = function mockedFormat(
                req,
                res,
                body
            ) {
                return formatterName;
            };
        });
        CUSTOM_FORMATTERS = shallowCopy(restifyBuiltinFormatters);
        callback();
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});

test('server default useBuiltinFormatters/strictFormatters', function(t) {
    SERVER = restify.createServer({
        handleUncaughtExceptions: true,
        log: helper.getLog('server')
    });
    SERVER.listen(0, '127.0.0.1', function() {
        var serverPort = SERVER.address().port;
        CLIENT = restifyClients.createStringClient({
            url: 'http://127.0.0.1:' + serverPort,
            dtrace: helper.dtrace,
            retry: false
        });

        t.end();
    });
});

test('default useBuiltinFormatters use built-in formatters', function(t) {
    SERVER.get('/', function handle(req, res, next) {
        res.send(200, 'foo');
        return next();
    });

    vasync.forEachParallel(
        {
            func: function reqForFormmater(formatterContentType, done) {
                CLIENT.get(
                    {
                        path: '/',
                        headers: {
                            accept: formatterContentType
                        }
                    },
                    function(err, req, res, body) {
                        t.ifError(err);
                        t.equal(res.statusCode, 200);
                        t.equal(
                            res.headers['content-type'],
                            formatterContentType
                        );
                        t.equal(body, formatterContentType);

                        done();
                    }
                );
            },
            inputs: Object.keys(restifyBuiltinFormatters).map(getFormatterName)
        },
        function(err) {
            t.end();
        }
    );
});

test('teardown server', function(t) {
    SERVER.close(function onServerClose() {
        t.end();
    });
    CLIENT.close();
});

test('server useBuiltinFormatters=true/default strictFormatters', function(t) {
    SERVER = restify.createServer({
        handleUncaughtExceptions: true,
        log: helper.getLog('server'),
        useBuiltinFormatters: true
    });
    SERVER.listen(0, '127.0.0.1', function() {
        var serverPort = SERVER.address().port;
        CLIENT = restifyClients.createStringClient({
            url: 'http://127.0.0.1:' + serverPort,
            dtrace: helper.dtrace,
            retry: false
        });

        t.end();
    });
});

test('response uses built-in formatters and successful', function(t) {
    SERVER.get('/', function handle(req, res, next) {
        res.send(200, 'foo');
        return next();
    });

    vasync.forEachParallel(
        {
            func: function reqForFormmater(formatterContentType, done) {
                CLIENT.get(
                    {
                        path: '/',
                        headers: {
                            accept: formatterContentType
                        }
                    },
                    function(err, req, res, body) {
                        t.ifError(err);
                        t.equal(res.statusCode, 200);
                        t.equal(
                            res.headers['content-type'],
                            formatterContentType
                        );
                        t.equal(body, formatterContentType);

                        done();
                    }
                );
            },
            inputs: Object.keys(restifyBuiltinFormatters).map(getFormatterName)
        },
        function(err) {
            t.end();
        }
    );
});

test('teardown server', function(t) {
    SERVER.close(function onServerClose() {
        t.end();
    });
    CLIENT.close();
});

test('server useBuiltinFormatters=false/strictFormatters=true', function(t) {
    SERVER = restify.createServer({
        handleUncaughtExceptions: true,
        log: helper.getLog('server'),
        useBuiltinFormatters: false,
        strictFormatters: true
    });
    SERVER.listen(0, '127.0.0.1', function() {
        var serverPort = SERVER.address().port;
        CLIENT = restifyClients.createStringClient({
            url: 'http://127.0.0.1:' + serverPort,
            dtrace: helper.dtrace,
            retry: false
        });

        t.end();
    });
});

test('requests error because no formatter available', function(t) {
    SERVER.get('/', function handle(req, res, next) {
        res.header('content-type', 'foo/bar');
        res.send(200, 'foo');
        return next();
    });

    vasync.forEachParallel(
        {
            func: function reqForFormmater(formatterContentType, done) {
                CLIENT.get(
                    {
                        path: '/',
                        headers: {
                            accept: formatterContentType
                        }
                    },
                    function(err, req, res, body) {
                        t.ok(err);
                        t.equal(res.statusCode, 500);
                        t.equal(res.headers['content-type'], 'foo/bar');
                        t.equal(body, '');

                        done();
                    }
                );
            },
            inputs: Object.keys(restifyBuiltinFormatters).map(getFormatterName)
        },
        function(err) {
            t.end();
        }
    );
});

test('teardown server', function(t) {
    SERVER.close(function onServerClose() {
        t.end();
    });
    CLIENT.close();
});

test(
    'server useBuiltinFormatters=false/strictFormatters=true/custom ' +
        'formatters',
    function(t) {
        SERVER = restify.createServer({
            handleUncaughtExceptions: true,
            log: helper.getLog('server'),
            useBuiltinFormatters: false,
            strictFormatters: true,
            formatters: CUSTOM_FORMATTERS
        });
        SERVER.listen(0, '127.0.0.1', function() {
            var serverPort = SERVER.address().port;
            CLIENT = restifyClients.createStringClient({
                url: 'http://127.0.0.1:' + serverPort,
                dtrace: helper.dtrace,
                retry: false
            });

            t.end();
        });
    }
);

test('response uses custom formatters and successful', function(t) {
    SERVER.get('/', function handle(req, res, next) {
        res.send(200, 'foo');
        return next();
    });

    vasync.forEachParallel(
        {
            func: function reqForFormmater(formatterContentType, done) {
                CLIENT.get(
                    {
                        path: '/',
                        headers: {
                            accept: formatterContentType
                        }
                    },
                    function(err, req, res, body) {
                        t.ifError(err);
                        t.equal(res.statusCode, 200);
                        t.equal(
                            res.headers['content-type'],
                            formatterContentType
                        );
                        t.equal(body, formatterContentType);

                        done();
                    }
                );
            },
            inputs: Object.keys(CUSTOM_FORMATTERS).map(getFormatterName)
        },
        function(err) {
            t.end();
        }
    );
});

test('teardown server', function(t) {
    SERVER.close(function onServerClose() {
        t.end();
    });
    CLIENT.close();
});

test('server useBuiltinFormatters=false/strictFormatters=false', function(t) {
    SERVER = restify.createServer({
        handleUncaughtExceptions: true,
        log: helper.getLog('server'),
        useBuiltinFormatters: false,
        strictFormatters: false
    });
    SERVER.listen(0, '127.0.0.1', function() {
        var serverPort = SERVER.address().port;
        CLIENT = restifyClients.createStringClient({
            url: 'http://127.0.0.1:' + serverPort,
            dtrace: helper.dtrace,
            retry: false
        });

        t.end();
    });
});

test('response does not use built-in formatters and successful', function(t) {
    SERVER.get('/', function handle(req, res, next) {
        res.header('content-type', 'foo/bar');
        res.send(200, 'foo');
        return next();
    });

    vasync.forEachParallel(
        {
            func: function reqForFormmater(formatterContentType, done) {
                CLIENT.get(
                    {
                        path: '/',
                        headers: {
                            accept: formatterContentType
                        }
                    },
                    function(err, req, res, body) {
                        t.ifError(err);
                        t.equal(res.statusCode, 200);
                        t.equal(res.headers['content-type'], 'foo/bar');
                        t.equal(body, 'foo');

                        done();
                    }
                );
            },
            inputs: Object.keys(restifyBuiltinFormatters).map(getFormatterName)
        },
        function(err) {
            t.end();
        }
    );
});

test('teardown server', function(t) {
    SERVER.close(function onServerClose() {
        t.end();
    });
    CLIENT.close();
});
