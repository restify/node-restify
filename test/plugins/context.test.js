'use strict';
/* eslint-disable func-names */

// external requires
var assert = require('chai').assert;
var restify = require('../../lib/index.js');
var restifyClients = require('restify-clients');

// local files
var helper = require('../lib/helper');

// local globals
var SERVER;
var CLIENT;
var PORT;

describe('request context', function() {
    beforeEach(function(done) {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server')
        });

        SERVER.use(restify.plugins.pre.context());

        SERVER.listen(0, '127.0.0.1', function() {
            PORT = SERVER.address().port;
            CLIENT = restifyClients.createJsonClient({
                url: 'http://127.0.0.1:' + PORT,
                dtrace: helper.dtrace,
                retry: false
            });

            done();
        });
    });

    after(function(done) {
        CLIENT.close();
        SERVER.close(done);
    });

    it('should use context', function(done) {
        SERVER.get('/', [
            function one(req, res, next) {
                req.set('foo', {
                    a: 1
                });
                return next();
            },
            function two(req, res, next) {
                assert.deepEqual(req.get('foo'), {
                    a: 1
                });
                req.get('foo').b = 2;
                req.set('bar', [1]);
                return next();
            },
            function three(req, res, next) {
                assert.deepEqual(req.get('foo'), {
                    a: 1,
                    b: 2
                });
                assert.deepEqual(req.get('bar'), [1]);
                return next();
            },
            function four(req, res, next) {
                // ensure all context is retrieved
                assert.deepStrictEqual(req.getAll(), {
                    foo: {
                        a: 1,
                        b: 2
                    },
                    bar: [1]
                });
                res.send();
                return next();
            }
        ]);

        CLIENT.get('/', function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            return done();
        });
    });

    it('should not share context', function(done) {
        SERVER.get('/1', function one(req, res, next) {
            // ensure we don't get context from previous request
            assert.equal(req.get('foo', null));
            res.end();
            return next();
        });

        CLIENT.get('/1', function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            return done();
        });
    });

    it('set and get request context', function(done) {
        var asserted = false;
        var expectedData = {
            pink: 'floyd'
        };

        SERVER.get('/context', [
            function(req, res, next) {
                req.set('pink', 'floyd');
                return next();
            },
            function(req, res, next) {
                assert.equal('floyd', req.get('pink'));
                assert.deepEqual(expectedData, req.getAll());
                asserted = true;
                res.send(200);
                return next();
            }
        ]);

        CLIENT.get('/context', function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            assert.ok(asserted);
            done();
        });
    });

    it('should throw if set key is not string', function(done) {
        SERVER.pre(restify.plugins.pre.context());

        var asserted = false;

        SERVER.get('/context', [
            function(req, res, next) {
                try {
                    req.set({}, 'floyd');
                } catch (e) {
                    asserted = true;
                    res.send(200);
                }
                return next();
            }
        ]);

        CLIENT.get('/context', function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            assert.ok(asserted);
            done();
        });
    });

    it('should throw if set key is empty string', function(done) {
        SERVER.pre(restify.plugins.pre.context());

        var asserted = false;

        SERVER.get('/context', [
            function(req, res, next) {
                try {
                    req.set('', 'floyd');
                } catch (e) {
                    asserted = true;
                    res.send(200);
                }
                return next();
            }
        ]);

        CLIENT.get('/context', function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            assert.ok(asserted);
            done();
        });
    });

    it('should throw if get key is not string', function(done) {
        SERVER.pre(restify.plugins.pre.context());

        var asserted = false;

        SERVER.get('/context', [
            function(req, res, next) {
                try {
                    req.get({});
                } catch (e) {
                    asserted = true;
                    res.send(200);
                }
                return next();
            }
        ]);

        CLIENT.get('/context', function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            assert.ok(asserted);
            done();
        });
    });

    it('should throw if get key is empty string', function(done) {
        SERVER.pre(restify.plugins.pre.context());

        var asserted = false;

        SERVER.get('/context', [
            function(req, res, next) {
                try {
                    req.get('');
                } catch (e) {
                    asserted = true;
                    res.send(200);
                }
                return next();
            }
        ]);

        CLIENT.get('/context', function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            assert.ok(asserted);
            done();
        });
    });
});
