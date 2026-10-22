'use strict';
/* eslint-disable func-names */

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

before(module, function(cb) {
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

            cb();
        });
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});

after(module, function(cb) {
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

test(module, 'redirect to new string url as-is', function(t) {
    SERVER.get('/1', function(req, res, next) {
        res.redirect('www.foo.com', next);
    });

    CLIENT.get('/1', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, 'www.foo.com');
        t.end();
    });
});

test(module, 'redirect to new relative string url as-is', function(t) {
    SERVER.get('/20', function(req, res, next) {
        res.redirect('/1', next);
    });

    CLIENT.get('/20?a=1', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, '/1');
        t.end();
    });
});

test(module, 'redirect to current url (reload)', function(t) {
    SERVER.get('/2', function(req, res, next) {
        res.redirect(
            {
                reload: true
            },
            next
        );
    });

    CLIENT.get('/2', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, '/2');
        t.end();
    });
});

test(module, 'redirect to current url from http -> https', function(t) {
    SERVER.get('/3', function(req, res, next) {
        res.redirect(
            {
                secure: true
            },
            next
        );
    });

    CLIENT.get('/3', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, '/3');
        t.end();
    });
});

test(module, 'redirect to current url from https -> http', function(t) {
    SERVER.get('/3', function(req, res, next) {
        res.redirect(
            {
                reload: true,
                secure: false
            },
            next
        );
    });

    CLIENT.get('/3', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, '/3');
        t.end();
    });
});

test(module, 'redirect by changing path', function(t) {
    SERVER.get('/4', function(req, res, next) {
        res.redirect(
            {
                pathname: '1'
            },
            next
        );
    });

    CLIENT.get('/4', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, '/1');
        t.end();
    });
});

test(
    module,
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

test(module, 'redirect should add query params', function(t) {
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

    CLIENT.get('/5', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, '/5?a=1');
        t.end();
    });
});

test(module, 'redirect should extend existing query params', function(t) {
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

    CLIENT.get('/6?a=1', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);

        t.equal(res.headers.location, '/6?b=2&a=1');
        t.end();
    });
});

test(module, 'redirect should stomp over existing query params', function(t) {
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

    CLIENT.get('/7?a=1', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, '/7?b=2');
        t.end();
    });
});

test(module, 'redirect with 301 status code', function(t) {
    SERVER.get('/8', function(req, res, next) {
        res.redirect(
            {
                permanent: true
            },
            next
        );
    });

    CLIENT.get('/8', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 301);
        t.equal(res.headers.location, '/8');
        t.end();
    });
});

test(module, 'redirect with 301 status code ising string url', function(t) {
    SERVER.get('/30', function(req, res, next) {
        res.redirect(301, '/foo', next);
    });

    CLIENT.get('/30', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 301);
        t.equal(res.headers.location, '/foo');
        t.end();
    });
});

test(module, 'redirect using options.url', function(t) {
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

    CLIENT.get('/8', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, 'http://www.foo.com/8?a=1');
        t.end();
    });
});

test(module, 'redirect using opts.port', function(t) {
    SERVER.get('/9', function(req, res, next) {
        res.redirect(
            {
                port: 3000
            },
            next
        );
    });

    CLIENT.get('/9', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        var parsedUrl = new URL(res.headers.location);
        t.equal(Number(parsedUrl.port), 3000);
        t.end();
    });
});

test(module, 'redirect using external url and custom port', function(t) {
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

    CLIENT.get('/9', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        var parsedUrl = new URL(res.headers.location);
        t.equal(Number(parsedUrl.port), 3000);
        t.equal(parsedUrl.hostname, 'www.foo.com');
        t.equal(parsedUrl.pathname, '/99');
        t.end();
    });
});

test(module, 'redirect using default hostname with custom port', function(t) {
    SERVER.get('/9', function(req, res, next) {
        res.redirect(
            {
                pathname: '/99',
                port: 3000
            },
            next
        );
    });
    CLIENT.get('/9', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, 'http://localhost:3000/99');
        t.end();
    });
});

test(module, 'redirect opts.port exact location header', function(t) {
    SERVER.get('/port-pin', function(req, res, next) {
        res.redirect({ port: 3000 }, next);
    });

    CLIENT.get('/port-pin', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, 'http://localhost:3000/port-pin');
        t.end();
    });
});

test(
    module,
    'redirect external hostname and port exact location header',
    function(t) {
        SERVER.get('/extport-pin', function(req, res, next) {
            res.redirect(
                { hostname: 'www.foo.com', pathname: '/bar', port: 3000 },
                next
            );
        });

        CLIENT.get('/extport-pin', function(err, _, res) {
            t.ifError(err);
            t.equal(res.statusCode, 302);
            t.equal(res.headers.location, 'http://www.foo.com:3000/bar');
            t.end();
        });
    }
);

test(module, 'redirect extend query params exact location header', function(t) {
    SERVER.get('/extqs-pin', function(req, res, next) {
        res.redirect({ query: { b: '2' } }, next);
    });

    CLIENT.get('/extqs-pin?a=1', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);

        t.equal(res.headers.location, '/extqs-pin?b=2&a=1');
        t.end();
    });
});

// eslint-disable-next-line max-len
test(module, 'redirect should repeat query param when same key', function(t) {
    SERVER.get('/dupqs-pin', function(req, res, next) {
        res.redirect({ query: { a: '2' } }, next);
    });

    CLIENT.get('/dupqs-pin?a=1', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.deepEqual(res.headers.location, '/dupqs-pin?a=2&a=1');
        t.end();
    });
});

// eslint-disable-next-line max-len
test(
    module,
    'redirect with only pathname (no hostname) uses current host',
    function(t) {
        SERVER.get('/rel-path-pin', function(req, res, next) {
            res.redirect({ pathname: '/other' }, next);
        });

        CLIENT.get('/rel-path-pin', function(err, _, res) {
            t.ifError(err);
            t.equal(res.statusCode, 302);
            t.equal(res.headers.location, '/other');
            t.end();
        });
    }
);

// eslint-disable-next-line max-len
test(
    module,
    'redirect with pathname and query (no hostname) preserves query string',
    function(t) {
        SERVER.get('/rel-qs-pin', function(req, res, next) {
            res.redirect(
                { pathname: '/other', query: { x: '1', y: '2' } },
                next
            );
        });

        CLIENT.get('/rel-qs-pin', function(err, _, res) {
            t.ifError(err);
            t.equal(res.statusCode, 302);
            t.equal(res.headers.location, '/other?x=1&y=2');
            t.end();
        });
    }
);

// eslint-disable-next-line
test(
    module,
    'redirect should cause InternalError when invoked without next',
    function(t) {
        SERVER.get('/9', function(req, res, next) {
            res.redirect();
        });

        CLIENT.get('/9', function(err, _, res, body) {
            t.equal(res.statusCode, 500);

            // json parse the response
            t.equal(body.code, 'Internal');
            t.end();
        });
    }
);

// eslint-disable-next-line
test(
    module,
    'redirect should call next with false to stop handler stack execution',
    function(t) {
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

        CLIENT.get('/10', function(err, _, res) {
            t.ifError(err);
            t.equal(res.statusCode, 302);
            t.equal(res.headers.location, '/10');

            // handler B should not be executed
            t.equal(wasRun, false);
            t.end();
        });
    }
);

test(module, 'redirect should emit a redirect event', function(t) {
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

    CLIENT.get('/10', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);
        t.equal(res.headers.location, '/10');

        // event 'redirect' should have been emitted
        t.equal(wasEmitted, true);
        t.equal(redirectLocation, '/10');
        t.end();
    });
});

test(module, 'writeHead should emit a header event', function(t) {
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

    CLIENT.get('/10', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 302);

        // event 'header' should have been emitted
        t.equal(wasEmitted, true);
        t.equal(payloadPlaceholder, undefined);
        t.end();
    });
});

test(module, 'should fail to set header due to missing formatter', function(t) {
    // when a formatter is not set up for a specific content-type, restify will
    // default to octet-stream.

    SERVER.get('/11', function handle(req, res, next) {
        res.header('content-type', 'application/hal+json');
        res.send(200, JSON.stringify({ hello: 'world' }));
        return next();
    });

    CLIENT.get('/11', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.equal(res.headers['content-type'], 'application/octet-stream');
        t.end();
    });
});

test(module, 'should not fail to send null as body', function(t) {
    SERVER.get('/12', function handle(req, res, next) {
        res.send(200, null);
        return next();
    });

    CLIENT.get('/12', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

test(
    module,
    'should not fail to send null as body without status code',
    function(t) {
        SERVER.get('/13', function handle(req, res, next) {
            res.send(null);
            return next();
        });

        CLIENT.get('/13', function(err, _, res) {
            t.ifError(err);
            t.equal(res.statusCode, 200);
            t.end();
        });
    }
);

test(
    module,
    'should prefer explicit status code over error status code',
    function(t) {
        SERVER.get('/14', function handle(req, res, next) {
            res.send(200, new errs.InternalServerError('boom'));
            return next();
        });

        CLIENT.get('/14', function(err, _, res, body) {
            t.ifError(err);
            t.equal(res.statusCode, 200);
            // ensure error body was still sent
            t.equal(body.code, 'InternalServer');
            t.equal(body.message, 'boom');
            t.end();
        });
    }
);

test(module, 'GH-951: should send without formatting', function(t) {
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

    STRING_CLIENT.get('/15', function(err, _, res, body) {
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

test(module, 'GH-951: sendRaw accepts only strings or buffers', function(t) {
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
    STRING_CLIENT.get('/16');
});

test(module, 'GH-1429: setting code with res.status not respected', function(
    t
) {
    SERVER.get('/404', function(req, res, next) {
        res.status(404);
        res.send(null);
    });

    CLIENT.get('/404', function(err, _, res) {
        t.equal(res.statusCode, 404);
        t.end();
    });
});

test(module, 'should support multiple set-cookie headers', function(t) {
    SERVER.get('/set-cookie', function(req, res, next) {
        res.header('Set-Cookie', 'a=1');
        res.header('Set-Cookie', 'b=2');
        res.send(null);
    });

    CLIENT.get('/set-cookie', function(err, _, res) {
        t.equal(res.headers['set-cookie'].length, 2);
        t.end();
    });
});

test(module, 'GH-1607: should send bools with explicit status code', function(
    t
) {
    SERVER.get('/bool/:value', function(req, res, next) {
        res.send(200, req.params.value === 'true' ? true : false);
        return next();
    });

    STRING_CLIENT.get('/bool/false', function(err, req, res, data) {
        t.equal(data, 'false');

        STRING_CLIENT.get('/bool/true', function(err2, req2, res2, data2) {
            t.equal(data2, 'true');
            t.end();
        });
    });
});

test(module, 'GH-1607: should send numbers with explicit status code', function(
    t
) {
    SERVER.get('/zero', function(req, res, next) {
        res.send(200, 0);
        return next();
    });

    SERVER.get('/one', function(req, res, next) {
        res.send(200, 1);
        return next();
    });

    STRING_CLIENT.get('/zero', function(err, req, res, data) {
        t.equal(data, '0');
        STRING_CLIENT.get('/one', function(err2, req2, res2, data2) {
            t.equal(data2, '1');
            t.end();
        });
    });
});

test(module, 'GH-1791: should send 0 as 0 with application/json', function(t) {
    SERVER.get('/zero', function(req, res, next) {
        res.contentType = 'application/json';
        res.send(200, 0);
        return next();
    });

    STRING_CLIENT.get('/zero', function(err, req, res, data) {
        t.equal(data, '0');
        t.end();
    });
});

test(
    module,
    'GH-1791: should send false as false with application/json',
    function(t) {
        SERVER.get('/false', function(req, res, next) {
            res.contentType = 'application/json';
            res.send(200, false);
            return next();
        });

        STRING_CLIENT.get('/false', function(err, req, res, data) {
            t.equal(data, 'false');
            t.end();
        });
    }
);

// eslint-disable-next-line
test(
    module,
    'GH-1791: should send empty string as "" with application/json',
    function(t) {
        SERVER.get('/empty', function(req, res, next) {
            res.contentType = 'application/json';
            res.send(200, '');
            return next();
        });

        STRING_CLIENT.get('/empty', function(err, req, res, data) {
            t.equal(data, '""');
            t.end();
        });
    }
);

test(
    module,
    'GH-1791: should send null as null with application/json',
    function(t) {
        SERVER.get('/null', function(req, res, next) {
            res.contentType = 'application/json';
            res.send(200, null);
            return next();
        });

        STRING_CLIENT.get('/null', function(err, req, res, data) {
            t.equal(data, 'null');
            t.end();
        });
    }
);

// eslint-disable-next-line
test(
    module,
    'GH-1791: should send undefined as empty with application/json',
    function(t) {
        SERVER.get('/undef', function(req, res, next) {
            res.contentType = 'application/json';
            res.send(200, undefined);
            return next();
        });

        STRING_CLIENT.get('/undef', function(err, req, res, data) {
            t.equal(data, '');
            t.end();
        });
    }
);

test(module, 'GH-1791: should send NaN as null with application/json', function(
    t
) {
    SERVER.get('/nan', function(req, res, next) {
        res.contentType = 'application/json';
        res.send(200, NaN);
        return next();
    });

    STRING_CLIENT.get('/nan', function(err, req, res, data) {
        t.equal(data, 'null');
        t.end();
    });
});

test(
    module,
    'GH-1589: should preserve content-type parameters set by the user',
    function(t) {
        SERVER.get('/content-type-params', function(req, res, next) {
            res.contentType = 'text/plain; version=0.0.4; charset=utf-8';
            res.send('hello');
            return next();
        });

        STRING_CLIENT.get('/content-type-params', function(
            err,
            req,
            res,
            data
        ) {
            t.ifError(err);
            t.equal(data, 'hello');
            t.equal(
                res.headers['content-type'],
                'text/plain; version=0.0.4; charset=utf-8'
            );
            t.end();
        });
    }
);

test(
    module,
    'GH-1589: res.charSet still appends charset without duplicating params',
    function(t) {
        SERVER.get('/content-type-charset', function(req, res, next) {
            res.contentType = 'text/plain';
            res.charSet('utf-8');
            res.send('hello');
            return next();
        });

        STRING_CLIENT.get('/content-type-charset', function(
            err,
            req,
            res,
            data
        ) {
            t.ifError(err);
            t.equal(data, 'hello');
            t.equal(res.headers['content-type'], 'text/plain; charset=utf-8');
            t.end();
        });
    }
);
