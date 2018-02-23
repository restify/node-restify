'use strict';
/* eslint-disable func-names */

// external modules
var assert = require('chai').assert;
var restify = require('../../lib/index.js');
var restifyClients = require('restify-clients');
var validator = require('validator');

// internal files
var helper = require('../lib/helper');

describe('request id headers', function() {
    var SERVER;
    var CLIENT;
    var PORT;

    beforeEach(function(done) {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server')
        });

        SERVER.pre(
            restify.plugins.pre.reqIdHeaders({
                headers: ['x-req-id-a', 'x-req-id-b']
            })
        );

        SERVER.listen(0, '127.0.0.1', function() {
            PORT = SERVER.address().port;
            CLIENT = restifyClients.createJsonClient({
                url: 'http://127.0.0.1:' + PORT,
                dtrace: helper.dtrace,
                retry: false
            });
            return done();
        });
    });

    afterEach(function(done) {
        CLIENT.close();
        SERVER.close(function() {
            CLIENT = null;
            SERVER = null;
            return done();
        });
    });

    it('GH-1086: should reuse request id when available', function(done) {
        SERVER.get('/1', function(req, res, next) {
            // the 12345 value is set when the client is created.
            assert.ok(req.headers.hasOwnProperty('x-req-id-a'));
            assert.equal(req.getId(), req.headers['x-req-id-a']);
            res.send('hello world');
            return next();
        });

        // create new client since we new specific headers
        CLIENT = restifyClients.createJsonClient({
            url: 'http://127.0.0.1:' + PORT,
            headers: {
                'x-req-id-a': 12345
            }
        });

        CLIENT.get('/1', function(err, req, res, data) {
            assert.ifError(err);
            assert.equal(data, 'hello world');
            return done();
        });
    });

    it('GH-1086: should use second request id when available', function(done) {
        SERVER.get('/1', function(req, res, next) {
            assert.ok(req.headers.hasOwnProperty('x-req-id-b'));
            assert.equal(req.getId(), req.headers['x-req-id-b']);
            res.send('hello world');
            return next();
        });

        // create new client since we new specific headers
        CLIENT = restifyClients.createJsonClient({
            url: 'http://127.0.0.1:' + PORT,
            headers: {
                'x-req-id-b': 678910
            }
        });

        CLIENT.get('/1', function(err, req, res, data) {
            assert.ifError(err);
            assert.equal(data, 'hello world');
            return done();
        });
    });

    // eslint-disable-next-line
    it('GH-1086: should use default uuid request id if none provided', function(done) {
        SERVER.get('/1', function(req, res, next) {
            assert.ok(req.getId());
            assert.ok(validator.isUUID(req.getId()));
            res.send('hello world');
            return next();
        });

        // create new client since we new specific headers
        CLIENT = restifyClients.createJsonClient({
            url: 'http://127.0.0.1:' + PORT
        });

        CLIENT.get('/1', function(err, req, res, data) {
            assert.ifError(err);
            assert.equal(data, 'hello world');
            return done();
        });
    });

    it('GH-1086: empty request id should be ignored', function(done) {
        SERVER.get('/1', function(req, res, next) {
            assert.ok(req.headers.hasOwnProperty('x-req-id-b'));
            assert.equal(req.getId(), req.headers['x-req-id-b']);
            res.send('hello world');
            return next();
        });

        // create new client since we new specific headers
        CLIENT = restifyClients.createJsonClient({
            url: 'http://127.0.0.1:' + PORT,
            headers: {
                'x-req-id-a': '',
                'x-req-id-b': 12345
            }
        });

        CLIENT.get('/1', function(err, req, res, data) {
            assert.ifError(err);
            assert.equal(data, 'hello world');
            return done();
        });
    });
});
