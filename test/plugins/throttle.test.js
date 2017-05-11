// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var assert = require('chai').assert;
var restify = require('../../lib/index.js');
var restifyClients = require('restify-clients');

///--- Globals

var helper = require('../lib/helper');
var plugins = require('../../lib').plugins;
var PORT = process.env.UNIT_TEST_PORT || 0;
var CLIENT;
var SERVER;

var errorMessage = 'Error message should include rate 0.5 r/s. Received: ';

///--- Tests

describe('throttle plugin', function () {

    before(function setup(done) {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server')
        });

        SERVER.use(function ghettoAuthenticate(req, res, next) {
            if (req.params.name) {
                req.username = req.params.name;
            }

            next();
        });

        SERVER.use(plugins.throttle({
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
        }));

        SERVER.get('/test/:name', function (req, res, next) {
            res.send();
            next();
        });

        SERVER.listen(PORT, '127.0.0.1', function () {
            PORT = SERVER.address().port;
            CLIENT = restifyClients.createJsonClient({
                url: 'http://127.0.0.1:' + PORT,
                dtrace: helper.dtrace,
                retry: false
            });

            done();
        });
    });

    after(function teardown(done) {
        CLIENT.close();
        SERVER.close(done);
    });


    it('ok', function (done) {
        CLIENT.get('/test/throttleMe', function (err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });


    it('throttled', function (done) {

        this.timeout(3000);

        CLIENT.get('/test/throttleMe', function (err, _, res) {
            assert.ok(err);
            assert.equal(err.statusCode, 429);
            assert.ok(
                err.message.indexOf('0.5 r/s') !== -1,
                errorMessage + (err && err.message)
            );
            assert.equal(res.statusCode, 429);

            setTimeout(function () {
                done();
            }, 2100);
        });
    });


    it('ok after tokens', function (done) {
        CLIENT.get('/test/throttleMe', function (err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });


    it('override limited', function (done) {
        CLIENT.get('/test/special', function (err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });


    it('override limited (not throttled)', function (done) {
        CLIENT.get('/test/special', function (err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });

    it('throttled after limited override', function (done) {
        CLIENT.get('/test/throttleMe', function () {
            CLIENT.get('/test/throttleMe', function (err, _, res) {
                assert.ok(err);
                assert.equal(res.statusCode, 429);
                assert.ok(
                    err.message.indexOf('0.5 r/s') !== -1,
                    errorMessage + (err && err.message));
                done();
            });
        });
    });


    it('override unlimited', function (done) {
        CLIENT.get('/test/admin', function (err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });


    it('override unlimited (not throttled)', function (done) {
        CLIENT.get('/test/admin', function (err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });

    it('throttled after unlimited override', function (done) {
        CLIENT.get('/test/throttleMe', function () {
            CLIENT.get('/test/throttleMe', function (err, _, res) {
                assert.ok(err);
                assert.equal(res.statusCode, 429);
                assert.ok(
                    err.message.indexOf('0.5 r/s') !== -1,
                    errorMessage + (err && err.message));
                done();
            });
        });
    });
});
