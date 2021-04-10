// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';
/* eslint-disable func-names */

var restifyClients = require('restify-clients');
var errors = require('restify-errors');
var sinon = require('sinon');

var restify = require('../lib');
var jsonFormatter = require('../lib/formatters/json');

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

before(function(callback) {
    try {
        SERVER = restify.createServer({
            handleUncaughtExceptions: true,
            formatters: {
                'text/sync': function(req, res, body) {
                    return 'sync fmt';
                },
                'text/syncerror': function(req, res, body) {
                    // this is a bad formatter, on purpose.
                    return x.toString(); // eslint-disable-line no-undef
                },
                'text/syncerror_expected': function(req, res, body) {
                    throw new errors.InternalServerError('Errors happen');
                },
                'application/foo; q=0.9': function(req, res, body) {
                    return 'foo!';
                },
                'application/bar; q=0.1': function(req, res, body) {
                    return 'bar!';
                }
            },
            dtrace: helper.dtrace,
            log: helper.getLog('server'),
            version: ['2.0.0', '0.5.4', '1.4.3']
        });
        SERVER.listen(PORT, '127.0.0.1', function() {
            PORT = SERVER.address().port;
            CLIENT = restifyClients.createStringClient({
                url: 'http://127.0.0.1:' + PORT,
                dtrace: helper.dtrace,
                retry: false,
                agent: false
            });
            SERVER.get('/sync', function(req, res, next) {
                res.send('dummy response');
                return next();
            });
            SERVER.get('/missingFormatter', function(req, res, next) {
                delete res.formatters['application/octet-stream'];
                res.setHeader('content-type', 'text/html');
                res.send('dummy response');
                return next();
            });
            SERVER.get('/jsonpSeparators', function(req, res, next) {
                res.setHeader('content-type', 'application/javascript');
                res.send(
                    String.fromCharCode(0x2028) + String.fromCharCode(0x2029)
                );
                return next();
            });
            process.nextTick(callback);
        });
    } catch (e) {
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

test('GH-845: sync formatter', function(t) {
    CLIENT.get(
        {
            path: '/sync',
            headers: {
                accept: 'text/sync'
            }
        },
        function(err, req, res, data) {
            t.ifError(err);
            t.ok(req);
            t.ok(res);
            t.equal(data, 'sync fmt');
            t.end();
        }
    );
});

test('GH-845: sync formatter should blow up', function(t) {
    SERVER.once('uncaughtException', function(req, res, route, err) {
        t.ok(err);
        t.equal(err.name, 'ReferenceError');
        t.equal(err.message, 'x is not defined');
        res.write('uncaughtException');
        res.end();
    });

    CLIENT.get(
        {
            path: '/sync',
            headers: {
                accept: 'text/syncerror'
            }
        },
        function(err, req, res, data) {
            t.equal(data, 'uncaughtException');
            t.end();
        }
    );
});

test('sync formatter should handle expected errors gracefully', function(t) {
    SERVER.once('uncaughtException', function(req, res, route, err) {
        throw new Error('Should not reach');
    });

    CLIENT.get(
        {
            path: '/sync',
            headers: {
                accept: 'text/syncerror_expected'
            }
        },
        function(err, req, res, data) {
            t.ok(err);
            t.ok(req);
            t.ok(res);
            t.equal(res.statusCode, 500);
            SERVER.removeAllListeners('uncaughtException');
            t.end();
        }
    );
});

test('q-val priority', function(t) {
    var opts = {
        path: '/sync',
        headers: {
            accept: 'application/*'
        }
    };
    CLIENT.get(opts, function(err, req, res, data) {
        t.ifError(err);
        t.ok(req);
        t.ok(res);
        t.equal(data, 'foo!');
        t.end();
    });
});

test('GH-771 q-val priority on */*', function(t) {
    var opts = {
        path: '/sync',
        headers: {
            accept: '*/*'
        }
    };

    // this test is a little flaky - it will look for first formatter that
    // satisfies q-val but in this test we have a bunch of bad formatters.
    // it appears V8 will use the first found formatter (this case, text/sync).
    CLIENT.get(opts, function(err, req, res, data) {
        t.ifError(err);
        t.ok(req);
        t.ok(res);
        t.equal(data, 'sync fmt');
        t.end();
    });
});

test(
    'GH-937 should return 406 when no content-type header set on response ' +
        'matching an acceptable type found by matching client',
    function(t) {
        // ensure client accepts only a type not specified by server
        var opts = {
            path: '/sync',
            headers: {
                accept: 'text/html'
            }
        };

        CLIENT.get(opts, function(err, req, res, data) {
            t.ok(err);
            t.ok(req);
            t.ok(res);
            t.equal(res.statusCode, 406);
            t.end();
        });
    }
);

test(
    'GH-937 should return 500 when no default formatter found ' +
        'and octet-stream is not available',
    function(t) {
        // ensure client accepts only a type not specified by server
        var opts = {
            path: '/missingFormatter',
            headers: {
                accept: 'text/html'
            }
        };

        CLIENT.get(opts, function(err, req, res, data) {
            t.ok(err);
            t.ok(req);
            t.ok(res);
            t.equal(res.statusCode, 500);
            t.end();
        });
    }
);

// eslint-disable-next-line
test('default jsonp formatter should escape line and paragraph separators', function(t) {
    // ensure client accepts only a type not specified by server
    var opts = {
        path: '/jsonpSeparators',
        headers: {
            accept: 'application/javascript'
        }
    };

    CLIENT.get(opts, function(err, req, res, data) {
        t.ifError(err);
        t.ok(req);
        t.ok(res);
        t.equal(data, '"\\u2028\\u2029"');
        t.end();
    });
});

// eslint-disable-next-line
test('default json formatter should wrap & throw InternalServer error on unserializable bodies', function(t) {
    t.expect(2);

    sinon.spy(JSON, 'stringify');

    SERVER.once('uncaughtException', function(req, res, route, err) {
        console.log(err.stack); // For convenience
        throw new Error('Should not reach');
    });

    var opts = {
        path: '/badJSON',
        name: 'badJSON'
    };

    SERVER.get(opts, function(req, res, next) {
        var body = {};
        // Add unserializable circular reference
        body.body = body;

        try {
            jsonFormatter(req, res, body);
            throw new Error('Should not reach');
        } catch (e) {
            t.ok(e instanceof errors.InternalServerError);
            t.ok(JSON.stringify.threw(e.cause()));
        }

        res.send();
    });

    CLIENT.get('/badJSON', function(err, req, res, data) {
        SERVER.rm('badJSON');
        SERVER.removeAllListeners('uncaughtException');
        JSON.stringify.restore();
        t.end();
    });
});
