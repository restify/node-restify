'use strict';
/* eslint-disable func-names */

var url = require('url');
var restifyClients = require('restify-clients');
var errs = require('restify-errors');

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
var STRING_CLIENT;
var SERVER;

var LOCALHOST;
var SLOCALHOST;

before(function(cb) {
    try {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            handleUncaughtExceptions: true,
            log: helper.getLog('server'),
            version: ['2.0.0', '0.5.4', '1.4.3']
        });
        SERVER.use(restify.plugins.queryParser());
        SERVER.listen(PORT, '127.0.0.1', function() {
            PORT = SERVER.address().port;
            CLIENT = restifyClients.createJsonClient({
                url: 'http://127.0.0.1:' + PORT,
                dtrace: helper.dtrace,
                retry: false
            });
            STRING_CLIENT = restifyClients.createStringClient({
                url: 'http://127.0.0.1:' + PORT,
                dtrace: helper.dtrace,
                retry: false
            });
            LOCALHOST = 'http://' + '127.0.0.1:' + PORT;
            SLOCALHOST = 'https://' + '127.0.0.1:' + PORT;

            cb();
        });
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});

after(function(cb) {
    try {
        CLIENT.close();
        STRING_CLIENT.close();
        SERVER.close(function() {
            CLIENT = null;
            SERVER = null;
            cb();
        });
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});

// helper for joining array into strings
function join() {
    var args = [].slice.call(arguments, 0);
    return args.join('');
}

test('redirect to new string url as-is', function(t) {
    SERVER.get('/1', function(req, res, next) {
        res.redirect('www.foo.com', next);
    });

    CLIENT.get(join(LOCALHOST, '/1'), function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, 'www.foo.com');
        t.end();
    });
});

test('redirect to new relative string url as-is', function(t) {
    SERVER.get('/20', function(req, res, next) {
        res.redirect('/1', next);
    });

    CLIENT.get(join(LOCALHOST, '/20?a=1'), function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, '/1');
        t.end();
    });
});

test('redirect to current url (reload)', function(t) {
    SERVER.get('/2', function(req, res, next) {
        res.redirect(
            {
                reload: true
            },
            next
        );
    });

    CLIENT.get(join(LOCALHOST, '/2'), function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, join(LOCALHOST, '/2'));
        t.end();
    });
});

test('redirect to current url from http -> https', function(t) {
    SERVER.get('/3', function(req, res, next) {
        res.redirect(
            {
                secure: true
            },
            next
        );
    });

    CLIENT.get(join(LOCALHOST, '/3'), function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, join(SLOCALHOST, '/3'));
        t.end();
    });
});

test('redirect to current url from https -> http', function(t) {
    SERVER.get('/3', function(req, res, next) {
        res.redirect(
            {
                reload: true,
                secure: false
            },
            next
        );
    });

    CLIENT.get(join(LOCALHOST, '/3'), function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, join(LOCALHOST, '/3'));
        t.end();
    });
});

test('redirect by changing path', function(t) {
    SERVER.get('/4', function(req, res, next) {
        res.redirect(
            {
                pathname: '1'
            },
            next
        );
    });

    CLIENT.get(join(LOCALHOST, '/4'), function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, join(LOCALHOST, '/1'));
        t.end();
    });
});

test(
    'GH-1494: redirect should succeed even if req.url does not specify host' +
        ' or protocol',
    function(t) {
        SERVER.get('/5', function(req, res, next) {
            res.redirect(
                {
                    pathname: '/'
                },
                next
            );
        });

        // use a relative URL here instead of request with full
        // protocol and host.
        // this causes node to receive different values for req.url,
        // which affects
        // how reconstruction of the redirect URL is done. for example including
        // full host will result in a req.url value of:
        //         http://127.0.0.1:57824/5
        // using relative URL results in a req.url value of:
        //         /5
        // this causes a bug as documented in GH-1494
        CLIENT.get('/5', function(err, _, res) {
            t.ifError(err);
            t.equal(res.statusCode, 302);
            t.equal(res.headers.location, '/');
            t.end();
        });
    }
);

test('redirect should add query params', function(t) {
    SERVER.get('/5', function(req, res, next) {
        res.redirect(
            {
                query: {
                    a: 1
                }
            },
            next
        );
    });

    CLIENT.get(join(LOCALHOST, '/5'), function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, join(LOCALHOST, '/5?a=1'));
        t.end();
    });
});

test('redirect should extend existing query params', function(t) {
    SERVER.get('/6', function(req, res, next) {
        res.redirect(
            {
                query: {
                    b: 2
                }
            },
            next
        );
    });

    CLIENT.get(join(LOCALHOST, '/6?a=1'), function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        var parsedUrl = url.parse(res.headers.location, true);
        t.deepEqual(parsedUrl.query, {
            a: 1,
            b: 2
        });
        t.equal(parsedUrl.query.b, 2);
        t.equal(parsedUrl.pathname, '/6');

        // t.equal(res.headers.location, join(LOCALHOST, '/6?a=1&b=2'));
        t.end();
    });
});

test('redirect should stomp over existing query params', function(t) {
    SERVER.get('/7', function(req, res, next) {
        res.redirect(
            {
                overrideQuery: true,
                query: {
                    b: 2
                }
            },
            next
        );
    });

    CLIENT.get(join(LOCALHOST, '/7?a=1'), function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, join(LOCALHOST, '/7?b=2'));
        t.end();
    });
});

test('redirect with 301 status code', function(t) {
    SERVER.get('/8', function(req, res, next) {
        res.redirect(
            {
                permanent: true
            },
            next
        );
    });

    CLIENT.get(join(LOCALHOST, '/8'), function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 301);
        t.equal(res.headers.location, join(LOCALHOST, '/8'));
        t.end();
    });
});

test('redirect with 301 status code ising string url', function(t) {
    SERVER.get('/30', function(req, res, next) {
        res.redirect(301, '/foo', next);
    });

    CLIENT.get(join(LOCALHOST, '/30'), function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 301);
        t.equal(res.headers.location, '/foo');
        t.end();
    });
});

test('redirect using options.url', function(t) {
    SERVER.get('/8', function(req, res, next) {
        res.redirect(
            {
                hostname: 'www.foo.com',
                pathname: '/8',
                query: {
                    a: 1
                }
            },
            next
        );
    });

    CLIENT.get(join(LOCALHOST, '/8'), function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, 'http://www.foo.com/8?a=1');
        t.end();
    });
});

test('redirect using opts.port', function(t) {
    SERVER.get('/9', function(req, res, next) {
        res.redirect(
            {
                port: 3000
            },
            next
        );
    });

    CLIENT.get(join(LOCALHOST, '/9'), function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        var parsedUrl = url.parse(res.headers.location, true);
        t.equal(parsedUrl.port, 3000);
        t.end();
    });
});

test('redirect using external url and custom port', function(t) {
    SERVER.get('/9', function(req, res, next) {
        res.redirect(
            {
                hostname: 'www.foo.com',
                pathname: '/99',
                port: 3000
            },
            next
        );
    });

    CLIENT.get(join(LOCALHOST, '/9'), function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        var parsedUrl = url.parse(res.headers.location, true);
        t.equal(parsedUrl.port, 3000);
        t.equal(parsedUrl.hostname, 'www.foo.com');
        t.equal(parsedUrl.pathname, '/99');
        t.end();
    });
});

test('redirect using default hostname with custom port', function(t) {
    SERVER.get('/9', function(req, res, next) {
        res.redirect(
            {
                pathname: '/99',
                port: 3000
            },
            next
        );
    });

    CLIENT.get(join(LOCALHOST, '/9'), function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        var parsedUrl = url.parse(res.headers.location, true);
        t.equal(parsedUrl.port, 3000);
        t.equal(parsedUrl.pathname, '/99');
        t.equal(res.headers.location, 'http://127.0.0.1:3000/99');
        t.end();
    });
});

// eslint-disable-next-line
test('redirect should cause InternalError when invoked without next', function(t) {
    SERVER.get('/9', function(req, res, next) {
        res.redirect();
    });

    CLIENT.get(join(LOCALHOST, '/9'), function(err, _, res, body) {
        t.equal(res.statusCode, 500);

        // json parse the response
        t.equal(body.code, 'Internal');
        t.end();
    });
});

// eslint-disable-next-line
test('redirect should call next with false to stop handler stack execution', function(t) {
    var wasRun = false;

    function A(req, res, next) {
        req.a = 1;
        next();
    }
    function B(req, res, next) {
        req.b = 2;
        wasRun = true;
        next();
    }
    function redirect(req, res, next) {
        res.redirect('/10', next);
    }

    SERVER.get('/10', [A, redirect, B]);

    CLIENT.get(join(LOCALHOST, '/10'), function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, '/10');

        // handler B should not be executed
        t.equal(wasRun, false);
        t.end();
    });
});

test('redirect should emit a redirect event', function(t) {
    var wasEmitted = false;
    var redirectLocation;

    function preRedirectHandler(req, res, next) {
        res.on('redirect', function(payload) {
            wasEmitted = true;
            redirectLocation = payload;
        });
        next();
    }
    function redirect(req, res, next) {
        res.redirect('/10', next);
    }

    SERVER.get('/10', [preRedirectHandler, redirect]);

    CLIENT.get(join(LOCALHOST, '/10'), function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, '/10');

        // event 'redirect' should have been emitted
        t.equal(wasEmitted, true);
        t.equal(redirectLocation, '/10');
        t.end();
    });
});

test('writeHead should emit a header event', function(t) {
    var wasEmitted = false;
    var payloadPlaceholder;

    // writeHead is called on each request
    function handler(req, res, next) {
        res.on('header', function(payload) {
            wasEmitted = true;
            payloadPlaceholder = payload;
        });
        res.send(302);
        next();
    }

    SERVER.get('/10', [handler]);

    CLIENT.get(join(LOCALHOST, '/10'), function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);

        // event 'header' should have been emitted
        t.equal(wasEmitted, true);
        t.equal(payloadPlaceholder, undefined);
        t.end();
    });
});

test('should fail to set header due to missing formatter', function(t) {
    // when a formatter is not set up for a specific content-type, restify will
    // default to octet-stream.

    SERVER.get('/11', function handle(req, res, next) {
        res.header('content-type', 'application/hal+json');
        res.send(200, JSON.stringify({ hello: 'world' }));
        return next();
    });

    CLIENT.get(join(LOCALHOST, '/11'), function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.equal(res.headers['content-type'], 'application/octet-stream');
        t.end();
    });
});

test('should not fail to send null as body', function(t) {
    SERVER.get('/12', function handle(req, res, next) {
        res.send(200, null);
        return next();
    });

    CLIENT.get(join(LOCALHOST, '/12'), function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

test('should not fail to send null as body without status code', function(t) {
    SERVER.get('/13', function handle(req, res, next) {
        res.send(null);
        return next();
    });

    CLIENT.get(join(LOCALHOST, '/13'), function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

test('should prefer explicit status code over error status code', function(t) {
    SERVER.get('/14', function handle(req, res, next) {
        res.send(200, new errs.InternalServerError('boom'));
        return next();
    });

    CLIENT.get(join(LOCALHOST, '/14'), function(err, _, res, body) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        // ensure error body was still sent
        t.equal(body.code, 'InternalServer');
        t.equal(body.message, 'boom');
        t.end();
    });
});

test('GH-951: should send without formatting', function(t) {
    SERVER.get('/15', function handle(req, res, next) {
        res.header('content-type', 'application/json');
        res.sendRaw(
            200,
            JSON.stringify({
                hello: 'world'
            })
        );
        return next();
    });

    STRING_CLIENT.get(join(LOCALHOST, '/15'), function(err, _, res, body) {
        t.ifError(err);
        t.equal(
            body,
            JSON.stringify({
                hello: 'world'
            })
        );
        t.end();
    });
});

test('GH-951: sendRaw accepts only strings or buffers', function(t) {
    SERVER.on('uncaughtException', function(req, res, route, err) {
        t.ok(err);
        // Node v8 uses static error codes
        // and `name` includes the error name and error code as well which
        // caused this test to break. Just changing the logic to check for
        // string instead
        t.equal(err.name.indexOf('AssertionError') >= 0, true);
        t.equal(err.message, 'res.sendRaw() accepts only strings or buffers');
        t.end();
    });

    SERVER.get('/16', function handle(req, res, next) {
        res.header('content-type', 'application/json');
        res.sendRaw(200, {
            hello: 'world'
        });
        return next();
    });

    // throw away response, we don't need it.
    STRING_CLIENT.get(join(LOCALHOST, '/16'));
});

test('GH-1429: setting code with res.status not respected', function(t) {
    SERVER.get('/404', function(req, res, next) {
        res.status(404);
        res.send(null);
    });

    CLIENT.get(join(LOCALHOST, '/404'), function(err, _, res) {
        t.equal(res.statusCode, 404);
        t.end();
    });
});

test('should support multiple set-cookie headers', function(t) {
    SERVER.get('/set-cookie', function(req, res, next) {
        res.header('Set-Cookie', 'a=1');
        res.header('Set-Cookie', 'b=2');
        res.send(null);
    });

    CLIENT.get(join(LOCALHOST, '/set-cookie'), function(err, _, res) {
        t.equal(res.headers['set-cookie'].length, 2);
        t.end();
    });
});

test('GH-1607: should send bools with explicit status code', function(t) {
    SERVER.get('/bool/:value', function(req, res, next) {
        res.send(200, req.params.value === 'true' ? true : false);
        return next();
    });

    STRING_CLIENT.get(join(LOCALHOST, '/bool/false'), function(
        err,
        req,
        res,
        data
    ) {
        t.equal(data, 'false');

        STRING_CLIENT.get(join(LOCALHOST, '/bool/true'), function(
            err2,
            req2,
            res2,
            data2
        ) {
            t.equal(data2, 'true');
            t.end();
        });
    });
});

test('GH-1607: should send numbers with explicit status code', function(t) {
    SERVER.get('/zero', function(req, res, next) {
        res.send(200, 0);
        return next();
    });

    SERVER.get('/one', function(req, res, next) {
        res.send(200, 1);
        return next();
    });

    STRING_CLIENT.get(join(LOCALHOST, '/zero'), function(err, req, res, data) {
        t.equal(data, '0');
        STRING_CLIENT.get(join(LOCALHOST, '/one'), function(
            err2,
            req2,
            res2,
            data2
        ) {
            t.equal(data2, '1');
            t.end();
        });
    });
});
