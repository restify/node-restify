// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');
var fs = require('fs');
var http = require('http');

var filed = require('filed');
var uuid = require('node-uuid');

var HttpError = require('../lib/errors').HttpError;
var RestError = require('../lib/errors').RestError;
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


///--- Tests

before(function (cb) {
    try {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server'),
            version: ['2.0.0', '0.5.4', '1.4.3']
        });
        SERVER.listen(PORT, '127.0.0.1', function () {
            PORT = SERVER.address().port;
            CLIENT = restify.createJsonClient({
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


after(function (cb) {
    try {
        CLIENT.close();
        SERVER.close(function () {
            CLIENT = null;
            SERVER = null;
            cb();
        });
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});


test('listen and close (port only)', function (t) {
    var server = restify.createServer();
    server.listen(0, function () {
        server.close(function () {
            t.end();
        });
    });
});


test('listen and close (port only) w/ port number as string', function (t) {
    var server = restify.createServer();
    server.listen(String(0), function () {
        server.close(function () {
            t.end();
        });
    });
});


test('listen and close (socketPath)', function (t) {
    var server = restify.createServer();
    server.listen('/tmp/.' + uuid(), function () {
        server.close(function () {
            t.end();
        });
    });
});


test('gh-751 IPv4/IPv6 server URL', function (t) {
    t.equal(SERVER.url, 'http://127.0.0.1:' + PORT, 'ipv4 url');

    var server = restify.createServer();
    server.listen(PORT + 1, '::1', function () {
        t.equal(server.url, 'http://[::1]:' + (PORT + 1), 'ipv6 url');

        server.close(function () {
            t.end();
        });
    });
});


test('get (path only)', function (t) {
    var r = SERVER.get('/foo/:id', function echoId(req, res, next) {
        t.ok(req.params);
        t.equal(req.params.id, 'bar');
        t.equal(req.isUpload(), false);
        res.send();
        next();
    });

    var count = 0;
    SERVER.once('after', function (req, res, route) {
        t.ok(req);
        t.ok(res);
        t.equal(r, route.name);
        if (++count === 2)
            t.end();
    });

    CLIENT.get('/foo/bar', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        if (++count === 2)
            t.end();
    });
});


test('use + get (path only)', function (t) {
    SERVER.use(function (req, res, next) {
        next();
    });
    SERVER.get('/foo/:id', function tester(req, res, next) {
        t.ok(req.params);
        t.equal(req.params.id, 'bar');
        res.send();
        next();
    });

    CLIENT.get('/foo/bar', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});


test('rm', function (t) {
    var route = SERVER.get('/foo/:id', function foosy(req, res, next) {
        next();
    });

    SERVER.get('/bar/:id', function barsy(req, res, next) {
        t.ok(req.params);
        t.equal(req.params.id, 'foo');
        res.send();
        next();
    });

    t.ok(SERVER.rm(route));

    CLIENT.get('/foo/bar', function (err, _, res) {
        t.ok(err);
        t.equal(res.statusCode, 404);
        CLIENT.get('/bar/foo', function (err2, __, res2) {
            t.ifError(err2);
            t.equal(res2.statusCode, 200);
            t.end();
        });
    });
});


test('use - throws TypeError on non function as argument', function (t) {
    var err = assert.AssertionError('handler (function) is required');

    t.throws(function () {
        SERVER.use('/nonfn');
    }, err);

    t.throws(function () {
        SERVER.use({an: 'object'});
    }, err);

    t.throws(function () {
        SERVER.use(
            function good(req, res, next) {
                next();
            },
            '/bad',
            {
                really: 'bad'
            });
    }, err);

    t.end();
});


test('405', function (t) {
    SERVER.post('/foo/:id', function posty(req, res, next) {
        t.ok(req.params);
        t.equal(req.params.id, 'bar');
        res.send();
        next();
    });

    CLIENT.get('/foo/bar', function (err, _, res) {
        t.ok(err);
        t.equal(res.statusCode, 405);
        t.equal(res.headers.allow, 'POST');
        t.end();
    });
});


test('PUT ok', function (t) {
    SERVER.put('/foo/:id', function tester(req, res, next) {
        t.ok(req.params);
        t.equal(req.params.id, 'bar');
        t.equal(req.isUpload(), true);
        res.send();
        next();
    });

    CLIENT.put('/foo/bar', {}, function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});


test('PATCH ok', function (t) {
    SERVER.patch('/foo/:id', function tester(req, res, next) {
        t.ok(req.params);
        t.equal(req.params.id, 'bar');
        t.equal(req.isUpload(), true);
        res.send();
        next();
    });

    var opts = {
        hostname: 'localhost',
        port: PORT,
        path: '/foo/bar',
        method: 'PATCH',
        agent: false
    };
    http.request(opts, function (res) {
        t.equal(res.statusCode, 200);
        res.on('end', function () {
            t.end();
        });
        res.resume();
    }).end();
});


test('HEAD ok', function (t) {
    SERVER.head('/foo/:id', function tester(req, res, next) {
        t.ok(req.params);
        t.equal(req.params.id, 'bar');
        t.equal(req.isUpload(), false);
        res.send('hi there');
        next();
    });

    var opts = {
        hostname: 'localhost',
        port: PORT,
        path: '/foo/bar',
        method: 'HEAD',
        agent: false
    };
    http.request(opts, function (res) {
        t.equal(res.statusCode, 200);
        res.on('data', function (chunk) {
            t.fail('Data was sent on HEAD');
        });
        res.on('end', function () {
            t.end();
        });
    }).end();
});


test('DELETE ok', function (t) {
    SERVER.del('/foo/:id', function tester(req, res, next) {
        t.ok(req.params);
        t.equal(req.params.id, 'bar');
        t.equal(req.isUpload(), false);
        res.send(204, 'hi there');
        next();
    });

    var opts = {
        hostname: 'localhost',
        port: PORT,
        path: '/foo/bar',
        method: 'DELETE',
        agent: false
    };
    http.request(opts, function (res) {
        t.equal(res.statusCode, 204);
        res.on('data', function (chunk) {
            t.fail('Data was sent on 204');
        });
        t.end();
    }).end();
});


test('OPTIONS', function (t) {
    ['get', 'post', 'put', 'del'].forEach(function (method) {
        SERVER[method]('/foo/:id', function tester(req, res, next) {
            t.ok(req.params);
            t.equal(req.params.id, 'bar');
            res.send();
            next();
        });
    });

    var opts = {
        hostname: 'localhost',
        port: PORT,
        path: '*',
        method: 'OPTIONS',
        agent: false
    };
    http.request(opts, function (res) {
        t.equal(res.statusCode, 200);
        t.end();
    }).end();
});

test('CORS Preflight - valid origin', function (t) {
    SERVER.use(restify.CORS({
        credentials: true,
        origins: [ 'http://somesite.local' ]
    }));
    SERVER.post('/foo/:id', function tester(req, res, next) {});

    var opts = {
        hostname: 'localhost',
        port: PORT,
        path: '/foo/bar',
        method: 'OPTIONS',
        agent: false,
        headers: {
            'Access-Control-Request-Headers': 'accept, content-type',
            'Access-Control-Request-Method': 'POST',
            'Origin': 'http://somesite.local'
        }
    };
    http.request(opts, function (res) {
        t.equal(res.headers['access-control-allow-origin'],
                'http://somesite.local');
        t.equal(res.headers['access-control-allow-credentials'], 'true');
        t.equal(res.statusCode, 200);
        t.end();
    }).end();
});

test('CORS Preflight - invalid origin', function (t) {
    SERVER.use(restify.CORS({
        credentials: true,
        origins: [ 'http://somesite.local' ]
    }));
    SERVER.post('/foo/:id', function tester(req, res, next) {});

    var opts = {
        hostname: 'localhost',
        port: PORT,
        path: '/foo/bar',
        method: 'OPTIONS',
        agent: false,
        headers: {
            'Access-Control-Request-Headers': 'accept, content-type',
            'Access-Control-Request-Method': 'POST',
            'Origin': 'http://othersite.local'
        }
    };
    http.request(opts, function (res) {
        t.equal(res.headers['access-control-allow-origin'], '*');
        t.equal(res.headers['access-control-allow-credentials'], undefined);
        t.equal(res.statusCode, 200);
        t.end();
    }).end();
});

test('CORS Preflight - any origin', function (t) {
    SERVER.use(restify.CORS({
        credentials: true,
        origins: [ 'http://somesite.local', '*' ]
    }));
    SERVER.post('/foo/:id', function tester(req, res, next) {});

    var opts = {
        hostname: 'localhost',
        port: PORT,
        path: '/foo/bar',
        method: 'OPTIONS',
        agent: false,
        headers: {
            'Access-Control-Request-Headers': 'accept, content-type',
            'Access-Control-Request-Method': 'POST',
            'Origin': 'http://anysite.local'
        }
    };
    http.request(opts, function (res) {
        t.equal(res.headers['access-control-allow-origin'],
            'http://anysite.local');
        t.equal(res.headers['access-control-allow-credentials'], 'true');
        t.equal(res.statusCode, 200);
        t.end();
    }).end();
});

test('RegExp ok', function (t) {
    SERVER.get(/\/foo/, function tester(req, res, next) {
        res.send('hi there');
        next();
    });

    CLIENT.get('/foo', function (err, _, res, obj) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.equal(obj, 'hi there');
        t.end();
    });
});


test('get (path and version ok)', function (t) {
    SERVER.get({
        url: '/foo/:id',
        version: '1.2.3'
    }, function tester(req, res, next) {
        t.ok(req.params);
        t.equal(req.params.id, 'bar');
        res.send();
        next();
    });

    var opts = {
        path: '/foo/bar',
        headers: {
            'accept-version': '~1.2'
        }
    };
    CLIENT.get(opts, function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});


test('get (path and version not ok)', function (t) {
    function respond(req, res, next) {
        res.send();
        next();
    }

    SERVER.get({ url: '/foo/:id', version: '1.2.3' }, respond);
    SERVER.get({ url: '/foo/:id', version: '3.2.1' }, respond);

    var opts = {
        path: '/foo/bar',
        headers: {
            'accept-version': '~2.1'
        }
    };
    CLIENT.get(opts, function (err, _, res) {
        t.ok(err);
        t.equal(err.message, '~2.1 is not supported by GET /foo/bar');
        t.equal(res.statusCode, 400);
        t.end();
    });
});


test('GH-56 streaming with filed (download)', function (t) {
    SERVER.get('/', function tester(req, res, next) {
        filed(__filename).pipe(res);
    });

    var opts = {
        hostname: 'localhost',
        port: PORT,
        path: '/',
        method: 'GET',
        agent: false
    };
    http.request(opts, function (res) {
        t.equal(res.statusCode, 200);
        var body = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            body += chunk;
        });
        res.on('end', function () {
            t.ok(body.length > 0);
            t.end();
        });
    }).end();
});


test('GH-59 Query params with / result in a 404', function (t) {
    SERVER.get('/', function tester(req, res, next) {
        res.send('hello world');
        next();
    });

    CLIENT.get('/?foo=bar/foo', function (err, _, res, obj) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.equal(obj, 'hello world');
        t.end();
    });
});


test('GH-63 res.send 204 is sending a body', function (t) {
    SERVER.del('/hello/:name', function tester(req, res, next) {
        res.send(204);
        next();
    });

    var opts = {
        hostname: 'localhost',
        port: PORT,
        path: '/hello/mark',
        method: 'DELETE',
        agent: false,
        headers: {
            accept: 'text/plain'
        }
    };

    http.request(opts, function (res) {
        t.equal(res.statusCode, 204);
        var body = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            body += chunk;
        });
        res.on('end', function () {
            t.notOk(body);
            t.end();
        });
    }).end();
});


test('GH-64 prerouting chain', function (t) {
    SERVER.pre(function (req, res, next) {
        req.log.debug('testing log is set');
        req.headers.accept = 'application/json';
        next();
    });

    SERVER.get('/hello/:name', function tester(req, res, next) {
        res.send(req.params.name);
        next();
    });

    var opts = {
        hostname: 'localhost',
        port: PORT,
        path: '/hello/mark',
        method: 'GET',
        agent: false,
        headers: {
            accept: 'text/plain'
        }
    };
    http.request(opts, function (res) {
        t.equal(res.statusCode, 200);
        var body = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            body += chunk;
        });
        res.on('end', function () {
            t.equal(body, '\"mark\"');
            t.end();
        });
    }).end();
});


test('GH-64 prerouting chain with error', function (t) {
    SERVER.pre(function (req, res, next) {
        next(new RestError({
            statusCode: 400,
            restCode: 'BadRequest'
        }, 'screw you client'));
    });

    SERVER.get('/hello/:name', function tester(req, res, next) {
        res.send(req.params.name);
        next();
    });

    CLIENT.get('/hello/mark', function (err, _, res) {
        t.ok(err);
        t.equal(res.statusCode, 400);
        t.end();
    });
});


test('GH-67 extend access-control headers', function (t) {
    SERVER.get('/hello/:name', function tester(req, res, next) {
        res.header('Access-Control-Allow-Headers',
            (res.header('Access-Control-Allow-Headers') +
                ', If-Match, If-None-Match'));

        res.send(req.params.name);
        next();
    });

    CLIENT.get('/hello/mark', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.ok(res.headers['access-control-allow-headers']
            .indexOf('If-Match'));
        t.end();
    });
});


test('GH-77 uncaughtException (default behavior)', function (t) {
    SERVER.get('/', function (req, res, next) {
        throw new Error('Catch me!');
    });

    CLIENT.get('/', function (err, _, res) {
        t.ok(err);
        t.equal(res.statusCode, 500);
        t.end();
    });
});


test('GH-77 uncaughtException (with custom handler)', function (t) {
    SERVER.on('uncaughtException', function (req, res, route, err) {
        res.send(204);
    });
    SERVER.get('/', function (req, res, next) {
        throw new Error('Catch me!');
    });

    CLIENT.get('/', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 204);
        t.end();
    });
});


test('GH-97 malformed URI breaks server', function (t) {
    SERVER.get('/echo/:name', function (req, res, next) {
        res.send(200);
        next();
    });

    CLIENT.get('/echo/mark%', function (err, _, res) {
        t.ok(err);
        t.equal(res.statusCode, 400);
        t.end();
    });
});


test('GH-109 RegExp flags not honored', function (t) {
    SERVER.get(/\/echo\/(\w+)/i, function (req, res, next) {
        res.send(200, req.params[0]);
        next();
    });

    CLIENT.get('/ECHO/mark', function (err, _, res, obj) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.equal(obj, 'mark');
        t.end();
    });
});


test('upload routing based on content-type ok', function (t) {
    var opts = {
        path: '/',
        contentType: '*/json'
    };
    SERVER.put(opts, function (req, res, next) {
        res.send(204);
        next();
    });

    CLIENT.put('/', {foo: 'foo'}, function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 204);
        t.end();
    });
});


test('upload routing based on content-type fail', function (t) {
    var opts = {
        path: '/',
        contentType: 'text/*'
    };
    SERVER.put(opts, function (req, res, next) {
        res.send(204);
        next();
    });

    CLIENT.put('/', {foo: 'foo'}, function (err, _, res) {
        t.ok(err);
        t.equal(res.statusCode, 415);
        t.end();
    });
});


test('full response', function (t) {
    SERVER.use(restify.fullResponse());
    SERVER.del('/bar/:id', function tester(req, res, next) {
        res.send();
        next();
    });
    SERVER.get('/bar/:id', function tester2(req, res, next) {
        t.ok(req.params);
        t.equal(req.params.id, 'bar');
        res.send();
        next();
    });

    CLIENT.get('/bar/bar', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        var headers = res.headers;
        t.ok(headers, 'headers ok');
        t.ok(headers['access-control-allow-origin']);
        t.ok(headers['access-control-allow-headers']);
        t.ok(headers['access-control-expose-headers']);
        t.ok(headers['access-control-allow-methods']);
        t.ok(headers.date);
        t.ok(headers['request-id']);
        t.ok(headers['response-time'] >= 0);
        t.equal(headers.server, 'restify');
        t.equal(headers.connection, 'Keep-Alive');
        t.equal(headers['api-version'], '2.0.0');
        t.end();
    });
});


test('GH-149 limit request body size', function (t) {
    SERVER.use(restify.bodyParser({maxBodySize: 1024}));

    SERVER.post('/', function (req, res, next) {
        res.send(200, {length: req.body.length});
        next();
    });

    var opts = {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/',
        method: 'POST',
        agent: false,
        headers: {
            'accept': 'application/json',
            'content-type': 'application/x-www-form-urlencoded',
            'transfer-encoding': 'chunked'
        }
    };
    var client = http.request(opts, function (res) {
        t.equal(res.statusCode, 413);
        res.once('end', t.end.bind(t));
        res.resume();
    });
    client.write(new Array(1028).join('x'));
    client.end();
});


test('GH-149 limit request body size (json)', function (t) {
    SERVER.use(restify.bodyParser({maxBodySize: 1024}));

    SERVER.post('/', function (req, res, next) {
        res.send(200, {length: req.body.length});
        next();
    });

    var opts = {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/',
        method: 'POST',
        agent: false,
        headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'transfer-encoding': 'chunked'
        }
    };
    var client = http.request(opts, function (res) {
        t.equal(res.statusCode, 413);
        res.once('end', t.end.bind(t));
        res.resume();
    });
    client.write('{"a":[' + new Array(512).join('1,') + '0]}');
    client.end();
});


test('path+flags ok', function (t) {
    SERVER.get({path: '/foo', flags: 'i'}, function (req, res, next) {
        res.send('hi');
        next();
    });

    CLIENT.get('/FoO', function (err, _, res, obj) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.equal(obj, 'hi');
        t.end();
    });
});


test('test matches params with custom regex', function (t) {
    var Router = require('../lib/router');
    var router = new Router({
        log: helper.getLog()
    });
    t.ok(router);
    router.mount({
        method: 'GET',
        name: 'test',
        url: '/foo/:bar',
        urlParamPattern: '[a-zA-Z0-9-_~%!;@=+\\$\\*\\.]+'
    });

    var count = 0;
    var done = 0;

    function find(p, exp) {
        count++;
        var obj = {
            headers: {},
            method: 'GET',
            contentType: function () {
            },
            path: function () {
                return (p);
            },
            version: function () {
                return ('*');
            },
            url: p
        };

        process.nextTick(function () {
            router.find(obj, {}, function (err, r, ctx) {
                if (exp) {
                    t.ifError(err);
                    t.ok(r);
                    t.ok(ctx);
                    t.deepEqual(ctx, {bar: exp});
                } else {
                    t.ok(err);
                }
                if (++done === count)
                    t.end();
            });
        });

    }

    find('/foo/a%40b.com', 'a@b.com');
    find('/foo/a@b.com', 'a@b.com');
    find('/foo/a*b.com', 'a*b.com');
    find('/foo/a%40b.com/bar', false);
});


test('GH-180 can parse DELETE body', function (t) {
    SERVER.use(restify.bodyParser({mapParams: false}));

    SERVER.del('/', function (req, res, next) {
        res.send(200, req.body);
        next();
    });

    var opts = {
        hostname: 'localhost',
        port: PORT,
        path: '/',
        method: 'DELETE',
        agent: false,
        headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'transfer-encoding': 'chunked'
        }
    };
    http.request(opts, function (res) {
        t.equal(res.statusCode, 200);
        res.setEncoding('utf8');
        res.body = '';
        res.on('data', function (chunk) {
            res.body += chunk;
        });
        res.on('end', function () {
            t.equal(res.body, '{"param1":1234}');
            t.end();
        });
    }).end('{"param1": 1234}');
});


test('returning error from a handler (with domains)', function (t) {
    SERVER.get('/', function (req, res, next) {
        next(new Error('bah!'));
    });

    CLIENT.get('/', function (err, _, res) {
        t.ok(err);
        t.equal(res.statusCode, 500);
        t.end();
    });
});


test('emitting error from a handler (with domains)', function (t) {
    SERVER.get('/', function (req, res, next) {
        req.emit('error', new Error('bah!'));
    });

    CLIENT.get('/', function (err, _, res) {
        t.ok(err);
        t.equal(res.statusCode, 500);
        t.end();
    });
});


test('throwing error from a handler (with domains)', function (t) {
    SERVER.get('/', function (req, res, next) {
        process.nextTick(function () {
            throw new Error('bah!');
        });
    });

    CLIENT.get('/', function (err, _, res) {
        t.ok(err);
        t.equal(res.statusCode, 500);
        t.end();
    });
});


test('gh-278 missing router error events (404)', function (t) {
    SERVER.once('NotFound', function (req, res) {
        res.send(404, 'foo');
    });

    CLIENT.get('/' + uuid.v4(), function (err, _, res) {
        t.ok(err);
        t.equal(err.message, '"foo"');
        t.equal(res.statusCode, 404);
        t.end();
    });
});


test('gh-278 missing router error events (405)', function (t) {
    var p = '/' + uuid.v4();
    SERVER.post(p, function (req, res, next) {
        res.send(201);
        next();
    });
    SERVER.once('MethodNotAllowed', function (req, res) {
        res.send(405, 'foo');
    });

    CLIENT.get(p, function (err, _, res) {
        t.ok(err);
        t.equal(err.message, '"foo"');
        t.equal(res.statusCode, 405);
        t.end();
    });
});


test('gh-278 missing router error events invalid version', function (t) {
    var p = '/' + uuid.v4();
    SERVER.get({
        path: p,
        version: '1.2.3'
    }, function (req, res, next) {
        res.send(200);
        next();
    });
    SERVER.once('VersionNotAllowed', function (req, res) {
        res.send(449, 'foo');
    });

    var opts = {
        path: p,
        headers: {
            'accept-version': '3.2.1'
        }
    };
    CLIENT.get(opts, function (err, _, res) {
        t.ok(err);
        t.equal(err.message, '"foo"');
        t.equal(res.statusCode, 449);
        t.end();
    });
});


test('gh-278 missing router error events (415)', function (t) {
    var p = '/' + uuid.v4();
    SERVER.post({
        path: p,
        contentType: 'text/xml'
    }, function (req, res, next) {
        res.send(200);
        next();
    });

    SERVER.once('UnsupportedMediaType', function (req, res) {
        res.send(415, 'foo');
    });

    CLIENT.post(p, {}, function (err, _, res) {
        t.ok(err);
        t.equal(err.message, '"foo"');
        t.equal(res.statusCode, 415);
        t.end();
    });
});


test('next.ifError', function (t) {
    SERVER.use(function (req, res, next) {
        next.ifError(null);
        next();
    });

    SERVER.get('/foo/:id', function tester(req, res, next) {
        process.nextTick(function () {
            var e = new RestError({
                statusCode: 400,
                restCode: 'Foo'
            }, 'screw you client');
            next.ifError(e);
            t.notOk(true);
            res.send(200);
            next();
        });
    });

    CLIENT.get('/foo/bar', function (err) {
        t.ok(err);
        t.equal(err.statusCode, 400);
        t.equal(err.message, 'screw you client');
        t.end();
    });
});


test('gh-283 maximum available versioned route matching', function (t) {
    var p = '/' + uuid.v4();
    var versions = ['1.0.0', '1.1.0'];
    var i;

    function mnt(v) {
        SERVER.get({
            path: p,
            version: v
        }, function (req, res, next) {
            res.json(200, {version: v});
            next();
        });
    }

    for (i = 0; i < versions.length; i++)
        mnt(versions[i]);

    var opts = {
        path: p,
        headers: {
            'accept-version': '~1'
        }
    };

    CLIENT.get(opts, function (err, _, res, obj) {
        t.equal(obj.version, '1.1.0');
        t.end();
    });
});

/* JSSTYLED */
test('versioned route matching should prefer first match if equal versions', function (t) {
    var p = '/' + uuid.v4();

    SERVER.get({
        path: p,
        version: ['1.1.0', '1.2.0']
    }, function (req, res, next) {
        res.json(200, {route: p});
        next();
    });

    SERVER.get({
        path: '/:id',
        version: ['1.1.0', '1.2.0']
    }, function (req, res, next) {
        res.json(200, {route: 'id'});
        next();
    });

    var opts = {
        path: p,
        headers: {
            'accept-version': '~1'
        }
    };

    CLIENT.get(opts, function (err, _, res, obj) {
        t.equal(obj.route, p);
        t.end();
    });
});


test('gh-329 wrong values in res.methods', function (t) {
    function route(req, res, next) {
        res.send(200);
        next();
    }

    SERVER.get('/stuff', route);
    SERVER.post('/stuff', route);
    SERVER.get('/stuff/:id', route);
    SERVER.put('/stuff/:id', route);
    SERVER.del('/stuff/:id', route);

    SERVER.once('MethodNotAllowed', function (req, res, cb) {
        t.ok(res.methods);
        t.deepEqual(res.methods, ['GET', 'PUT', 'DELETE']);
        res.send(405);
    });

    CLIENT.post('/stuff/foo', {}, function (err, _, res) {
        t.ok(err);
        t.end();
    });
});


test('GH-323: <url>/<path>/?<queryString> broken', function (t) {
    SERVER.pre(restify.pre.sanitizePath());
    SERVER.use(restify.queryParser());
    SERVER.get('/hello/:name', function (req, res, next) {
        res.send(req.params);
    });

    SERVER.listen(8080, function () {
        CLIENT.get('/hello/foo/?bar=baz', function (err, _, __, obj) {
            t.ifError(err);
            t.deepEqual(obj, {name: 'foo', bar: 'baz'});
            t.end();
        });
    });
});


test('<url>/?<queryString> broken', function (t) {
    SERVER.pre(restify.pre.sanitizePath());
    SERVER.use(restify.queryParser());
    /* JSSTYLED */
    SERVER.get(/\/.*/, function (req, res, next) {
        res.send(req.params);
    });

    SERVER.listen(8080, function () {
        CLIENT.get('/?bar=baz', function (err, _, __, obj) {
            t.ifError(err);
            t.deepEqual(obj, {bar: 'baz'});
            t.end();
        });
    });
});


test('content-type routing vendor', function (t) {
    SERVER.post({
        name: 'foo',
        path: '/',
        contentType: 'application/vnd.joyent.com.foo+json'
    }, function (req, res, next) {
        res.send(201);
    });

    SERVER.post({
        name: 'bar',
        path: '/',
        contentType: 'application/vnd.joyent.com.bar+json'
    }, function (req, res, next) {
        res.send(202);
    });

    SERVER.listen(8080, function () {
        var _done = 0;

        function done() {
            if (++_done === 2)
                t.end();
        }

        var opts = {
            path: '/',
            headers: {
                'content-type': 'application/vnd.joyent.com.foo+json'
            }
        };
        CLIENT.post(opts, {}, function (err, _, res) {
            t.ifError(err);
            t.equal(res.statusCode, 201);
            done();
        });

        var opts2 = {
            path: '/',
            headers: {
                'content-type': 'application/vnd.joyent.com.bar+json'
            }
        };
        CLIENT.post(opts2, {}, function (err, _, res) {
            t.ifError(err);
            t.equal(res.statusCode, 202);
            done();
        });
    });
});


test('content-type routing params only', function (t) {
    SERVER.post({
        name: 'foo',
        path: '/',
        contentType: 'application/json; type=foo'
    }, function (req, res, next) {
        res.send(201);
    });

    SERVER.post({
        name: 'bar',
        path: '/',
        contentType: 'application/json; type=bar'
    }, function (req, res, next) {
        res.send(202);
    });

    var _done = 0;

    function done() {
        if (++_done === 2)
            t.end();
    }

    var opts = {
        path: '/',
        headers: {
            'content-type': 'application/json; type=foo'
        }
    };
    CLIENT.post(opts, {}, function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 201);
        done();
    });

    var opts2 = {
        path: '/',
        headers: {
            'content-type': 'application/json; type=bar'
        }
    };
    CLIENT.post(opts2, {}, function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 202);
        done();
    });
});

test('malformed content type', function (t) {
    SERVER.post({
        name: 'foo',
        path: '/',
        contentType: 'application/json'
    }, function (req, res, next) {
        res.send(201);
    });

    var opts = {
        path: '/',
        headers: {
            'content-type': 'boom'
        }
    };

    CLIENT.post(opts, {}, function (err, _, res) {
        t.ok(err);
        t.equal(res.statusCode, 415);
        t.end();
    });
});

test('gh-193 basic', function (t) {
    SERVER.get({
        name: 'foo',
        path: '/foo'
    }, function (req, res, next) {
        next('bar');
    });

    SERVER.get({
        name: 'bar',
        path: '/bar'
    }, function (req, res, next) {
        res.send(200);
        next();
    });

    CLIENT.get('/foo', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});


test('gh-193 route ENOEXIST', function (t) {
    SERVER.get({
        name: 'foo',
        path: '/foo'
    }, function (req, res, next) {
        next('baz');
    });

    SERVER.get({
        name: 'bar',
        path: '/bar'
    }, function (req, res, next) {
        res.send(200);
        next();
    });

    CLIENT.get('/foo', function (err, _, res) {
        t.ok(err);
        t.equal(res.statusCode, 500);
        t.end();
    });
});


test('gh-193 route only run use once', function (t) {
    var count = 0;

    SERVER.use(function (req, res, next) {
        count++;
        next();
    });

    SERVER.get({
        name: 'foo',
        path: '/foo'
    }, function (req, res, next) {
        next('bar');
    });

    SERVER.get({
        name: 'bar',
        path: '/bar'
    }, function (req, res, next) {
        res.send(200);
        next();
    });

    CLIENT.get('/foo', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.equal(count, 1);
        t.end();
    });
});


test('gh-193 route chained', function (t) {
    var count = 0;

    SERVER.use(function addCounter(req, res, next) {
        count++;
        next();
    });

    SERVER.get({
        name: 'foo',
        path: '/foo'
    }, function getFoo(req, res, next) {
        next('bar');
    });

    SERVER.get({
        name: 'bar',
        path: '/bar'
    }, function getBar(req, res, next) {
        next('baz');
    });

    SERVER.get({
        name: 'baz',
        path: '/baz'
    }, function getBaz(req, res, next) {
        res.send(200);
        next();
    });

    CLIENT.get('/foo', function (err, _, res) {
        t.ok(err);
        t.equal(res.statusCode, 500);
        t.equal(count, 1);
        t.end();
    });
});


test('gh-193 route params basic', function (t) {
    var count = 0;

    SERVER.use(function (req, res, next) {
        count++;
        next();
    });

    SERVER.get({
        name: 'foo',
        path: '/foo/:id'
    }, function (req, res, next) {
        t.equal(req.params.id, 'blah');
        next('bar');
    });

    SERVER.get({
        name: 'bar',
        path: '/bar/:baz'
    }, function (req, res, next) {
        t.notOk(req.params.baz);
        res.send(200);
        next();
    });

    CLIENT.get('/foo/blah', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.equal(count, 1);
        t.end();
    });
});


test('gh-193 same url w/params', function (t) {
    var count = 0;

    SERVER.use(function (req, res, next) {
        count++;
        next();
    });

    SERVER.get({
        name: 'foo',
        path: '/foo/:id'
    }, function (req, res, next) {
        t.equal(req.params.id, 'blah');
        next('foo2');
    });

    SERVER.get({
        name: 'foo2',
        path: '/foo/:baz'
    }, function (req, res, next) {
        t.equal(req.params.baz, 'blah');
        res.send(200);
        next();
    });

    CLIENT.get('/foo/blah', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.equal(count, 1);
        t.end();
    });
});


test('gh-193 next("route") from a use plugin', function (t) {
    var count = 0;

    SERVER.use(function plugin(req, res, next) {
        count++;
        next('bar');
    });

    SERVER.get({
        name: 'foo',
        path: '/foo'
    }, function getFoo(req, res, next) {
        res.send(500);
        next();
    });

    SERVER.get({
        name: 'bar',
        path: '/bar'
    }, function getBar(req, res, next) {
        res.send(200);
        next();
    });

    CLIENT.get('/foo', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.equal(count, 1);
        t.end();
    });
});


test('res.charSet', function (t) {
    SERVER.get('/foo', function getFoo(req, res, next) {
        res.charSet('ISO-8859-1');
        res.set('Content-Type', 'text/plain');
        res.send(200, {foo: 'bar'});
        next();
    });

    CLIENT.get('/foo', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.equal(res.headers['content-type'],
            'text/plain; charset=ISO-8859-1');
        t.end();
    });
});


test('res.charSet override', function (t) {
    SERVER.get('/foo', function getFoo(req, res, next) {
        res.charSet('ISO-8859-1');
        res.set('Content-Type', 'text/plain;charset=utf-8');
        res.send(200, {foo: 'bar'});
        next();
    });

    CLIENT.get('/foo', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.equal(res.headers['content-type'],
            'text/plain; charset=ISO-8859-1');
        t.end();
    });
});


test('GH-384 res.json(200, {}) broken', function (t) {
    SERVER.get('/foo', function (req, res, next) {
        res.json(200, {foo: 'bar'});
        next();
    });

    CLIENT.get('/foo', function (err, _, res, obj) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.ok(obj);
        t.equal((obj || {}).foo, 'bar');
        t.end();
    });
});


test('GH-401 regex routing broken', function (t) {
    function handle(req, res, next) {
        res.send(204);
        next();
    }

    var done = 0;

    function client_cb(err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 204);
        if (++done === 2)
            t.end();
    }

    SERVER.get('/image', handle);
    SERVER.get(/^(\/image\/)(.*)/, handle);

    CLIENT.get('/image', client_cb);
    CLIENT.get('/image/1.jpg', client_cb);
});

test('explicitly sending a 403 with custom error', function (t) {
    function MyCustomError() {
    }

    MyCustomError.prototype = Object.create(Error.prototype);

    SERVER.get('/', function (req, res, next) {
        res.send(403, new MyCustomError('bah!'));
    });

    CLIENT.get('/', function (err, _, res) {
        t.ok(err);
        t.equal(res.statusCode, 403);
        t.end();
    });
});

test('explicitly sending a 403 on error', function (t) {
    SERVER.get('/', function (req, res, next) {
        res.send(403, new Error('bah!'));
    });

    CLIENT.get('/', function (err, _, res) {
        t.ok(err);
        t.equal(res.statusCode, 403);
        t.end();
    });
});


test('fire event on error', function (t) {
    SERVER.once('InternalServer', function (req, res, err, cb) {
        t.ok(req);
        t.ok(res);
        t.ok(err);
        t.ok(cb);
        t.equal(typeof (cb), 'function');
        return (cb());
    });

    SERVER.get('/', function (req, res, next) {
        return (next(new restify.errors.InternalServerError('bah!')));
    });

    CLIENT.get('/', function (err, _, res) {
        t.ok(err);
        t.equal(res.statusCode, 500);
        t.expect(7);
        t.end();
    });
});


test('error handler defers "after" event', function (t) {
    t.expect(9);
    SERVER.once('NotFound', function (req, res, err, cb) {
        t.ok(req);
        t.ok(res);
        t.ok(cb);
        t.equal(typeof (cb), 'function');
        t.ok(err);

        SERVER.removeAllListeners('after');
        SERVER.once('after', function (req2, res2) {
            t.ok(req2);
            t.ok(res2);
            t.end();
        });
        res.send(404, 'foo');
        return (cb());
    });
    SERVER.once('after', function () {
        // do not fire prematurely
        t.notOk(true);
    });
    CLIENT.get('/' + uuid(), function (err, _, res) {
        t.ok(err);
        t.equal(res.statusCode, 404);
        t.end();
    });
});


test('gh-757 req.absoluteUri() defaults path segment to req.path()',
     function (t) {
    SERVER.get('/the-original-path', function (req, res, next) {
        var prefix = 'http://127.0.0.1:' + PORT;
        t.equal(req.absoluteUri('?key=value'),
                prefix + '/the-original-path/?key=value');
        t.equal(req.absoluteUri('#fragment'),
                prefix + '/the-original-path/#fragment');
        t.equal(req.absoluteUri('?key=value#fragment'),
                prefix + '/the-original-path/?key=value#fragment');
        res.send();
        next();
    });

    CLIENT.get('/the-original-path', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});


test('GH-693 sending multiple response header values', function (t) {
    SERVER.get('/', function (req, res, next) {
        res.link('/', 'self');
        res.link('/foo', 'foo');
        res.link('/bar', 'bar');
        res.send(200, 'root');
    });

    CLIENT.get('/', function (err, _, res) {
        t.equal(res.statusCode, 200);
        t.equal(res.headers['link'].split(',').length, 3);
        t.end();
    });
});
