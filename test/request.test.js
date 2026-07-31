'use strict';
/* eslint-disable func-names */

var restifyClients = require('restify-clients');
var validator = require('validator');

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

before(module, function(cb) {
    try {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server')
        });
        SERVER.listen(PORT, '127.0.0.1', function() {
            PORT = SERVER.address().port;
            CLIENT = restifyClients.createJsonClient({
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

test(module, 'query should return empty string', function(t) {
    SERVER.get('/emptyQs', function(req, res, next) {
        t.equal(req.query(), '');
        t.equal(req.getQuery(), '');
        res.send();
        next();
    });

    CLIENT.get('/emptyQs', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

test(module, 'query should return raw query string string', function(t) {
    SERVER.get('/qs', function(req, res, next) {
        t.equal(req.query(), 'a=1&b=2');
        t.equal(req.getQuery(), 'a=1&b=2');
        res.send();
        next();
    });

    CLIENT.get('/qs?a=1&b=2', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

test(module, 'should generate request id on first req.id() call', function(t) {
    SERVER.get('/ping', function(req, res, next) {
        t.equal(typeof req.id(), 'string');
        t.equal(validator.isUUID(req.id(), 4), true);
        res.send();
        return next();
    });

    CLIENT.get('/ping', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

test(module, 'should set request id', function(t) {
    SERVER.pre(function setId(req, res, next) {
        var newId = req.id('lagavulin');
        t.equal(newId, 'lagavulin');
        return next();
    });

    SERVER.get('/ping', function(req, res, next) {
        t.equal(typeof req.id(), 'string');
        t.equal(req.id(), 'lagavulin');
        res.send();
        return next();
    });

    CLIENT.get('/ping', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

test(
    module,
    'should throw when setting request id after autogeneration',
    function(t) {
        SERVER.get('/ping', function(req, res, next) {
            t.equal(typeof req.id(), 'string');
            t.equal(validator.isUUID(req.id(), 4), true);
            t.throws(
                function() {
                    req.id('blowup');
                },
                Error,
                'request id is immutable, cannot be set again!'
            );
            res.send();
            return next();
        });

        CLIENT.get('/ping', function(err, _, res) {
            t.ifError(err);
            t.equal(res.statusCode, 200);
            t.end();
        });
    }
);

test(module, 'should throw when setting request id twice', function(t) {
    SERVER.get('/ping', function(req, res, next) {
        req.id('lagavulin');
        t.throws(
            function() {
                req.id('blowup');
            },
            Error,
            'request id is immutable, cannot be set again!'
        );
        res.send();
        return next();
    });

    CLIENT.get('/ping', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

test(module, 'should provide route object', function(t) {
    SERVER.get('/ping/:name', function(req, res, next) {
        /*
         req.getRoute() should return something like this :
             {
                path: '/ping/:name',
                method: 'GET',
                versions: [],
                name: 'getpingname'
             }
         */
        var routeInfo = req.getRoute();
        t.equal(routeInfo.path, '/ping/:name');
        t.equal(routeInfo.method, 'GET');
        res.send({ name: req.params.name });
        return next();
    });

    CLIENT.get('/ping/lagavulin', function(err, _, res, parsedBody) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.deepEqual(parsedBody, { name: 'lagavulin' });
        t.end();
    });
});

test(module, 'should provide time when request started', function(t) {
    SERVER.get('/ping/:name', function(req, res, next) {
        t.equal(typeof req.time(), 'number');
        t.ok(req.time() > Date.now() - 1000);
        t.ok(req.time() <= Date.now());
        res.send('ok');
        return next();
    });

    CLIENT.get('/ping/lagavulin', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

test(module, 'should provide date when request started', function(t) {
    SERVER.get('/ping/:name', function(req, res, next) {
        t.ok(req.date() instanceof Date);
        t.ok(req.date().getTime() > Date.now() - 1000);
        t.ok(req.date().getTime() <= Date.now());
        res.send('ok');
        return next();
    });

    CLIENT.get('/ping/lagavulin', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

// restifyDone is emitted at the same time when server's after event is emitted,
// you can find more comprehensive testing for `after` lives in server tests.
test(
    module,
    'should emit restifyDone event when request is fully served',
    function(t) {
        var restifyDoneCalled = false;

        SERVER.get('/', function(req, res, next) {
            req.on('restifyDone', function(route, err) {
                t.ifError(err);
                t.ok(route);
                setImmediate(function() {
                    restifyDoneCalled = true;
                });
            });

            res.send('hello');
            return next();
        });

        CLIENT.get('/', function(err, _, res) {
            t.ifError(err);
            t.equal(res.statusCode, 200);
            t.ok(restifyDoneCalled);
            t.end();
        });
    }
);

// eslint-disable-next-line max-len
test(
    module,
    'should emit restifyDone event when request is fully served with error',
    function(t) {
        var clientDone = false;

        SERVER.get('/', function(req, res, next) {
            var myErr = new Error('My Error');

            req.on('restifyDone', function(route, err) {
                t.ok(route);
                t.deepEqual(err, myErr);
                setImmediate(function() {
                    t.ok(clientDone);
                    t.end();
                });
            });

            return next(myErr);
        });

        CLIENT.get('/', function(err, _, res) {
            t.ok(err);
            t.equal(res.statusCode, 500);
            clientDone = true;
        });
    }
);

test(
    module,
    'getUrl should return correct shape for path with no query',
    function(t) {
        SERVER.get('/geturl-plain', function(req, res, next) {
            var u = req.getUrl();
            t.ok(u instanceof URL);
            t.equal(u.href, 'http://127.0.0.1:' + PORT + '/geturl-plain');
            t.equal(u.pathname, '/geturl-plain');
            t.equal(u.search, '');
            t.equal(u.hash, '');
            t.equal(u.host, '127.0.0.1:' + PORT);
            t.equal(u.hostname, '127.0.0.1');
            t.equal(u.port, String(PORT));
            t.equal(u.protocol, 'http:');
            res.send();
            return next();
        });

        CLIENT.get('/geturl-plain', function(err, _, res) {
            t.ifError(err);
            t.equal(res.statusCode, 200);
            t.end();
        });
    }
);

test(module, 'getUrl should return correct query string', function(t) {
    SERVER.get('/geturl-qs', function(req, res, next) {
        var u = req.getUrl();
        t.ok(u instanceof URL);
        t.equal(u.href, 'http://127.0.0.1:' + PORT + '/geturl-qs?a=1&b=2');
        t.equal(u.pathname, '/geturl-qs');
        t.equal(u.search, '?a=1&b=2');
        t.equal(u.searchParams.get('a'), '1');
        t.equal(u.searchParams.get('b'), '2');
        t.equal(u.hash, '');
        t.equal(u.host, '127.0.0.1:' + PORT);
        t.equal(u.hostname, '127.0.0.1');
        t.equal(u.port, String(PORT));
        t.equal(u.protocol, 'http:');
        res.send();
        return next();
    });

    CLIENT.get('/geturl-qs?a=1&b=2', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

test(module, 'getUrl should handle OPTIONS * request-target', function(t) {
    SERVER.opts('*', function(req, res, next) {
        var u = req.getUrl();
        t.ok(u instanceof URL);
        // a URL instance can't represent the literal '*' request-target -
        // it resolves against the base path, so it comes out as '/*'.
        t.equal(u.pathname, '/*');
        t.equal(u.search, '');
        res.send(200);
        return next();
    });

    CLIENT.opts('*', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

test(module, 'getUrl result is cached across calls', function(t) {
    SERVER.get('/geturl-cache', function(req, res, next) {
        var u1 = req.getUrl();
        var u2 = req.getUrl();
        t.strictEqual(u1, u2);
        res.send();
        return next();
    });

    CLIENT.get('/geturl-cache', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});
