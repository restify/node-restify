'use strict';
/* eslint-disable func-names */

// external modules
var assert = require('chai').assert;
var restify = require('../../lib/index.js');
var restifyClients = require('restify-clients');

// local modules
var helper = require('../lib/helper');

// globals
var SERVER;
var CLIENT;
var PORT;

describe('request expiry parser', function() {
    beforeEach(function(done) {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server')
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
        SERVER.close(done);
    });

    describe('constructor', function() {
        it('should throw if no headers passed in', function(done) {
            try {
                SERVER.use(restify.plugins.requestExpiry({}));
            } catch (e) {
                done();
            }
        });

        it('should throw if only timeout header passed in', function(done) {
            try {
                SERVER.use(
                    restify.plugins.requestExpiry({
                        timeoutHeader: 'foo'
                    })
                );
            } catch (e) {
                done();
            }
        });

        it('should throw if only timeout header passed in', function(done) {
            try {
                SERVER.use(
                    restify.plugins.requestExpiry({
                        startHeader: 'foo'
                    })
                );
            } catch (e) {
                done();
            }
        });
    });

    describe('absolute header', function() {
        it('should timeout due to request expiry', function(done) {
            var key = 'x-request-expiry';
            var getPath = '/request/expiry';
            var called = false;

            SERVER.use(restify.plugins.requestExpiry({ absoluteHeader: key }));
            SERVER.get(getPath, function(req, res, next) {
                called = true;
                res.send();
                next();
            });

            var obj = {
                path: getPath,
                headers: {
                    'x-request-expiry': Date.now() - 100
                }
            };

            CLIENT.get(obj, function(err, _, res) {
                assert.ok(err);
                assert.equal(res.statusCode, 504);
                assert.equal(called, false);
                done();
            });
        });

        it('should not timeout due to request expiry', function(done) {
            var key = 'x-request-expiry';
            var getPath = '/request/expiry';
            var called = false;

            SERVER.use(restify.plugins.requestExpiry({ absoluteHeader: key }));
            SERVER.get(getPath, function(req, res, next) {
                assert.isFalse(req.isExpired());
                called = true;
                res.send();
                next();
            });

            var obj = {
                path: getPath,
                headers: {
                    'x-request-expiry': Date.now() + 100
                }
            };

            CLIENT.get(obj, function(err, _, res) {
                assert.equal(res.statusCode, 200);
                assert.equal(called, true);
                assert.ifError(err);
                done();
            });
        });

        it('should be ok without request expiry header', function(done) {
            var key = 'x-request-expiry';
            var getPath = '/request/expiry';
            var called = false;

            SERVER.use(restify.plugins.requestExpiry({ absoluteHeader: key }));
            SERVER.get(getPath, function(req, res, next) {
                // requests never expire if the header is not set
                assert.isFalse(req.isExpired());
                called = true;
                res.send();
                next();
            });

            var obj = {
                path: getPath,
                headers: {
                    'x-request-expiry': Date.now() + 100
                }
            };

            CLIENT.get(obj, function(err, _, res) {
                assert.equal(res.statusCode, 200);
                assert.equal(called, true);
                assert.ifError(err);
                done();
            });
        });

        it('should be ok if request expiry header is NaN', function(done) {
            var key = 'x-request-expiry';
            var getPath = '/request/expiry';
            var called = false;

            SERVER.use(restify.plugins.requestExpiry({ absoluteHeader: key }));
            SERVER.get(getPath, function(req, res, next) {
                // requests never expire if the header is not set
                assert.isFalse(req.isExpired());
                called = true;
                res.send();
                next();
            });

            var obj = {
                path: getPath,
                headers: {
                    'x-request-expiry':
                        'I am just a poor boy with my story seldom told'
                }
            };

            CLIENT.get(obj, function(err, _, res) {
                assert.equal(res.statusCode, 200);
                assert.equal(called, true);
                assert.ifError(err);
                done();
            });
        });
    });

    describe('timeout header', function() {
        it('should timeout due to request expiry', function(done) {
            var startKey = 'x-request-starttime';
            var timeoutKey = 'x-request-timeout';
            var getPath = '/request/expiry';
            var called = false;

            SERVER.use(
                restify.plugins.requestExpiry({
                    startHeader: startKey,
                    timeoutHeader: timeoutKey
                })
            );
            SERVER.get(getPath, function(req, res, next) {
                assert.isFalse(req.isExpired());
                called = true;
                res.send();
                next();
            });

            var obj = {
                path: getPath,
                headers: {
                    'x-request-starttime': Date.now() - 200,
                    'x-request-timeout': 100
                }
            };

            CLIENT.get(obj, function(err, _, res) {
                assert.ok(err);
                assert.equal(res.statusCode, 504);
                assert.equal(called, false);
                done();
            });
        });

        it('should not timeout due to request expiry', function(done) {
            var startKey = 'x-request-starttime';
            var timeoutKey = 'x-request-timeout';
            var getPath = '/request/expiry';
            var called = false;

            SERVER.use(
                restify.plugins.requestExpiry({
                    startHeader: startKey,
                    timeoutHeader: timeoutKey
                })
            );
            SERVER.get(getPath, function(req, res, next) {
                called = true;
                res.send();
                next();
            });

            var obj = {
                path: getPath,
                headers: {
                    'x-request-starttime': Date.now(),
                    'x-request-timeout': 100
                }
            };

            CLIENT.get(obj, function(err, _, res) {
                assert.equal(res.statusCode, 200);
                assert.equal(called, true);
                assert.ifError(err);
                done();
            });
        });

        it('should be ok without request expiry header', function(done) {
            var startKey = 'x-request-starttime';
            var timeoutKey = 'x-request-timeout';
            var getPath = '/request/expiry';
            var called = false;

            SERVER.use(
                restify.plugins.requestExpiry({
                    startHeader: startKey,
                    timeoutHeader: timeoutKey
                })
            );
            SERVER.get(getPath, function(req, res, next) {
                // requests never expire if the header is not set
                assert.isFalse(req.isExpired());
                called = true;
                res.send();
                next();
            });

            var obj = {
                path: getPath,
                headers: {}
            };

            CLIENT.get(obj, function(err, _, res) {
                assert.equal(res.statusCode, 200);
                assert.equal(called, true);
                assert.ifError(err);
                done();
            });
        });

        it('should be ok if start header is NaN', function(done) {
            var startKey = 'x-request-starttime';
            var timeoutKey = 'x-request-timeout';
            var getPath = '/request/expiry';
            var called = false;

            SERVER.use(
                restify.plugins.requestExpiry({
                    startHeader: startKey,
                    timeoutHeader: timeoutKey
                })
            );
            SERVER.get(getPath, function(req, res, next) {
                // requests never expire if the header is not set
                assert.isFalse(req.isExpired());
                called = true;
                res.send();
                next();
            });

            var obj = {
                path: getPath,
                headers: {
                    'x-request-starttime': 'I have squandered my resistance',
                    'x-request-timeout': 100
                }
            };

            CLIENT.get(obj, function(err, _, res) {
                assert.equal(res.statusCode, 200);
                assert.equal(called, true);
                assert.ifError(err);
                done();
            });
        });

        it('should be ok if timeout header is NaN', function(done) {
            var startKey = 'x-request-starttime';
            var timeoutKey = 'x-request-timeout';
            var getPath = '/request/expiry';
            var called = false;

            SERVER.use(
                restify.plugins.requestExpiry({
                    startHeader: startKey,
                    timeoutHeader: timeoutKey
                })
            );
            SERVER.get(getPath, function(req, res, next) {
                // requests never expire if the header is not set
                assert.isFalse(req.isExpired());
                called = true;
                res.send();
                next();
            });

            var obj = {
                path: getPath,
                headers: {
                    'x-request-starttime': Date.now(),
                    'x-request-timeout': 'For a pocked full of mumbles'
                }
            };

            CLIENT.get(obj, function(err, _, res) {
                assert.equal(res.statusCode, 200);
                assert.equal(called, true);
                assert.ifError(err);
                done();
            });
        });

        it('should be ok if both headers are NaN', function(done) {
            var startKey = 'x-request-starttime';
            var timeoutKey = 'x-request-timeout';
            var getPath = '/request/expiry';
            var called = false;

            SERVER.use(
                restify.plugins.requestExpiry({
                    startHeader: startKey,
                    timeoutHeader: timeoutKey
                })
            );
            SERVER.get(getPath, function(req, res, next) {
                // requests never expire if the header is not set
                assert.isFalse(req.isExpired());
                called = true;
                res.send();
                next();
            });

            var obj = {
                path: getPath,
                headers: {
                    'x-request-starttime': 'Such are promises',
                    'x-request-timeout': 'All lies and jests'
                }
            };

            CLIENT.get(obj, function(err, _, res) {
                assert.equal(res.statusCode, 200);
                assert.equal(called, true);
                assert.ifError(err);
                done();
            });
        });
    });
});
