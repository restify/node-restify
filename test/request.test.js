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
            t.equal(u.href, 'http://localhost/geturl-plain');
            t.equal(u.pathname, '/geturl-plain');
            t.equal(u.search, '');
            t.equal(u.hash, '');
            t.equal(u.hostname, 'localhost');
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
        t.equal(u.href, 'http://localhost/geturl-qs?a=1&b=2');
        t.equal(u.pathname, '/geturl-qs');
        t.equal(u.search, '?a=1&b=2');
        t.equal(u.searchParams.get('a'), '1');
        t.equal(u.searchParams.get('b'), '2');
        t.equal(u.hash, '');
        t.equal(u.hostname, 'localhost');
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
        t.equal(req.url, '*');
        t.ok(u instanceof URL);
        // a URL instance can't represent the literal '*' request-target -
        // it resolves against the base path, so it comes out as '/*'.
        t.equal(u.href, 'http://localhost/*');
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

test(module, 'getUrl should route a literal * path segment', function(t) {
    SERVER.get('/api/test/:asterisk/some_test', function(req, res, next) {
        var u = req.getUrl();
        t.ok(u instanceof URL);
        t.equal(u.href, 'http://localhost/api/test/*/some_test');
        t.equal(u.pathname, '/api/test/*/some_test');
        t.equal(req.params.asterisk, '*');
        res.send(200);
        return next();
    });

    CLIENT.get('/api/test/*/some_test', function(err, _, res) {
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

test(module, 'getUrl should handle a path starting with // correctly', function(
    t
) {
    SERVER.get('//foo/bar', function(req, res, next) {
        var u = req.getUrl();
        t.ok(u instanceof URL);
        t.equal(u.href, 'http://localhost//foo/bar');
        t.equal(u.hostname, 'localhost');
        t.equal(u.pathname, '//foo/bar');
        t.equal(u.search, '');
        res.send();
        return next();
    });

    CLIENT.get('//foo/bar', function(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

test(module, 'getUrl should not match // path to / route', function(t) {
    SERVER.get('/foo/bar', function(req, res, next) {
        t.ok(false, 'route handler should not be called');
        res.send();
        return next();
    });

    CLIENT.get('//foo/bar', function(err, _, res) {
        t.ok(err);
        t.equal(res.statusCode, 404);
        t.end();
    });
});

test(
    module,
    'getUrl should parse special characters after // as a path',
    function(t) {
        SERVER.get('//images', function(req, res, next) {
            var u = req.getUrl();
            t.ok(u instanceof URL);
            t.equal(u.href, 'http://localhost//images;:@example.com');
            t.equal(u.hostname, 'localhost');
            t.equal(u.username, '');
            t.equal(u.pathname, '//images;:@example.com');
            res.send();
            return next();
        });

        CLIENT.get('//images;:@example.com', function(err, _, res) {
            t.ok(err);
            t.equal(res.statusCode, 404);
            t.end();
        });
    }
);

test(module, 'getUrl should preserve special query characters', function(t) {
    SERVER.get('/geturl-special-query', function(req, res, next) {
        var u = req.getUrl();
        t.ok(u instanceof URL);
        t.equal(
            u.href,
            'http://localhost/geturl-special-query?a=1&b=test\\@gmail.com'
        );
        t.equal(u.pathname, '/geturl-special-query');
        t.equal(u.hostname, 'localhost');
        t.equal(u.search, '?a=1&b=test\\@gmail.com');
        t.equal(u.searchParams.get('a'), '1');
        t.equal(u.searchParams.get('b'), 'test\\@gmail.com');
        res.send();
        return next();
    });

    CLIENT.get('/geturl-special-query?a=1&b=test\\@gmail.com', function(
        err,
        _,
        res
    ) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

test(module, 'getUrl should preserve encoded path characters', function(t) {
    SERVER.get('/geturl-encoded/:value', function(req, res, next) {
        var u = req.getUrl();
        t.ok(u instanceof URL);
        t.equal(
            u.href,
            'http://localhost/geturl-encoded/a%2Fb%20c?email=test%40gmail.com'
        );
        t.equal(u.pathname, '/geturl-encoded/a%2Fb%20c');
        t.equal(u.search, '?email=test%40gmail.com');
        t.equal(u.searchParams.get('email'), 'test@gmail.com');
        res.send();
        return next();
    });

    CLIENT.get('/geturl-encoded/a%2Fb%20c?email=test%40gmail.com', function(
        err,
        _,
        res
    ) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

[
    { host: 'example.com', hostname: 'example.com', port: '' },
    { host: 'example.com:8080', hostname: 'example.com', port: '8080' },
    { host: '127.0.0.1', hostname: '127.0.0.1', port: '' },
    { host: '[::1]', hostname: '[::1]', port: '' },
    {
        host: '[2001:db8::1]:8080',
        hostname: '[2001:db8::1]',
        port: '8080'
    }
].forEach(function(testCase, index) {
    test(module, 'getUrl should support HOST ' + testCase.host, function(t) {
        var originalHost = process.env.HOST;
        var path = '/geturl-valid-host-' + index;

        SERVER.get(path, function(req, res, next) {
            var u = req.getUrl();
            t.ok(u instanceof URL);
            t.equal(u.href, 'http://' + testCase.host + path + '?a=1');
            t.equal(u.hostname, testCase.hostname);
            t.equal(u.port, testCase.port);
            t.equal(u.pathname, path);
            t.equal(u.search, '?a=1');
            res.send();
            return next();
        });

        process.env.HOST = testCase.host;
        CLIENT.get(path + '?a=1', function(err, _, res) {
            if (originalHost === undefined) {
                delete process.env.HOST;
            } else {
                process.env.HOST = originalHost;
            }

            t.ifError(err);
            t.equal(res.statusCode, 200);
            t.end();
        });
    });
});

[
    '::1',
    '[::1',
    '[gggg::1]',
    'localhost:not-a-port',
    'localhost:65536',
    'bad host',
    '999.999.999.999',
    'http://example.com',
    '%'
].forEach(function(host, index) {
    test(module, 'getUrl should reject HOST ' + host, function(t) {
        var originalHost = process.env.HOST;
        var path = '/geturl-invalid-host-' + index;

        SERVER.get(path, function(req, res, next) {
            t.ok(false, 'route handler should not be called');
            res.send();
            return next();
        });

        process.env.HOST = host;
        CLIENT.get(path, function(err, _, res) {
            if (originalHost === undefined) {
                delete process.env.HOST;
            } else {
                process.env.HOST = originalHost;
            }

            t.ok(err);
            t.equal(res.statusCode, 400);
            t.end();
        });
    });
});

test(module, 'getUrl should use localhost when HOST is missing', function(t) {
    var originalHost = process.env.HOST;
    delete process.env.HOST;

    SERVER.get('/geturl-missing-host', function(req, res, next) {
        var u = req.getUrl();
        t.equal(u.href, 'http://localhost/geturl-missing-host');
        t.equal(u.hostname, 'localhost');
        res.send();
        return next();
    });

    CLIENT.get('/geturl-missing-host', function(err, _, res) {
        if (originalHost !== undefined) {
            process.env.HOST = originalHost;
        }

        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

[
    'http://example.com/foo?a=1',
    'https://example.com/foo',
    'http://[::1]:8080/foo',
    'http://',
    'http://[::1',
    'https://bad host/foo',
    'http://example.com:bad/foo'
].forEach(function(requestUrl, index) {
    test(module, 'getUrl should reject absoluteURL ' + requestUrl, function(t) {
        var path = '/geturl-absolute-' + index;

        SERVER.get(path, function(req, res, next) {
            var originalUrl = req.url;
            req.url = requestUrl;

            try {
                req.getUrl();
            } catch (err) {
                req.url = originalUrl;
                return next(err);
            }

            req.url = originalUrl;
            t.ok(false, 'getUrl should throw');
            res.send(200);
            return next();
        });

        CLIENT.get(path, function(err, _, res) {
            t.ok(err);
            t.equal(res.statusCode, 400);
            t.end();
        });
    });
});
