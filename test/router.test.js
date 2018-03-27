'use strict';
/* eslint-disable func-names */

var restify = require('../lib');
var Router = require('../lib/router');
var clients = require('restify-clients');
var _ = require('lodash');

if (require.cache[__dirname + '/lib/helper.js']) {
    delete require.cache[__dirname + '/lib/helper.js'];
}
var helper = require('./lib/helper.js');

///--- Globals

var test = helper.test;
var mockReq = {
    params: {},
    closed: function() {
        return false;
    },
    startHandlerTimer: function() {},
    endHandlerTimer: function() {}
};
var mockRes = {
    setHeader: function() {},
    send: function() {}
};

///--- Tests

test('mounts a route', function(t) {
    function handler(req, res, next) {
        res.send('Hello world');
    }

    var router = new Router({
        log: {}
    });
    router.mount({ method: 'GET', path: '/' }, [handler]);
    router.mount({ method: 'POST', path: '/' }, [handler]);
    router.mount({ method: 'GET', path: '/ab' }, [handler]);

    t.deepEqual(Object.keys(router.getRoutes()), ['get', 'post', 'getab']);

    // Route names are unique
    router.mount({ name: 'get', method: 'GET', path: '/get' }, [handler]);
    router.mount({ method: 'GET', path: '/a/b' }, [handler]);
    t.deepEqual(
        _.uniq(Object.keys(router.getRoutes())),
        Object.keys(router.getRoutes())
    );

    t.done();
});

test('unmounts a route', function(t) {
    function handler(req, res, next) {
        res.send('Hello world');
    }

    var router = new Router({
        log: {}
    });

    // Mount
    router.mount({ method: 'GET', path: '/a' }, [handler]);
    router.mount({ method: 'POST', path: '/b' }, [handler]);
    t.deepEqual(Object.keys(router.getRoutes()), ['geta', 'postb']);

    // Unmount
    var route = router.unmount('geta');
    t.ok(route);
    t.equal(route.name, 'geta');

    // Removes from mounted routes
    t.deepEqual(Object.keys(router.getRoutes()), ['postb']);

    // 404
    var handlerFound = router.lookup(
        Object.assign(
            {
                getUrl: function() {
                    return { pathname: '/a' };
                },
                method: 'GET'
            },
            mockReq
        ),
        mockRes
    );

    t.notOk(handlerFound);
    t.end();
});

test('unmounts a route that does not exist', function(t) {
    function handler(req, res, next) {
        res.send('Hello world');
    }

    var router = new Router({
        log: {}
    });

    // Mount
    router.mount({ method: 'GET', path: '/a' }, [handler]);
    t.notOk(router.unmount('non-existing'));
    t.end();
});

test('clean up xss for 404', function(t) {
    var server = restify.createServer();

    server.listen(3000, function(listenErr) {
        t.ifError(listenErr);

        var client = clients.createStringClient({
            url: 'http://127.0.0.1:3000/'
        });

        client.get(
            {
                path:
                    '/no5_such3_file7.pl?%22%3E%3Cscript%3Ealert(73541);%3C/' +
                    'script%3E',
                headers: {
                    connection: 'close'
                }
            },
            function(clientErr, req, res, data) {
                t.ok(clientErr);
                t.ok(
                    data.indexOf('%22%3E%3Cscript%3Ealert(73541)') === -1,
                    'should not reflect raw url'
                );

                server.close(function() {
                    t.end();
                });
            }
        );
    });
});

test('lookupByName runs a route by name and calls next', function(t) {
    var router = new Router({
        log: {}
    });

    function handler(req, res, next) {
        res.send('hello world');
        next();
    }

    router.mount({ method: 'GET', path: '/', name: 'my-route' }, [handler]);

    var handlerFound = router.lookupByName('my-route', mockReq, mockRes);
    t.ok(handlerFound);

    handlerFound(mockReq, mockRes, function next(err) {
        t.ifError(err);
        t.end();
    });
});

test('lookupByName calls next with err', function(t) {
    var router = new Router({
        log: {}
    });
    var myErr = new Error('My Error');
    router.mount({ method: 'GET', path: '/', name: 'my-route' }, [
        function(req, res, next) {
            next(myErr);
        }
    ]);

    var handlerFound = router.lookupByName('my-route', mockReq, mockRes);
    t.ok(handlerFound);

    handlerFound(mockReq, mockRes, function next(err) {
        t.deepEqual(err, myErr);
        t.end();
    });
});

test('lookup runs a route chain by path and calls next', function(t) {
    var router = new Router({
        log: {}
    });
    router.mount({ method: 'GET', path: '/', name: 'my-route' }, [
        function(req, res, next) {
            res.send('Hello world');
            next(); // no _afterRoute without next()
        }
    ]);

    var handlerFound = router.lookup(
        Object.assign(
            {
                getUrl: function() {
                    return { pathname: '/' };
                },
                method: 'GET'
            },
            mockReq
        ),
        mockRes
    );
    t.ok(handlerFound);

    handlerFound(mockReq, mockRes, function next(err) {
        t.ifError(err);
        t.end();
    });
});

test('lookup calls next with err', function(t) {
    var router = new Router({
        log: {}
    });
    var myErr = new Error('My Error');
    router.mount({ method: 'GET', path: '/', name: 'my-route' }, [
        function(req, res, next) {
            next(myErr);
        }
    ]);

    var handlerFound = router.lookup(
        Object.assign(
            {
                getUrl: function() {
                    return { pathname: '/' };
                },
                method: 'GET'
            },
            mockReq
        ),
        mockRes
    );
    t.ok(handlerFound);

    handlerFound(mockReq, mockRes, function next(err) {
        t.deepEqual(err, myErr);
        t.end();
    });
});

test('route handles 404', function(t) {
    var router = new Router({
        log: {}
    });
    router.defaultRoute(
        Object.assign(
            {
                getUrl: function() {
                    return { pathname: '/' };
                },
                method: 'GET'
            },
            mockReq
        ),
        mockRes,
        function next(err) {
            t.equal(err.statusCode, 404);
            t.end();
        }
    );
});

test('route handles method not allowed (405)', function(t) {
    var router = new Router({
        log: {}
    });
    router.mount({ method: 'GET', path: '/', name: 'my-route' }, [
        function(req, res, next) {
            res.send('Hello world');
        }
    ]);

    router.defaultRoute(
        Object.assign(
            {
                getUrl: function() {
                    return { pathname: '/' };
                },
                method: 'POST'
            },
            mockReq
        ),
        mockRes,
        function next(err) {
            t.equal(err.statusCode, 405);
            t.end();
        }
    );
});

test('prints debug info', function(t) {
    function handler1(req, res, next) {
        res.send('Hello world');
    }
    function handler2(req, res, next) {
        res.send('Hello world');
    }

    var router = new Router({
        log: {}
    });
    router.mount({ method: 'GET', path: '/' }, [handler1]);
    router.mount({ method: 'POST', path: '/' }, [handler1, handler2]);

    t.deepEqual(router.getDebugInfo(), {
        get: {
            name: 'get',
            method: 'get',
            path: '/',
            handlers: [handler1]
        },
        post: {
            name: 'post',
            method: 'post',
            path: '/',
            handlers: [handler1, handler2]
        }
    });
    t.end();
});

test('toString()', function(t) {
    function handler(req, res, next) {
        res.send('Hello world');
    }

    var router = new Router({
        log: {}
    });
    router.mount({ method: 'GET', path: '/' }, [handler]);
    router.mount({ method: 'GET', path: '/a' }, [handler]);
    router.mount({ method: 'GET', path: '/a/b' }, [handler]);
    router.mount({ method: 'POST', path: '/' }, [handler]);

    t.deepEqual(
        router.toString(),
        '└── / (GET|POST)\n' + '    └── a (GET)\n' + '        └── /b (GET)\n'
    );
    t.end();
});

test('toString() with ignoreTrailingSlash', function(t) {
    function handler(req, res, next) {
        res.send('Hello world');
    }

    var router = new Router({
        log: {},
        ignoreTrailingSlash: true
    });
    router.mount({ method: 'GET', path: '/' }, [handler]);
    router.mount({ method: 'GET', path: '/a' }, [handler]);
    router.mount({ method: 'GET', path: '/a/b' }, [handler]);
    router.mount({ method: 'POST', path: '/' }, [handler]);

    t.deepEqual(
        router.toString(),
        '└── / (GET|POST)\n' +
            '    └── a (GET)\n' +
            '        └── / (GET)\n' +
            '            └── b (GET)\n' +
            '                └── / (GET)\n'
    );
    t.end();
});
