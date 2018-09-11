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
var mockResponse = function respond(req, res, next) {
    res.send(200);
};
///--- Tests

test('render route', function(t) {
    var server = restify.createServer();
    server.get({ name: 'countries', path: '/countries' }, mockResponse);
    server.get({ name: 'country', path: '/countries/:name' }, mockResponse);
    server.get(
        { name: 'cities', path: '/countries/:name/states/:state/cities' },
        mockResponse
    );

    var countries = server.router.render('countries', {});
    t.equal(countries, '/countries');

    var country = server.router.render('country', { name: 'Australia' });
    t.equal(country, '/countries/Australia');

    var cities = server.router.render('cities', {
        name: 'Australia',
        state: 'New South Wales'
    });
    t.equal(cities, '/countries/Australia/states/New%20South%20Wales/cities');

    t.end();
});

test('render route (missing params)', function(t) {
    var server = restify.createServer();
    server.get(
        { name: 'cities', path: '/countries/:name/states/:state/cities' },
        mockResponse
    );

    try {
        server.router.render('cities', { name: 'Australia' });
    } catch (ex) {
        t.equal(ex, 'Error: Route <cities> is missing parameter <state>');
    }

    t.end();
});

test('GH #704: render route (special charaters)', function(t) {
    var server = restify.createServer();
    server.get({ name: 'my-route', path: '/countries/:name' }, mockResponse);

    var link = server.router.render('my-route', { name: 'Australia' });
    t.equal(link, '/countries/Australia');

    t.end();
});

test('GH #704: render route (with sub-regex param)', function(t) {
    var server = restify.createServer();
    server.get(
        {
            name: 'my-route',
            path: '/countries/:code([A-Z]{2,3})'
        },
        mockResponse
    );

    var link = server.router.render('my-route', { code: 'FR' });
    t.equal(link, '/countries/FR');

    link = server.router.render('my-route', { code: '111' });
    t.equal(link, '/countries/111');
    t.end();
});

test('GH-796: render route (with multiple sub-regex param)', function(t) {
    var server = restify.createServer();
    server.get(
        {
            name: 'my-route',
            path: '/countries/:code([A-Z]{2,3})/:area([0-9]+)'
        },
        mockResponse
    );

    var link = server.router.render('my-route', { code: '111', area: 42 });
    t.equal(link, '/countries/111/42');
    t.end();
});

test('render route (with encode)', function(t) {
    var server = restify.createServer();
    server.get({ name: 'my-route', path: '/countries/:name' }, mockResponse);

    var link = server.router.render('my-route', { name: 'Trinidad & Tobago' });
    t.equal(link, '/countries/Trinidad%20%26%20Tobago');

    t.end();
});

test('render route (query string)', function(t) {
    var server = restify.createServer();
    server.get({ name: 'country', path: '/countries/:name' }, mockResponse);

    var country1 = server.router.render(
        'country',
        {
            name: 'Australia'
        },
        {
            state: 'New South Wales',
            'cities/towns': 5
        }
    );

    t.equal(
        country1,
        '/countries/Australia?state=New%20South%20Wales&cities%2Ftowns=5'
    );

    var country2 = server.router.render(
        'country',
        {
            name: 'Australia'
        },
        {
            state: 'NSW & VIC',
            'cities&towns': 5
        }
    );

    t.equal(
        country2,
        '/countries/Australia?state=NSW%20%26%20VIC&cities%26towns=5'
    );

    t.end();
});

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
