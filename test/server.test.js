// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var assert = require('assert-plus');
var bunyan = require('bunyan');
var childprocess = require('child_process');
var http = require('http');
var stream = require('stream');

var errors = require('restify-errors');
var filed = require('filed');
var restifyClients = require('restify-clients');
var uuid = require('uuid');

var RestError = errors.RestError;
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
var FAST_CLIENT;
var SERVER;


///--- Tests

before(function (cb) {
    try {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            handleUncaughtExceptions: true,
            log: helper.getLog('server'),
            version: ['2.0.0', '0.5.4', '1.4.3']
        });
        SERVER.listen(PORT, '127.0.0.1', function () {
            PORT = SERVER.address().port;
            CLIENT = restifyClients.createJsonClient({
                url: 'http://127.0.0.1:' + PORT,
                dtrace: helper.dtrace,
                retry: false
            });
            FAST_CLIENT = restifyClients.createJsonClient({
                url: 'http://127.0.0.1:' + PORT,
                dtrace: helper.dtrace,
                retry: false,
                requestTimeout: 500
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
        FAST_CLIENT.close();
        SERVER.close(function () {
            CLIENT = null;
            FAST_CLIENT = null;
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

        if (++count === 2) {
            t.end();
        }
    });

    CLIENT.get('/foo/bar', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);

        if (++count === 2) {
            t.end();
        }
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

test('rm route and clear cached route', function (t) {

    t.equal(SERVER.router.cache.dump().length, 0);

    var route = SERVER.get('/cached/route', function cachey(req, res, next) {
        res.send({ foo: 'bar' });
        next();
    });

    CLIENT.get('/cached/route', function (err, _, res) {
        t.equal(SERVER.router.cache.dump().length, 1);
        t.equal(SERVER.router.cache.dump()[0].v.name, route);
        t.equal(res.statusCode, 200);
        t.ok(SERVER.rm(route));
        CLIENT.get('/cached/route', function (err2, _2, res2) {
            t.ok(err2);
            t.equal(SERVER.router.cache.dump().length, 0);
            t.equal(res2.statusCode, 404);
            t.end();
        });
    });
});

test('GH-1171: rm one version of the routes, other versions should still work',
    function (t) {
        var routeOne = SERVER.get({ path: '/hello/:name', version: '1.0.0'},
            function (req, res, next) {
                res.send('hello ' + req.params.name);
                next();
            });
        var routeTwo = SERVER.get({ path: '/hello/:name', version: '2.0.0'},
            function (req, res, next) {
                res.send('hello ' + req.params.name);
                next();
            });

        var routeThree = SERVER.get({ path: '/hello/:name', version: '3.0.0'},
            function (req, res, next) {
                res.send('hello ' + req.params.name);
                next();
            });

        t.ok(SERVER.rm(routeThree));

        var opts = {
            path: '/hello/friend',
            headers: {
                'accept-version': '3.0.0'
            }
        };
        CLIENT.get(opts, function (err, _, res) {
            t.ok(err);
            t.equal(res.statusCode, 400);

            opts.headers = {
                'accept-version': '1.0.0'
            };
            CLIENT.get(opts, function (err2, _2, res2) {
                t.ifError(err2);
                t.equal(res2.statusCode, 200);

                opts.headers = {
                    'accept-version': '2.0.0'
                };
                CLIENT.get(opts, function (err3, _3, res3) {
                    t.ifError(err3);
                    t.equal(res3.statusCode, 200);

                    t.ok(SERVER.rm(routeOne));
                    t.ok(SERVER.rm(routeTwo));

                    CLIENT.get('/hello/friend', function (err4, _4, res4) {
                        t.ok(err4);
                        t.equal(res4.statusCode, 404);
                        t.end();
                    });
                });
            });
        });
    });

test('use - throws TypeError on non function as argument', function (t) {

    var errMsg = 'handler (function) is required';

    t.throws(function () {
        SERVER.use('/nonfn');
    }, assert.AssertionError, errMsg);

    t.throws(function () {
        SERVER.use({an: 'object'});
    }, assert.AssertionError, errMsg);

    t.throws(function () {
        SERVER.use(
            function good(req, res, next) {
                next();
            },
            '/bad',
            {
                really: 'bad'
            });
    }, assert.AssertionError, errMsg);

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
        hostname: '127.0.0.1',
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
        hostname: '127.0.0.1',
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
        hostname: '127.0.0.1',
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
        hostname: '127.0.0.1',
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
        t.equal(err.body.message, '~2.1 is not supported by GET /foo/bar');
        t.equal(res.statusCode, 400);
        t.end();
    });
});


test('GH-56 streaming with filed (download)', function (t) {
    SERVER.get('/', function tester(req, res, next) {
        filed(__filename).pipe(res);
    });

    var opts = {
        hostname: '127.0.0.1',
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


test('GH-63 res.send 204 is sending a body', function (t) {
    SERVER.del('/hello/:name', function tester(req, res, next) {
        res.send(204);
        next();
    });

    var opts = {
        hostname: '127.0.0.1',
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
        hostname: '127.0.0.1',
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

                if (++done === count) {
                    t.end();
                }
            });
        });

    }

    find('/foo/a%40b.com', 'a@b.com');
    find('/foo/a@b.com', 'a@b.com');
    find('/foo/a*b.com', 'a*b.com');
    find('/foo/a%40b.com/bar', false);
});


test('GH-180 can parse DELETE body', function (t) {
    SERVER.use(restify.plugins.bodyParser({mapParams: false}));

    SERVER.del('/', function (req, res, next) {
        res.send(200, req.body);
        next();
    });

    var opts = {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/',
        method: 'DELETE',
        agent: false,
        headers: {
            accept: 'application/json',
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
        next(new errors.InternalError('bah!'));
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


test('re-emitting redirect from a response', function (t) {
    var redirectLocation;

    SERVER.on('redirect', function (payload) {
        redirectLocation = payload;
    });

    SERVER.get('/', function (req, res, next) {
        res.redirect('/10', next);
    });

    CLIENT.get('/', function (err, _, res) {
        t.equal(redirectLocation, '/10');
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

    var port = 3000;
    var myServer = restify.createServer({
        handleUncaughtExceptions: true
    });

    myServer.use(function (req, res, next) {
        next.ifError(null);
        next();
    });

    myServer.get('/foo/:id', function tester(req, res, next) {
        process.nextTick(function () {
            var e = new RestError({
                statusCode: 400,
                restCode: 'Foo',
                message: 'screw you client'
            });
            next.ifError(e);
            t.notOk(true);
            res.send(200);
            next();
        });
    });

    myServer.listen(port, function () {
        var myClient = restifyClients.createJsonClient({
            url: 'http://127.0.0.1:' + port,
            headers: {
                connection: 'close'
            }
        });

        myClient.get('/foo/bar', function (err) {
            t.ok(err);
            t.equal(err.message, '');
            myServer.close(function () {
                t.end();
            });
        });
    });
});


test('next.ifError is not available by default', function (t) {

    var port = 3000;
    var myServer = restify.createServer();

    myServer.get('/', function (req, res, next) {
        t.throws(function () {
            next.ifError(new Error('boom'));
        }, 'TypeError', 'next.ifError is not a function');

        res.send('hi');
        t.end();
    });

    myServer.listen(port, function () {
        var myClient = restifyClients.createStringClient({
            url: 'http://127.0.0.1:' + port,
            headers: {
                connection: 'close'
            }
        });

        myClient.get('/', function (err) {
            t.ifError(err);
            myServer.close(function () {
                t.end();
            });
        });
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

    for (i = 0; i < versions.length; i++) {
        mnt(versions[i]);
    }

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


test('gh-635 routes match the maximum version', function (t) {
    var p = '/' + uuid.v4();

    SERVER.get({
        path: p,
        version: ['1.2.0', '1.2.1', '1.2.2']
    }, function (req, res, next) {
        res.json(200, {
            requestedVersion: req.version(),
            matchedVersion: req.matchedVersion()
        });
        next();
    });

    var opts = {
        path: p,
        headers: {
            'accept-version': '<1.2.2'
        }
    };

    CLIENT.get(opts, function (err, _, res, obj) {
        t.equal(obj.requestedVersion, '<1.2.2');
        t.equal(obj.matchedVersion, '1.2.1');
        t.end();
    });
});


test('versioned route matching should prefer \
    first match if equal versions', function (t) {
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


test('versioned route matching should not throw TypeError' , function (t) {
    var p = '/path/' + uuid.v4();

    SERVER.post({
        path: p,
        version: ['1.1.0', '1.2.0'],
        contentType: 'application/json'
    }, function (req, res, next) {
        res.json(200, {route: p});
        next();
    });

    SERVER.post({
        path: '/path/:id',
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

    CLIENT.post(opts, function (err, _, res, obj) {
        t.equal(obj.route, p);
        t.end();
    });

});


test('GH-959 matchedVersion() should return on cached routes', function (t) {

    SERVER.get({
        path: '/test',
        version: '0.5.0'
    }, function (req, res, next) {
        res.send({
            version: req.version(),
            matchedVersion: req.matchedVersion()
        });
        return next();
    });


    CLIENT.get('/test', function (err, _, res, body) {
        t.ifError(err);
        t.equal(body.version, '*');
        t.equal(body.matchedVersion, '0.5.0');

        CLIENT.get('/test', function (err2, _2, res2, body2) {
            t.ifError(err2);
            t.equal(body.version, '*');
            t.equal(body.matchedVersion, '0.5.0');
            t.end();
        });
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


test('GH #704: Route with a valid RegExp params', function (t) {

    SERVER.get({
        name: 'regexp_param1',
        path: '/foo/:id([0-9]+)'
    }, function (req, res, next) {
        t.equal(req.params.id, '0123456789');
        res.send();
        next();
    });

    CLIENT.get('/foo/0123456789', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});


test('GH #704: Route with an unvalid RegExp params', function (t) {

    SERVER.get({
        name: 'regexp_param2',
        path: '/foo/:id([0-9]+)'
    }, function (req, res, next) {
        t.equal(req.params.id, 'A__M');
        res.send();
        next();
    });

    CLIENT.get('/foo/A__M', function (err, _, res) {
        t.ok(err);
        t.equal(res.statusCode, 404);
        t.end();
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
            if (++_done === 2) {
                t.end();
            }
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
        if (++_done === 2) {
            t.end();
        }
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

test('gh-193 route name normalization', function (t) {
    SERVER.get({
        name: 'foo',
        path: '/foo'
    }, function (req, res, next) {
        next('b-a-r');
    });

    SERVER.get({
        name: 'b-a-r',
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

        if (++done === 2) {
            t.end();
        }
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
        return (next(new errors.InternalServerError('bah!')));
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
        return (cb());
    });
    SERVER.once('after', function () {
        // do not fire prematurely
        t.notOk(true);
    });
    CLIENT.get('/' + uuid.v4(), function (err, _, res) {
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
        t.equal(res.headers.link.split(',').length, 3);
        t.end();
    });
});


test('gh-762 res.noCache()', function (t) {
    SERVER.get('/some-path', function (req, res, next) {
        res.noCache();
        res.send('data');
    });

    CLIENT.get('/some-path', function (err, _, res) {
        t.equal(res.headers['cache-control'],
          'no-cache, no-store, must-revalidate');
        t.equal(res.headers.pragma, 'no-cache');
        t.equal(res.headers.expires, '0');
        t.end();
    });
});


test('gh-779 set-cookie fields should never have commas', function (t) {
    SERVER.get('/set-cookie', function (req, res, next) {
        res.header('set-cookie', 'foo');
        res.header('set-cookie', 'bar');
        res.send(200);
    });

    CLIENT.get('/set-cookie', function (err, _, res) {
        t.ifError(err);
        t.equal(res.headers['set-cookie'].length, 1,
                'set-cookie header should only have 1 element');
        t.equal(res.headers['set-cookie'], 'bar');
        t.end();
    });
});


test('gh-986 content-type fields should never have commas'
    + ' (via `res.header(...)`)', function (t) {

        SERVER.get('/content-type', function (req, res, next) {
            res.header('content-type', 'foo');
            res.header('content-type', 'bar');
            res.send(200);
        });

        CLIENT.get('/content-type', function (err, _, res) {
            t.ifError(err);
            t.equal(Array.isArray(res.headers['content-type']), false,
                    'content-type header should not be an array');
            t.equal(res.headers['content-type'], 'bar');
            t.end();
        });
    });


test('gh-986 content-type fields should never have commas'
    + ' (via `res.setHeader(...)`)', function (t) {

        SERVER.get('/content-type', function (req, res, next) {
            res.setHeader('content-type', 'foo');
            res.setHeader('content-type', 'bar');
            res.send(200);
        });

        CLIENT.get('/content-type', function (err, _, res) {
            t.ifError(err);
            t.equal(Array.isArray(res.headers['content-type']), false,
                    'content-type header should not be an array');
            t.equal(res.headers['content-type'], 'bar');
            t.end();
        });
    });


test('gh-630 handle server versions as an array or string', function (t) {
    t.ok(SERVER.toString().indexOf('0.5.4,1.4.3,2.0.0') > -1);
    SERVER.versions = '3.0.0';
    t.ok(SERVER.toString().indexOf('3.0.0') > -1);
    t.end();
});


test('GH-877 content-type should be case insensitive', function (t) {
    SERVER.use(restify.plugins.bodyParser({maxBodySize: 1024}));

    SERVER.get('/cl', function (req, res, next) {
        t.equal(req.getContentType(), 'application/json');
        res.send(200);
        next();
    });

    var opts = {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/cl',
        method: 'GET',
        agent: false,
        headers: {
            accept: 'application/json',
            'content-type': 'APPLicatioN/JSon',
            'transfer-encoding': 'chunked'
        }
    };
    var client = http.request(opts, function (res) {
        t.equal(res.statusCode, 200);
        t.end();
    });
    client.end();
});


test('GH-882: route name is same as specified', function (t) {
    SERVER.get({
        name: 'my-r$-%-x',
        path: '/m1'
    }, function (req, res, next) {
        res.send({name: req.route.name});
    });

    CLIENT.get('/m1', function (err, _, res) {
        t.ifError(err);
        t.equal(res.body, '{"name":"my-r$-%-x"}');
        t.end();
    });
});


test('GH-733 if request closed early, stop processing. ensure only ' +
     'relevant audit logs output.', function (t) {
    // Dirty hack to capture the log record using a ring buffer.
    var numCount = 0;

    // FAST_CLIENT times out at 500ms, should capture two records then close
    // the request.
    SERVER.get('/audit', [
        function first(req, res, next) {
            req.startHandlerTimer('first');
            setTimeout(function () {
                numCount++;
                req.endHandlerTimer('first');
                return next();
            }, 300);
        },
        function second(req, res, next) {
            req.startHandlerTimer('second');
            setTimeout(function () {
                numCount++;
                req.endHandlerTimer('second');
                return next();
            }, 300);
        },
        function third(req, res, next) {
            req.endHandlerTimer('third');
            numCount++;
            res.send({ hello: 'world'});
            return next();
        }
    ]);


    CLIENT.get('/audit', function (err, req, res, data) {
        t.ifError(err);
        t.deepEqual(data, { hello: 'world' });
        t.equal(numCount, 3);

        // reset numCount
        numCount = 0;

        // set up audit logs
        var ringbuffer = new bunyan.RingBuffer({ limit: 1 });
        SERVER.once('after', restify.plugins.auditLogger({
            log: bunyan.createLogger({
                name: 'audit',
                streams:[ {
                    level: 'info',
                    type: 'raw',
                    stream: ringbuffer
                }]
            }),
            event: 'after'
        }));


        FAST_CLIENT.get('/audit', function (err2, req2, res2, data2) {
            setTimeout(function () {
                // should request timeout error
                t.ok(err2);
                t.equal(err2.name, 'RequestTimeoutError');
                t.deepEqual(data2, {});

                // check records
                t.ok(ringbuffer.records[0], 'no log records');
                t.equal(ringbuffer.records.length, 1,
                        'should only have 1 log record');
                // TODO: fix this after plugin is fixed to use
                // req.connectionState()
                // t.equal(ringbuffer.records[0].req.clientClosed, true);

                // check timers
                var handlers = Object.keys(ringbuffer.records[0].req.timers);
                t.equal(handlers.length, 2,
                        'should only have 2 req timers');
                t.equal(handlers[0], 'first',
                        'first handler timer not in order');
                t.equal(handlers[handlers.length - 1], 'second',
                        'second handler not last');
                t.end();

                // ensure third handler never ran
                t.equal(numCount, 2);
            }, 500);
            // don't start tests until a little after the request times out so
            // that server can start the audit logs.
        });
    });
});


test('GH-667 emit error event for generic Errors', function (t) {

    var restifyErrorFired = 0;
    var notFoundFired = 0;
    var myErr = new errors.NotFoundError('foobar');

    SERVER.get('/1', function (req, res, next) {
        return next(new Error('foobar'));
    });

    SERVER.get('/2', function (req, res, next) {
        return next(myErr);
    });

    SERVER.get('/3', function (req, res, next) {
        SERVER.on('NotFound', function (req2, res2, err, cb) {
            notFoundFired++;
            t.ok(err);
            t.equal(err, myErr);
            t.end();
            return cb();
        });
        return next(myErr);
    });

    SERVER.on('restifyError', function (req, res, err, cb) {
        restifyErrorFired++;
        t.ok(err);
        t.equal(err instanceof Error, true);

        if (err instanceof errors.NotFoundError) {
            t.equal(err, myErr);
        }
        return cb();
    });

    /*eslint-disable no-shadow*/
    CLIENT.get('/1', function (err, req, res, data) {
        // should get regular error
        // fail here. But why?
        t.ok(err);
        t.equal(restifyErrorFired, 1);

        CLIENT.get('/2', function (err, req, res, data) {
            // should get not found error
            t.ok(err);
            t.equal(restifyErrorFired, 2);

            CLIENT.get('/3', function (err, req, res, data) {
                // should get notfounderror
                t.ok(err);
                t.equal(restifyErrorFired, 3);
                t.equal(notFoundFired, 1);
            });
        });
    });
    /*eslint-enable no-shadow*/
});


test('GH-667 returning error in error handler should not do anything',
function (t) {

    SERVER.on('ImATeapot', function (req, res, err, cb) {
        // attempt to pass a new error back
        return cb(new errors.LockedError('oh noes'));
    });

    SERVER.get('/1', function (req, res, next) {
        return next(new errors.ImATeapotError('foobar'));
    });

    CLIENT.get('/1', function (err, req, res, data) {
        t.ok(err);
        // should still get the original error
        t.equal(err.name, 'ImATeapotError');
        t.end();
    });
});


test('GH-958 RCS does not write triggering record', function (t) {
    var passThrough = new stream.PassThrough();
    var count = 1;
    // we would expect to get 3 logging statements
    passThrough.on('data', function (chunk) {
        var obj = JSON.parse(chunk.toString());
        t.equal(obj.msg, count.toString());

        if (count === 3) {
            t.end();
        }
        count++;
    });

    SERVER.log = helper.getLog(
        'server', [{
            level: bunyan.DEBUG,
            type: 'raw',
            stream: new restify.bunyan.RequestCaptureStream({
                level: bunyan.WARN,
                stream: passThrough
            })}
        ]
    );

    SERVER.use(restify.plugins.requestLogger());

    SERVER.get('/rcs', function (req, res, next) {
        req.log.debug('1');
        req.log.info('2');
        req.log.error('3');
        res.send();
        next();
    });

    CLIENT.get('/rcs', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
    });
});


test('GH-1024 disable uncaughtException handler', function (t) {
    // With uncaughtException handling disabled, the node process will abort,
    // so testing of this feature must occur in a separate node process.

    var allStderr = '';
    var serverPath = __dirname + '/lib/server-withDisableUncaughtException.js';
    var serverProc = childprocess.fork(serverPath, {silent: true});

    // Record stderr, to check for the correct exception stack.
    serverProc.stderr.on('data', function (data) {
        allStderr += String(data);
    });

    // Handle serverPortResponse and then make the client request - the request
    // should receive a connection closed error (because the server aborts).
    serverProc.on('message', function (msg) {
        if (msg.task !== 'serverPortResponse') {
            serverProc.kill();
            t.end();
            return;
        }

        var port = msg.port;
        var client = restifyClients.createJsonClient({
            url: 'http://127.0.0.1:' + port,
            dtrace: helper.dtrace,
            retry: false
        });

        client.get('/', function (err, _, res) {
            // Should get a connection closed error, but no response object.
            t.ok(err);
            t.equal(err.code, 'ECONNRESET');
            t.equal(res, undefined);

            serverProc.kill(); // Ensure it's dead.

            t.ok(allStderr.indexOf('Error: Catch me!') > 0);

            t.end();
        });
    });

    serverProc.send({task: 'serverPortRequest'});
});


test('GH-999 Custom 404 handler does not send response', function (t) {

    // make the 404 handler act like other error handlers - must modify
    // err.body to send a custom response.

    SERVER.on('NotFound', function (req, res, err, cb) {
        err.body = {
            message: 'my custom not found'
        };
        return cb();
    });

    CLIENT.get('/notfound', function (err, _, res) {
        t.ok(err);
        t.deepEqual(res.body, JSON.stringify({
            message: 'my custom not found'
        }));
        t.end();
    });
});


test('calling next(false) should early exit from pre handlers', function (t) {

    var afterFired = false;

    SERVER.pre(function (req, res, next) {
        res.send('early exit');
        return next(false);
    });

    SERVER.get('/1', function (req, res, next) {
        res.send('hello world');
        return next();
    });

    SERVER.on('after', function () {
        afterFired = true;
    });

    CLIENT.get('/1', function (err, req, res, data) {
        t.ifError(err);
        t.equal(data, 'early exit');
        // ensure after event fired
        t.ok(afterFired);
        t.end();
    });

});


test('GH-1078: server name should default to restify', function (t) {

    var myServer = restify.createServer();
    var port = 3000;

    myServer.get('/', function (req, res, next) {
        res.send('hi');
        return next();
    });

    var myClient = restifyClients.createStringClient({
        url: 'http://127.0.0.1:' + port,
        headers: {
            connection: 'close'
        }
    });

    myServer.listen(port, function () {
        myClient.get('/', function (err, req, res, data) {
            t.ifError(err);
            t.equal(res.headers.server, 'restify');
            myServer.close(t.end);
        });
    });
});


test('GH-1078: server name should be customizable', function (t) {

    var myServer = restify.createServer({
        name: 'foo'
    });
    var port = 3000;

    myServer.get('/', function (req, res, next) {
        res.send('hi');
        return next();
    });

    var myClient = restifyClients.createStringClient({
        url: 'http://127.0.0.1:' + port,
        headers: {
            connection: 'close'
        }
    });

    myServer.listen(port, function () {
        myClient.get('/', function (err, req, res, data) {
            t.ifError(err);
            t.equal(res.headers.server, 'foo');
            myServer.close(t.end);
        });
    });
});


test('GH-1078: server name should be overridable and not sent down',
function (t) {

    var myServer = restify.createServer({
        name: ''
    });
    var port = 3000;

    myServer.get('/', function (req, res, next) {
        res.send('hi');
        return next();
    });

    var myClient = restifyClients.createStringClient({
        url: 'http://127.0.0.1:' + port,
        headers: {
            connection: 'close'
        }
    });

    myServer.listen(port, function () {
        myClient.get('/', function (err, req, res, data) {
            t.ifError(err);
            t.equal(res.headers.hasOwnProperty('server'), false);
            myServer.close(t.end);
        });
    });
});


test('should emit \'after\' on successful request', function (t) {

    SERVER.on('after', function (req, res, route, err) {
        t.ifError(err);
        t.end();
    });

    SERVER.get('/foobar', function (req, res, next) {
        res.send('hello world');
        next();
    });

    CLIENT.get('/foobar', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
    });
});


test('should emit \'after\' on errored request', function (t) {

    SERVER.on('after', function (req, res, route, err) {
        t.ok(err);
        t.end();
    });

    SERVER.get('/foobar', function (req, res, next) {
        next(new Error('oh noes'));
    });

    CLIENT.get('/foobar', function (err, _, res) {
        t.ok(err);
        t.equal(res.statusCode, 500);
    });
});


test('should emit \'after\' on uncaughtException', function (t) {

    SERVER.on('after', function (req, res, route, err) {
        t.ok(err);
        t.equal(err.message, 'oh noes');
    });

    SERVER.get('/foobar', function (req, res, next) {
        throw new Error('oh noes');
    });

    CLIENT.get('/foobar', function (err, _, res) {
        t.ok(err);
        t.equal(err.name, 'InternalError');
        t.end();
    });
});


test('should emit \'after\' when sending res on uncaughtException',
function (t) {

    SERVER.on('after', function (req, res, route, err) {
        t.ok(err);
        t.equal(err.message, 'oh noes');
    });

    SERVER.on('uncaughtException', function (req, res, route, err) {
        res.send(504, 'boom');
    });


    SERVER.get('/foobar', function (req, res, next) {
        throw new Error('oh noes');
    });

    CLIENT.get('/foobar', function (err, _, res) {
        t.ok(err);
        t.equal(err.name, 'GatewayTimeoutError');
        t.end();
    });
});


test('should emit \'after\' on client closed request ' +
'(req.connectionState(): \'close\')', function (t) {

    SERVER.on('after', function (req, res, route, err) {
        t.ok(err);
        t.equal(req.connectionState(), 'close');
        t.equal(err.name, 'RequestCloseError');
        t.end();
    });

    SERVER.get('/foobar', function (req, res, next) {
        // fast client times out at 500ms, wait for 800ms which should cause
        // client to timeout
        setTimeout(function () {
            return next();
        }, 800);
    });

    FAST_CLIENT.get('/foobar', function (err, _, res) {
        t.ok(err);
        t.equal(err.name, 'RequestTimeoutError');
    });
});


test('should \'emit\' after on aborted request ' +
'(req.connectionState(): \'aborted\')', function (t) {

    SERVER.on('after', function (req, res, route, err) {
        t.ok(err);
        t.equal(req.connectionState(), 'aborted');
        t.equal(err.name, 'RequestAbortedError');
    });

    SERVER.get('/foobar', function (req, res, next) {

        req.emit('aborted');
        // fast client times out at 500ms, wait for 800ms which should cause
        // client to timeout
        setTimeout(function () {
            return next();
        }, 800);
    });

    FAST_CLIENT.get('/foobar', function (err, _, res) {
        t.ok(err);
        t.equal(err.name, 'RequestTimeoutError');
        t.end();
    });
});


test('should increment/decrement inflight request count', function (t) {

    SERVER.get('/foo', function (req, res, next) {
        t.equal(SERVER.inflightRequests(), 1);
        res.send();
        return next();
    });

    CLIENT.get('/foo', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.equal(SERVER.inflightRequests(), 0);
        t.end();
    });
});


test('should increment/decrement inflight request count for concurrent reqs',
function (t) {

    SERVER.get('/foo1', function (req, res, next) {
        t.equal(SERVER.inflightRequests(), 1);
        setTimeout(function () {
            res.send();
            return next();
        }, 250);
    });

    SERVER.get('/foo2', function (req, res, next) {
        t.equal(SERVER.inflightRequests(), 2);
        res.send();
        return next();
    });

    CLIENT.get('/foo1', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.equal(SERVER.inflightRequests(), 0);
        t.end();
    });

    CLIENT.get('/foo2', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.equal(SERVER.inflightRequests(), 1);
    });
});

test('should emit \'close\' on server close', function (t) {
    var server = restify.createServer();

    server.listen(PORT + 1, '127.0.0.1', function () {
        server.on('close', function () {
            t.end();
        });
        server.close();
    });
});


test('should cleanup inflight requests count for 404s', function (t) {

    SERVER.get('/foo1', function (req, res, next) {
        t.equal(SERVER.inflightRequests(), 1);
        res.send();
        return next();
    });

    CLIENT.get('/foo1', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.equal(SERVER.inflightRequests(), 0);

        CLIENT.get('/doesnotexist', function (err2, _2, res2) {
            t.ok(err2);
            t.equal(res2.statusCode, 404);
            t.equal(SERVER.inflightRequests(), 0);
            t.end();
        });
    });
});


test('should cleanup inflight requests count for timeouts', function (t) {

    SERVER.get('/foo1', function (req, res, next) {
        t.equal(SERVER.inflightRequests(), 1);
        setTimeout(function () {
            res.send();
            return next();
        }, 1000);
    });

    SERVER.get('/foo2', function (req, res, next) {
        t.equal(SERVER.inflightRequests(), 2);
        res.send();
        return next();
    });

    FAST_CLIENT.get('/foo1', function (err, _, res) {
        t.ok(err);
        t.equal(SERVER.inflightRequests(), 1);

        setTimeout(function () {
            // wait for server to flush response, 600 extra plus the already
            // 500ms we waited should be enough to cover the 1000 response time
            // of server.
            t.equal(SERVER.inflightRequests(), 0);
            t.end();
        }, 600);
    });

    CLIENT.get('/foo2', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.equal(SERVER.inflightRequests(), 1);
    });
});


test('should cleanup inflight requests count on uncaughtExceptions',
    function (t) {

    SERVER.on('uncaughtException', function (req, res, route, err) {
        res.send(500, 'asplode');
    });

    SERVER.get('/foo1', function (req, res, next) {
        t.equal(SERVER.inflightRequests(), 1);
        throw new Error('oh noes');
    });

    CLIENT.get('/foo1', function (err, _, res) {
        t.ok(err);
        t.equal(SERVER.inflightRequests(), 0);
        t.end();
    });
});


test('should show debug information', function (t) {

    SERVER.pre(function pre (req, res, next) {
        return next();
    });
    SERVER.pre(function pre2 (req, res, next) {
        return next();
    });
    SERVER.use(function use (req, res, next) {
        return next();
    });
    SERVER.use(function use2 (req, res, next) {
        return next();
    });
    SERVER.on('after', function aft () {});
    SERVER.on('after', function aft2 () {});

    SERVER.get('/foo',
        function (req, res, next) {
            return next();
        },
        function foo(req, res, next) {
            res.end();
            return next();
        }
    );

    SERVER.get('/bar/:a/:b', function bar(req, res, next) {
        res.end();
        return next();
    });

    SERVER.get(/^\/([a-zA-Z0-9_\.~-]+)\/(.*)/,
    function freeform(req, res, next) {
        res.end();
        return next();
    });

    var debugInfo = SERVER.getDebugInfo();

    t.ok(debugInfo);
    t.ok(debugInfo.routes);

    debugInfo.routes.forEach(function (route) {
        t.ok(route);
        t.equal(typeof route.name, 'string');
        t.equal(typeof route.method, 'string');
        t.ok(
            typeof route.input === 'string' ||
            route.input instanceof RegExp === true
        );
        t.equal(typeof route.compiledRegex, 'object');

        t.equal(route.versions instanceof Array, true);
        route.versions.forEach(function (v) {
            t.equal(typeof v, 'string');
        });

        t.equal(route.handlers instanceof Array, true);
        route.handlers.forEach(function (handlerFn) {
            t.equal(typeof handlerFn, 'string');
        });
    });

    // check /foo
    t.equal(debugInfo.routes[0].handlers[0], 'use');
    t.equal(debugInfo.routes[0].handlers[1], 'use2');
    t.equal(debugInfo.routes[0].handlers[2], 'anonymous');
    t.equal(debugInfo.routes[0].handlers[3], 'foo');

    // check /bar
    t.equal(debugInfo.routes[0].handlers[0], 'use');
    t.equal(debugInfo.routes[0].handlers[1], 'use2');
    t.equal(debugInfo.routes[1].handlers[2], 'bar');

    // check use, pre, and after handlers
    t.ok(debugInfo.server.use);
    t.equal(debugInfo.server.use[0], 'use');
    t.equal(debugInfo.server.use[1], 'use2');

    t.ok(debugInfo.server.pre);
    t.equal(debugInfo.server.pre[0], 'pre');
    t.equal(debugInfo.server.pre[1], 'pre2');

    t.ok(debugInfo.server.after);
    t.equal(debugInfo.server.after[0], 'aft');
    t.equal(debugInfo.server.after[1], 'aft2');

    // detailed test for compiled regex
    // verify url parameter regex
    t.deepEqual(debugInfo.routes[1].name, 'getbarab054143200');
    t.deepEqual(debugInfo.routes[1].method, 'get');
    t.deepEqual(debugInfo.routes[1].input, '/bar/:a/:b');
    t.ok(debugInfo.routes[1].compiledRegex instanceof RegExp);
    t.deepEqual(debugInfo.routes[1].compiledUrlParams, {
        0: 'a',
        1: 'b'
    });
    // verify freeform regex
    t.deepEqual(debugInfo.routes[2].name, 'getazaz09_054143200');
    t.deepEqual(debugInfo.routes[2].method, 'get');
    t.ok(debugInfo.routes[2].input instanceof RegExp);
    t.ok(debugInfo.routes[2].compiledRegex instanceof RegExp);
    // freeform regex input should equal output
    t.equal(debugInfo.routes[2].input.toString(),
            debugInfo.routes[2].compiledRegex.toString());
    t.deepEqual(debugInfo.routes[2].compiledUrlParams, null);

    // verify other server details
    t.deepEqual(Object.keys(debugInfo.server.formatters), [
        'application/javascript',
        'application/json',
        'text/plain',
        'application/octet-stream'
    ]);
    t.equal(debugInfo.server.address, '127.0.0.1');
    t.equal(typeof debugInfo.server.port, 'number');
    t.equal(typeof debugInfo.server.inflightRequests, 'number');

    t.end();
});


test('should emit \'pre\' event on a 200', function (t) {
    SERVER.get('/foo/:id', function echoId(req, res, next) {
        t.ok(req.params);
        t.equal(req.params.id, 'bar');
        t.equal(req.isUpload(), false);
        res.send();
        next();
    });

    SERVER.once('pre', function (req, res) {
        t.ok(req);
        t.ok(res);
    });

    CLIENT.get('/foo/bar', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});


test('should emit \'pre\' event on 404', function (t) {
    SERVER.get('/foo/:id', function echoId(req, res, next) {
        t.ok(req.params);
        t.equal(req.params.id, 'bar');
        t.equal(req.isUpload(), false);
        res.send();
        next();
    });

    SERVER.once('pre', function (req, res) {
        t.ok(req);
        t.ok(res);
    });

    CLIENT.get('/badroute', function (err, _, res) {
        t.ok(err);
        t.equal(res.statusCode, 404);
        t.end();
    });
});


test('should emit \'routed\' event on a 200', function (t) {
    SERVER.get('/foo/:id', function echoId(req, res, next) {
        t.ok(req.params);
        t.equal(req.params.id, 'bar');
        t.equal(req.isUpload(), false);
        res.send();
        next();
    });

    SERVER.once('routed', function (req, res, route) {
        t.ok(req);
        t.ok(res);
        t.ok(route);
    });

    CLIENT.get('/foo/bar', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});


test('should not emit \'routed\' event on 404', function (t) {
    SERVER.get('/foo/:id', function echoId(req, res, next) {
        t.ok(req.params);
        t.equal(req.params.id, 'bar');
        t.equal(req.isUpload(), false);
        res.send();
        next();
    });

    SERVER.once('routed', function (req, res, route) {
        t.fail();
    });

    CLIENT.get('/badroute', function (err, _, res) {
        t.ok(err);
        t.equal(res.statusCode, 404);
        t.end();
    });
});


test('should emit restifyError even for router errors', function (t) {

    var notFoundFired = false;
    var restifyErrFired = false;

    SERVER.once('NotFound', function (req, res, err, cb) {
        notFoundFired = true;
        t.ok(err);
        t.equal(err instanceof Error, true);
        t.equal(err.name, 'ResourceNotFoundError');
        return cb();
    });

    SERVER.once('restifyError', function (req, res, err, cb) {
        restifyErrFired = true;
        t.ok(err);
        t.equal(err instanceof Error, true);
        t.equal(err.name, 'ResourceNotFoundError');
        return cb();
    });

    /*eslint-disable no-shadow*/
    CLIENT.get('/dne', function (err, req, res, data) {
        t.ok(err);
        t.equal(err.name, 'ResourceNotFoundError');
        t.equal(notFoundFired, true);
        t.equal(restifyErrFired, true);
        t.done();
    });
});
