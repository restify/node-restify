// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';
/* eslint-disable func-names */

var assert = require('chai').assert;
var restify = require('../../lib/index.js');
var restifyClients = require('restify-clients');

///--- Globals

var helper = require('../lib/helper');
var PORT = process.env.UNIT_TEST_PORT || 0;
var CLIENT;
var SERVER;

var errorMessage = 'Error message should include rate 0.5 r/s. Received: ';

function setupClientServer(ip, throttleOptions, done) {
    var server = restify.createServer({
        dtrace: helper.dtrace,
        log: helper.getLog('server')
    });

    server.use(function ghettoAuthenticate(req, res, next) {
        var username = req.url.match(/test\/([a-z]+)/)[1];

        if (username) {
            req.username = username;
        }

        next();
    });

    server.use(restify.plugins.throttle(throttleOptions));

    server.get('/test/:name', function(req, res, next) {
        res.send();
        next();
    });

    server.listen(PORT, ip, function() {
        PORT = server.address().port;
        var client = restifyClients.createJsonClient({
            url: 'http://' + ip + ':' + PORT,
            dtrace: helper.dtrace,
            retry: false
        });

        done(client, server);
    });
}

///--- Tests

describe('throttle plugin', function() {
    before(function setup(done) {
        setupClientServer(
            '127.0.0.1',
            {
                burst: 1,
                rate: 0.5,
                username: true,
                overrides: {
                    admin: {
                        burst: 0,
                        rate: 0
                    },
                    special: {
                        burst: 3,
                        rate: 1
                    }
                }
            },
            function setupGlobal(client, server) {
                CLIENT = client;
                SERVER = server;
                done();
            }
        );
    });

    after(function teardown(done) {
        CLIENT.close();
        SERVER.close(done);
    });

    it('ok', function(done) {
        CLIENT.get('/test/throttleMe', function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });

    it('throttled', function(done) {
        this.timeout(3000);

        CLIENT.get('/test/throttleMe', function(err, _, res) {
            assert.ok(err);
            assert.equal(err.statusCode, 429);
            assert.ok(
                err.message.indexOf('0.5 r/s') !== -1,
                errorMessage + (err && err.message)
            );
            assert.equal(res.statusCode, 429);

            setTimeout(function() {
                done();
            }, 2100);
        });
    });

    it('ok after tokens', function(done) {
        CLIENT.get('/test/throttleMe', function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });

    it('override limited', function(done) {
        CLIENT.get('/test/special', function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });

    it('override limited (not throttled)', function(done) {
        CLIENT.get('/test/special', function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });

    it('throttled after limited override', function(done) {
        CLIENT.get('/test/throttleMe', function() {
            CLIENT.get('/test/throttleMe', function(err, _, res) {
                assert.ok(err);
                assert.equal(res.statusCode, 429);
                assert.ok(
                    err.message.indexOf('0.5 r/s') !== -1,
                    errorMessage + (err && err.message)
                );
                done();
            });
        });
    });

    it('override unlimited', function(done) {
        CLIENT.get('/test/admin', function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });

    it('override unlimited (not throttled)', function(done) {
        CLIENT.get('/test/admin', function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });

    it('throttled after unlimited override', function(done) {
        CLIENT.get('/test/throttleMe', function() {
            CLIENT.get('/test/throttleMe', function(err, _, res) {
                assert.ok(err);
                assert.equal(res.statusCode, 429);
                assert.ok(
                    err.message.indexOf('0.5 r/s') !== -1,
                    errorMessage + (err && err.message)
                );
                done();
            });
        });
    });

    it('should not expose rate limit headers per default', function(done) {
        CLIENT.get('/test/throttleMe', function(err, _, res) {
            assert.isUndefined(res.headers['x-ratelimit-limit']);
            assert.isUndefined(res.headers['x-ratelimit-rate']);
            assert.isUndefined(res.headers['x-ratelimit-rate']);

            done();
        });
    });

    describe('expose headers', function() {
        before(function(done) {
            // close global server before creating a new to avoid port conflicts
            CLIENT.close();
            SERVER.close(done);
        });

        it('should expose headers on options set', function(done) {
            // setup a new server with headers set to true since we cant
            // change throttle options after init
            setupClientServer(
                '127.0.0.1',
                {
                    burst: 17,
                    rate: 0.1,
                    username: true,
                    setHeaders: true
                },
                function setupWithHeaders(client, server) {
                    client.get('/test/throttleMe', function(err, req, res) {
                        assert.equal(res.headers['x-ratelimit-limit'], '17');
                        assert.equal(res.headers['x-ratelimit-rate'], '0.1');
                        assert.equal(
                            res.headers['x-ratelimit-remaining'],
                            '16'
                        );

                        // it should count down
                        client.get('/test/throttleMe', function(
                            nextErr,
                            nextReq,
                            nextRes
                        ) {
                            assert.equal(
                                nextRes.headers['x-ratelimit-limit'],
                                '17'
                            );
                            assert.equal(
                                nextRes.headers['x-ratelimit-rate'],
                                '0.1'
                            );
                            assert.equal(
                                nextRes.headers['x-ratelimit-remaining'],
                                '15'
                            );

                            client.close();
                            server.close(done);
                        });
                    });
                }
            );
        });
    });
});
