'use strict';
/* eslint-disable func-names */

var http = require('http');
var net = require('net');

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

test(module, 'should not crash when the Host header is not a valid URL host', function(t) {
    SERVER.get('/hosthdr', function(req, res, next) {
        res.send({ pathname: req.path() });
        return next();
    });

    // The Host header is client-supplied and Node does not validate it as a
    // URL authority. getUrl() must not throw on it: it is called from
    // Router.lookup on every request, where nothing catches, so a throw
    // here takes down the process.
    var opts = {
        agent: false,
        headers: { Host: 'foo|bar' },
        hostname: '127.0.0.1',
        method: 'GET',
        path: '/hosthdr',
        port: PORT
    };

    http.request(opts, function(res) {
        t.equal(res.statusCode, 200);
        res.resume();
        res.on('end', function() {
            t.end();
        });
    }).end();
});

test(module, 'should not crash when the request target is not a valid URL', function(t) {
    // An absolute-form request target is client-supplied and Node's HTTP
    // parser does not validate it as a URL either, so getUrl() must not
    // throw on it. Needs a raw socket: http.request only emits
    // origin-form targets.
    var response = '';
    var socket = net.connect(PORT, '127.0.0.1', function() {
        socket.write(
            'GET http://a:99999/x HTTP/1.1\r\n' +
                'Host: 127.0.0.1:' +
                PORT +
                '\r\n' +
                'Connection: close\r\n\r\n'
        );
    });

    socket.on('data', function(chunk) {
        response += chunk;
    });

    socket.on('close', function() {
        t.ok(/^HTTP\/1\.1 \d{3}/.test(response), 'server sent a response');
        t.end();
    });
});