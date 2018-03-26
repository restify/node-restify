'use strict';
/* eslint-disable func-names */

var RouterRegistryRadix = require('../lib/routerRegistryRadix');
var Chain = require('../lib/chain');

if (require.cache[__dirname + '/lib/helper.js']) {
    delete require.cache[__dirname + '/lib/helper.js'];
}
var helper = require('./lib/helper.js');

///--- Globals

var test = helper.test;

function getTestRoute(opts) {
    var chain = new Chain();
    var name = opts.method + '-' + opts.path;
    name = name.replace(/\W/g, '').toLowerCase();

    return {
        name: name,
        method: opts.method,
        path: opts.path,
        spec: opts,
        chain: chain
    };
}

///--- Tests

test('adds a route', function(t) {
    var registry = new RouterRegistryRadix();
    registry.add(getTestRoute({ method: 'GET', path: '/' }));
    registry.add(getTestRoute({ method: 'POST', path: '/' }));
    registry.add(getTestRoute({ method: 'GET', path: '/ab' }));

    t.deepEqual(Object.keys(registry.get()), ['get', 'post', 'getab']);

    t.done();
});

test('removes a route', function(t) {
    var registry = new RouterRegistryRadix();

    // Mount
    registry.add(getTestRoute({ method: 'GET', path: '/a' }));
    registry.add(getTestRoute({ method: 'POST', path: '/b' }));
    t.deepEqual(Object.keys(registry.get()), ['geta', 'postb']);

    // Unmount
    var route = registry.remove('geta');
    t.ok(route);
    t.equal(route.name, 'geta');

    // Removes from registry
    t.deepEqual(Object.keys(registry.get()), ['postb']);

    t.end();
});

test('lookups a route', function(t) {
    var registry = new RouterRegistryRadix();
    var route = getTestRoute({ method: 'GET', path: '/a/:b' });
    registry.add(route);

    var result = registry.lookup('GET', '/a/b');

    t.deepEqual(result, {
        route: route,
        params: { b: 'b' },
        handler: result.handler
    });

    t.done();
});

test('get registered routes', function(t) {
    var registry = new RouterRegistryRadix();
    registry.add(getTestRoute({ method: 'GET', path: '/' }));
    registry.add(getTestRoute({ method: 'GET', path: '/a' }));
    registry.add(getTestRoute({ method: 'GET', path: '/a/b' }));
    registry.add(getTestRoute({ method: 'POST', path: '/' }));

    t.deepEqual(Object.keys(registry.get()), ['get', 'geta', 'getab', 'post']);
    t.end();
});

test('toString()', function(t) {
    var registry = new RouterRegistryRadix();
    registry.add(getTestRoute({ method: 'GET', path: '/' }));
    registry.add(getTestRoute({ method: 'GET', path: '/a' }));
    registry.add(getTestRoute({ method: 'GET', path: '/a/b' }));
    registry.add(getTestRoute({ method: 'POST', path: '/' }));

    t.deepEqual(
        registry.toString(),
        '└── / (GET|POST)\n' + '    └── a (GET)\n' + '        └── /b (GET)\n'
    );
    t.end();
});

test('toString() with ignoreTrailingSlash', function(t) {
    var registry = new RouterRegistryRadix({ ignoreTrailingSlash: true });
    registry.add(getTestRoute({ method: 'GET', path: '/' }));
    registry.add(getTestRoute({ method: 'GET', path: '/a' }));
    registry.add(getTestRoute({ method: 'GET', path: '/a/b' }));
    registry.add(getTestRoute({ method: 'POST', path: '/' }));

    t.deepEqual(
        registry.toString(),
        '└── / (GET|POST)\n' +
            '    └── a (GET)\n' +
            '        └── / (GET)\n' +
            '            └── b (GET)\n' +
            '                └── / (GET)\n'
    );
    t.end();
});
