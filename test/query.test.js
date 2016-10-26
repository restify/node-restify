// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

/*
 * Test query param handling, i.e. the 'queryParser' plugin.
 */

'use strict';

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


///--- Tests

before(function (callback) {
    try {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server')
        });

        SERVER.listen(PORT, '127.0.0.1', function () {
            PORT = SERVER.address().port;
            CLIENT = restify.createJsonClient({
                url: 'http://127.0.0.1:' + PORT,
                dtrace: helper.dtrace,
                retry: false,
                agent: false
            });

            process.nextTick(callback);
        });
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});


after(function (callback) {
    try {
        SERVER.close(callback);
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});


test('query ok', function (t) {
    SERVER.get('/query/:id',
        restify.queryParser(),
        function (req, res, next) {
            t.equal(req.params.id, 'foo');
            t.equal(req.params.name, 'markc');
            res.send();
            next();
        });

    CLIENT.get('/query/foo?id=bar&name=markc', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});


test('GH-124 query ok no query string', function (t) {
    SERVER.get('/query/:id',
        restify.queryParser(),
        function (req, res, next) {
            t.equal(req.getQuery(), '');
            res.send();
            next();
        });

    CLIENT.get('/query/foo', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});


test('query: bracket object (default options)', function (t) {
    SERVER.get('/query/:id',
        restify.queryParser(),
        function (req, res, next) {
            t.equal(req.params.id, 'foo');
            t.ok(req.params.name);
            t.equal(req.params.name.first, 'mark');
            t.equal(req.query.name.last, 'cavage');
            res.send();
            next();
        });

    var p = '/query/foo?name[first]=mark&name[last]=cavage';
    CLIENT.get(p, function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

test('query: bracket array (default options)', function (t) {
    SERVER.get('/query/:id',
        restify.queryParser(),
        function (req, res, next) {
            t.deepEqual(req.params, {id: 'foo', a: [1, 2]});
            res.send();
            next();
        });

    var p = '/query/foo?a[]=1&a[]=2';
    CLIENT.get(p, function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

test('query: bracket array (#444, #895)', function (t) {
    SERVER.get('/query/:id',
        restify.queryParser(),
        function (req, res, next) {
            t.deepEqual(req.params, {
                id: 'foo',
                pizza: { left: [ 'pepperoni', 'bacon' ], right: [ 'ham' ] }
            });
            res.send();
            next();
        });

    var p = '/query/foo'
        + '?pizza[left][]=pepperoni&pizza[left][]=bacon&pizza[right][]=ham';
    CLIENT.get(p, function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});


/*
 * Restify's `queryParser()` plugin uses the "qs" module. Some qs and restify
 * module history:
 *
 *  RESTIFY VER             QS VER  QS OPTIONS NOTES
 *  (earlier)               ???
 *  restify@2.x             ^1.0.0
 *  restify@3.x             ^2.4.1  adds `parameterLimit`
 *  restify@4.x             ^3.1.0  allowDots=true is default; qs.parse returns
 *                                  "plain" objects
 *  restify-plugins@1.x     ^6.2.1  allowDots=false is default;
 *                                  plainObjects=true is default
 *
 * Notes:
 * - After restify@4.x, the plugins have been unbundled such that it is
 *   the restify-plugins version that is relevant for `queryParser()` behaviour.
 * - qs@3 was an abberation in that `allowDots` (parsing `?field.a=1` into
 *   `{field: 'a'}`) was true by default and "plain" objects (null prototype)
 *   were returned. This was changed in qs@5 to have the default behaviour
 *   of qs@2.
 *
 * Unfortunately this means that restify@4.x's `queryParser()` is an aberration:
 * restify before v4 and after (via restify-plugins) have the same default
 * behaviour.
 *
 * The following test cases attempt to ensure unintended query string parsing
 * changes don't surprise restify's `queryParser()` again.
 */

// Note: This default is the opposite of restify versions other than 4.x
// and restify-plugins.
test('query: plainObjects=true by default', function (t) {
    SERVER.get('/query/:id',
        restify.queryParser(),
        function (req, res, next) {
            t.equal(req.query.field, 'value');
            // Doesn't inherit from Object (i.e. a 'plain' object).
            t.ok(req.query.hasOwnProperty === undefined);
            res.send();
            next();
        });

    var p = '/query/foo?field=value';
    CLIENT.get(p, function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

// Note: This default is the opposite of restify versions other than 4.x
// and restify-plugins.
test('query: allowDots=true by default', function (t) {
    SERVER.get('/query/:id',
        restify.queryParser(),
        function (req, res, next) {
            t.deepEqual(req.params,
                {id: 'foo', name: {first: 'Trent', last: 'Mick'}});
            res.send();
            next();
        });

    var p = '/query/foo?name.first=Trent&name.last=Mick';
    CLIENT.get(p, function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

test('query: allowDots=false plainObjects=false', function (t) {
    SERVER.get('/query/:id',
        restify.queryParser({allowDots: false, plainObjects: false}),
        function (req, res, next) {
            t.deepEqual(req.query,
                {'name.first': 'Trent', 'name.last': 'Mick'});
            t.equal(typeof (req.query.hasOwnProperty), 'function');
            t.equal(req.query.hasOwnProperty('name.first'), true);
            res.send();
            next();
        });

    var p = '/query/foo?name.first=Trent&name.last=Mick';
    CLIENT.get(p, function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});


test('query: mapParams=false', function (t) {
    SERVER.get('/query/:id',
        restify.queryParser({mapParams: false}),
        function (req, res, next) {
            t.deepEqual(req.query, {field: 'value'});
            t.equal(req.params.hasOwnProperty('field'), false);
            res.send();
            next();
        });

    var p = '/query/foo?field=value';
    CLIENT.get(p, function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

test('query: arrayLimit=1', function (t) {
    SERVER.get('/query/:id',
        restify.queryParser({arrayLimit: 2}),
        function (req, res, next) {
            t.deepEqual(req.query, {field: {0: 'a', 3: 'b'}});
            res.send();
            next();
        });

    var p = '/query/foo?field[]=a&field[3]=b';
    CLIENT.get(p, function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

test('query: depth=2', function (t) {
    SERVER.get('/query/:id',
        restify.queryParser({depth: 2}),
        function (req, res, next) {
            t.deepEqual(req.query,
                { a: { b: { c: { '[d][e][f][g][h][i]': 'j' } } } });
            res.send();
            next();
        });

    var p = '/query/foo?a[b][c][d][e][f][g][h][i]=j';
    CLIENT.get(p, function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

test('query: parameterLimit=3', function (t) {
    SERVER.get('/query/:id',
        restify.queryParser({parameterLimit: 3}),
        function (req, res, next) {
            t.deepEqual(req.query, {a: 'b', c: 'd', e: 'f'});
            res.send();
            next();
        });

    var p = '/query/foo?a=b&c=d&e=f&g=h';
    CLIENT.get(p, function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

test('query: strictNullHandling=true', function (t) {
    SERVER.get('/query/:id',
        restify.queryParser({strictNullHandling: true}),
        function (req, res, next) {
            t.deepEqual(req.query, {a: null, b: '', c: 'd'});
            res.send();
            next();
        });

    var p = '/query/foo?a&b=&c=d';
    CLIENT.get(p, function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});
