// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';
/* eslint-disable func-names */

// external requires
var pino = require('pino');
var assert = require('chai').assert;
var restify = require('../../lib/index.js');
var restifyClients = require('restify-clients');
var sanitizePath = require('../../lib/plugins/pre/prePath.js');

// local files
var helper = require('../lib/helper');

// local globals
var PORT = process.env.UNIT_TEST_PORT || 0;
var CLIENT;
var SERVER;

describe('all other plugins', function() {
    beforeEach(function(done) {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server'),
            version: ['2.0.0', '0.5.4', '1.4.3']
        });

        SERVER.listen(PORT, '127.0.0.1', function() {
            PORT = SERVER.address().port;
            CLIENT = restifyClients.createJsonClient({
                url: 'http://127.0.0.1:' + PORT,
                dtrace: helper.dtrace,
                retry: false
            });

            done();
        });
    });

    afterEach(function(done) {
        CLIENT.close();
        SERVER.close(done);
    });

    describe('date parser', function() {
        it('should reject expired request', function(done) {
            SERVER.use(restify.plugins.dateParser());

            SERVER.get('/', function respond(req, res, next) {
                res.send();
                next();
            });

            var opts = {
                path: '/',
                headers: {
                    date: 'Tue, 15 Nov 1994 08:12:31 GMT'
                }
            };

            CLIENT.get(opts, function(err, _, res) {
                assert.ok(err);
                assert.ok(/Date header .+ is too old/.test(err.message));
                assert.equal(res.statusCode, 400);
                done();
            });
        });
    });

    describe('request logger', function() {
        it('tests the requestLoggers extra header properties', function(done) {
            var key = 'x-request-uuid';
            var badKey = 'x-foo-bar';
            var getPath = '/requestLogger/extraHeaders';
            var headers = [key, badKey];

            SERVER.use(restify.plugins.requestLogger({ headers: headers }));
            SERVER.get(getPath, function(req, res, next) {
                var childings = req.log[pino.symbols.chindingsSym];
                assert.match(childings, /"x-request-uuid":"foo-for-eva"/);
                assert.notMatch(childings, /x-foo-bar/);
                res.send();
                next();
            });

            var obj = {
                path: getPath,
                headers: {}
            };
            obj.headers[key] = 'foo-for-eva';
            CLIENT.get(obj, function(err, _, res) {
                assert.equal(res.statusCode, 200);
                assert.ifError(err);
                done();
            });
        });
    });

    describe('full response', function() {
        it('full response', function(done) {
            SERVER.use(restify.plugins.fullResponse());
            SERVER.get('/bar/:id', function tester2(req, res, next) {
                assert.ok(req.params);
                assert.equal(req.params.id, 'bar');
                res.send();
                next();
            });

            CLIENT.get('/bar/bar', function(err, _, res) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                var headers = res.headers;
                assert.ok(headers, 'headers ok');
                assert.ok(headers.date);
                assert.ok(headers['request-id']);
                assert.ok(headers['response-time'] >= 0);
                assert.equal(headers.server, 'restify');
                assert.equal(headers.connection, 'Keep-Alive');
                done();
            });
        });
    });

    describe('context', function() {
        it('set and get request context', function(done) {
            SERVER.pre(restify.plugins.pre.context());

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

    describe('sanitizePath', function() {
        // Ensure it santizies potential edge cases correctly
        var tests = {
            input: [
                '////foo////', //excess padding on both ends
                'bar/foo/', // trailing slash
                'bar/foo/////', // multiple trailing slashes
                'foo////bar', // multiple slashes inbetween
                '////foo', // multiple at beginning
                '/foo/bar' // don't mutate
            ],
            output: [
                '/foo',
                'bar/foo',
                'bar/foo',
                'foo/bar',
                '/foo',
                '/foo/bar'
            ],
            description: [
                'should clean excess padding on both ends',
                'should clean trailing slash',
                'should clean multiple trailing slashes',
                'should clean multiple slashes inbetween',
                'should clean multiple at beginning',
                'dont mutate correct urls'
            ]
        };

        for (var i = 0; i < tests.input.length; i++) {
            // eslint-disable-next-line wrap-iife
            (function() {
                var index = i;
                it(tests.description[index], function(done) {
                    var req = { url: tests.input[index] };
                    sanitizePath()(req, null, function() {
                        assert.equal(req.url, tests.output[index]);
                        done();
                    });
                });
            })();
        }
    });
});
