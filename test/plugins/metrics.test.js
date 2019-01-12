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

function adjustExpectedLatency(expectedLatency, nbTimers) {
    // Expected latencies are adjusted to substract 1 ms per timer, because each
    // timer may have fired 1ms earlier for Node.js versions < 11.0. See
    // https://github.com/nodejs/node/issues/10154 for more info.
    return expectedLatency - nbTimers;
}

describe('request metrics plugin', function() {
    beforeEach(function(done) {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server'),
            handleUncaughtExceptions: true
        });

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

    afterEach(function(done) {
        CLIENT.close();
        SERVER.removeAllListeners();
        SERVER.close(done);
    });

    it('should return metrics for a given request', function(done) {
        SERVER.on('uncaughtException', function(req, res, route, err) {
            assert.ifError(err);
        });

        SERVER.on(
            'after',
            restify.plugins.metrics(
                {
                    server: SERVER
                },
                function(err, metrics, req, res, route) {
                    assert.ifError(err);

                    assert.isObject(metrics, 'metrics');
                    assert.equal(metrics.statusCode, 202);
                    assert.isAtLeast(
                        metrics.preLatency,
                        adjustExpectedLatency(50, 1)
                    );
                    assert.isAtLeast(
                        metrics.useLatency,
                        adjustExpectedLatency(50, 1)
                    );
                    assert.isAtLeast(
                        metrics.routeLatency,
                        adjustExpectedLatency(50, 1)
                    );
                    assert.isAtLeast(
                        metrics.latency,
                        adjustExpectedLatency(150, 3)
                    );
                    assert.isAtLeast(
                        metrics.totalLatency,
                        adjustExpectedLatency(150, 3)
                    );
                    assert.equal(metrics.path, '/foo');
                    assert.equal(metrics.connectionState, undefined);
                    assert.equal(metrics.method, 'GET');
                    assert.isNumber(metrics.inflightRequests);

                    assert.isObject(req, 'req');
                    assert.isObject(res, 'res');
                    assert.isObject(route, 'route');
                }
            )
        );

        SERVER.pre(function(req, res, next) {
            setTimeout(function() {
                return next();
            }, 50);
        });

        SERVER.use(function(req, res, next) {
            setTimeout(function() {
                return next();
            }, 50);
        });

        SERVER.get('/foo', function(req, res, next) {
            setTimeout(function() {
                res.send(202, 'hello world');
                return next();
            }, 50);
        });

        CLIENT.get('/foo?a=1', function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 202);
            return done();
        });
    });

    it('should return metrics with pre error', function(done) {
        SERVER.on('uncaughtException', function(req, res, route, err) {
            assert.ok(err);
            res.send(err);
        });

        SERVER.on(
            'after',
            restify.plugins.metrics(
                {
                    server: SERVER
                },
                function(err, metrics, req, res, route) {
                    assert.ok(err);

                    assert.isObject(metrics, 'metrics');
                    assert.isAtLeast(
                        metrics.preLatency,
                        adjustExpectedLatency(50, 1)
                    );
                    assert.equal(metrics.useLatency, null);
                    assert.equal(metrics.routeLatency, null);
                    assert.isAtLeast(
                        metrics.latency,
                        adjustExpectedLatency(50, 1)
                    );

                    return done();
                }
            )
        );

        SERVER.pre(function(req, res, next) {
            setTimeout(function() {
                return next(new Error('My Error'));
            }, 50);
        });

        CLIENT.get('/foo?a=1', function(err, _, res) {
            assert.ok(err);
        });
    });

    it('should return metrics with use error', function(done) {
        SERVER.on('uncaughtException', function(req, res, route, err) {
            assert.ok(err);
            res.send(err);
        });

        SERVER.on(
            'after',
            restify.plugins.metrics(
                {
                    server: SERVER
                },
                function(err, metrics, req, res, route) {
                    assert.ok(err);

                    assert.isObject(metrics, 'metrics');
                    assert.isAtLeast(metrics.preLatency, 0);
                    assert.isAtLeast(
                        metrics.useLatency,
                        adjustExpectedLatency(50, 1)
                    );
                    assert.equal(metrics.routeLatency, null);
                    assert.isAtLeast(
                        metrics.latency,
                        adjustExpectedLatency(50, 1)
                    );

                    return done();
                }
            )
        );

        SERVER.use(function(req, res, next) {
            setTimeout(function() {
                return next(new Error('My Error'));
            }, 50);
        });

        SERVER.get('/foo', function(req, res, next) {
            res.send(202, 'hello world');
            return next();
        });

        CLIENT.get('/foo?a=1', function(err, _, res) {
            assert.ok(err);
        });
    });

    it("should return 'RequestCloseError' err", function(done) {
        // we test that the client times out and closes the request. server
        // flushes request responsibly but connectionState should indicate it
        // was closed by the server.

        SERVER.on('uncaughtException', function(req, res, route, err) {
            assert.ifError(err);
        });

        SERVER.on(
            'after',
            restify.plugins.metrics(
                {
                    server: SERVER
                },
                function(err, metrics, req, res, route) {
                    assert.ok(err);
                    assert.equal(err.name, 'RequestCloseError');

                    assert.isObject(metrics, 'metrics');
                    // router doesn't run
                    assert.equal(metrics.statusCode, 444);

                    assert.isAtLeast(
                        metrics.preLatency,
                        adjustExpectedLatency(50, 1)
                    );
                    assert.isAtLeast(
                        metrics.useLatency,
                        adjustExpectedLatency(50, 1)
                    );
                    assert.isAtLeast(
                        metrics.routeLatency,
                        adjustExpectedLatency(250, 1)
                    );

                    // The request timeout value is 200 client side, but the
                    // overall latency is computed on the server, so we're
                    // tolerating a 10ms difference. This is inherently flaky.
                    assert.isAtLeast(metrics.latency, 200 - 10);

                    // latency should be lower as request timeouts
                    assert.isAbove(metrics.routeLatency, metrics.latency);
                    assert.equal(metrics.path, '/foo');
                    assert.equal(metrics.method, 'GET');
                    assert.equal(metrics.connectionState, 'close');
                    assert.isNumber(metrics.inflightRequests);
                    return done();
                }
            )
        );

        SERVER.pre(function(req, res, next) {
            setTimeout(function() {
                return next();
            }, 50);
        });

        SERVER.use(function(req, res, next) {
            setTimeout(function() {
                return next();
            }, 50);
        });

        SERVER.get(
            '/foo',
            function(req, res, next) {
                setTimeout(function() {
                    return next();
                }, 250);
            },
            function(req, res, next) {
                assert.fail('Client has already closed request');
                res.send(202, 'hello world');
                return next();
            }
        );

        CLIENT.get(
            {
                path: '/foo?a=1',
                requestTimeout: 200
            },
            function(err, _, res) {
                // request should timeout
                assert.ok(err);
                assert.equal(err.name, 'RequestTimeoutError');
            }
        );
    });

    it('should handle uncaught exceptions', function(done) {
        // we test that the client times out and closes the request. server
        // flushes request responsibly but connectionState should indicate it
        // was closed by the server.

        SERVER.on(
            'after',
            restify.plugins.metrics(
                {
                    server: SERVER
                },
                // TODO: test timeouts if any of the following asserts fails
                function(err, metrics, req, res, route) {
                    assert.ok(err);
                    assert.equal(err.name, 'Error');
                    assert.equal(err.message, 'boom');
                    assert.isObject(err.domain);

                    assert.isObject(metrics, 'metrics');
                    assert.equal(metrics.statusCode, 500);
                    assert.isNumber(metrics.latency);
                    assert.equal(metrics.path, '/foo');
                    assert.equal(metrics.method, 'GET');
                    assert.equal(metrics.connectionState, undefined);
                    assert.isNumber(metrics.inflightRequests);
                    return done();
                }
            )
        );

        SERVER.get('/foo', function(req, res, next) {
            throw new Error('boom');
        });

        CLIENT.get('/foo?a=1', function(err, _, res) {
            assert.ok(err);
        });
    });
});
