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

describe('conditional request', function() {
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

    it('Correct Etag and headers', function(done) {
        SERVER.get(
            '/etag/:id',
            function(req, res, next) {
                res.etag = 'testETag';
                next();
            },
            restify.plugins.conditionalRequest(),
            function(req, res, next) {
                res.body = 'testing 304';
                res.send();
                next();
            }
        );

        var opts = {
            path: '/etag/foo',
            headers: {
                'If-Match': 'testETag',
                'If-None-Match': 'testETag'
            }
        };
        CLIENT.get(opts, function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 304);
            done();
        });
    });

    it('mismatched Etag and If-Match', function(done) {
        SERVER.get(
            '/etag/:id',
            function setEtag(req, res, next) {
                res.etag = 'testEtag';
                next();
            },
            restify.plugins.conditionalRequest(),
            function respond(req, res, next) {
                res.send();
                next();
            }
        );

        var opts = {
            path: '/etag/foo',
            headers: {
                'If-Match': 'testETag2'
            }
        };
        CLIENT.get(opts, function(err, _, res) {
            assert.ok(err);
            assert.equal(res.statusCode, 412);
            done();
        });
    });

    it('If-Modified header & !modified content', function(done) {
        var now = new Date();
        var yesterday = new Date(now.setDate(now.getDate() - 1));
        SERVER.get(
            '/etag/:id',
            function(req, res, next) {
                res.header('Last-Modified', yesterday);
                next();
            },
            restify.plugins.conditionalRequest(),
            function(req, res, next) {
                res.send('testing 304');
                next();
            }
        );

        var opts = {
            path: '/etag/foo',
            headers: {
                'If-Modified-Since': new Date()
            }
        };
        CLIENT.get(opts, function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 304);
            done();
        });
    });

    it('If-Unmodified-Since header,modified content', function(done) {
        var now = new Date();
        var yesterday = new Date(now.setDate(now.getDate() - 1));
        SERVER.get(
            '/etag/:id',
            function(req, res, next) {
                res.header('Last-Modified', new Date());
                next();
            },
            restify.plugins.conditionalRequest(),
            function(req, res, next) {
                res.send('testing 412');
                next();
            }
        );

        var opts = {
            path: '/etag/foo',
            headers: {
                'If-Unmodified-Since': yesterday
            }
        };
        CLIENT.get(opts, function(err, _, res) {
            assert.ok(err);
            assert.equal(res.statusCode, 412);
            done();
        });
    });

    it('valid headers, ahead time, unmodified OK', function(done) {
        var now = new Date();
        var ahead = new Date(now.getTime() + 1000);
        SERVER.get(
            '/etag/:id',
            function(req, res, next) {
                res.header('Last-Modified', now);
                next();
            },
            restify.plugins.conditionalRequest(),
            function(req, res, next) {
                res.send();
                next();
            }
        );

        var opts = {
            path: '/etag/foo',
            headers: {
                'If-Modified-Since': ahead
            }
        };

        CLIENT.get(opts, function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 304);
            done();
        });
    });

    it('valid headers, ahead Timezone, modified content', function(done) {
        var now = new Date();
        var ahead = new Date(now.setHours(now.getHours() + 5));
        SERVER.get(
            '/etag/:id',
            function(req, res, next) {
                res.header('Last-Modified', now);
                next();
            },
            restify.plugins.conditionalRequest(),
            function(req, res, next) {
                res.send();
                next();
            }
        );

        var opts = {
            path: '/etag/foo',
            headers: {
                'If-Unmodified-Since': ahead
            }
        };
        CLIENT.get(opts, function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });

    it('PUT with matched Etag and headers', function(done) {
        SERVER.put(
            '/etag/:id',
            function(req, res, next) {
                res.etag = 'testETag';
                next();
            },
            restify.plugins.conditionalRequest(),
            function(req, res, next) {
                res.send();
                next();
            }
        );

        var opts = {
            path: '/etag/foo',
            headers: {
                'If-Match': 'testETag',
                'If-None-Match': 'testETag'
            }
        };
        CLIENT.put(opts, {}, function(err, _, res) {
            assert.ok(err);
            assert.equal(res.statusCode, 412);
            done();
        });
    });
});
