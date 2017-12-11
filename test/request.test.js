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

before(function(cb) {
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

after(function(cb) {
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

test('query should return empty string', function(t) {
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

test('query should return raw query string string', function(t) {
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

test('should generate request id on first req.id() call', function(t) {
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

test('should set request id', function(t) {
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

test('should throw when setting request id after autogeneration', function(t) {
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
});

test('should throw when setting request id twice', function(t) {
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

test('should provide route object', function(t) {
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

test('should provide time when request started', function(t) {
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

test('should provide date when request started', function(t) {
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
