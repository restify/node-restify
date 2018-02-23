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
var MESSAGE = 'Malformed request syntax';

describe('strictQueryParams', function() {
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
        SERVER.close(done);
    });

    it('should respond 200 without plugin', function(done) {
        SERVER.use(
            restify.plugins.queryParser({
                mapParams: true,
                overrideParams: true
            })
        );

        SERVER.get('/query/:id', function(req, res, next) {
            assert.equal(req.params.id, 'bar');
            assert.notEqual(req.params.name, 'josep&jorge');
            assert.deepEqual(req.query, req.params);
            res.send();
            next();
        });

        CLIENT.get('/query/foo?id=bar&name=josep&jorge', function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });

    it('should respond 400 to non-strict key/val query param', function(done) {
        SERVER.pre(
            restify.plugins.pre.strictQueryParams({
                message: MESSAGE
            })
        );

        SERVER.use(
            restify.plugins.queryParser({
                mapParams: true,
                overrideParams: true
            })
        );

        SERVER.get('/query/:id', function(req, res, next) {
            res.send();
            next();
        });

        CLIENT.get('/query/foo?id=bar&name="josep&jorge', function(
            err,
            _,
            res
        ) {
            assert.equal(typeof err, 'object');
            assert.equal(res.statusCode, 400);
            assert.deepEqual(JSON.parse(res.body), {
                code: 'BadRequest',
                message: MESSAGE
            });
            done();
        });
    });

    it('should respond 400 without message opt', function(done) {
        SERVER.pre(restify.plugins.pre.strictQueryParams());

        SERVER.use(
            restify.plugins.queryParser({
                mapParams: true,
                overrideParams: true
            })
        );

        SERVER.get('/query/:id', function(req, res, next) {
            res.send();
            next();
        });

        CLIENT.get('/query/foo?id=bar&name="josep&jorge', function(
            err,
            _,
            res
        ) {
            assert.equal(typeof err, 'object');
            assert.equal(res.statusCode, 400);
            assert.deepEqual(JSON.parse(res.body), {
                code: 'BadRequest',
                message: 'Url query params does not meet strict format'
            });
            done();
        });
    });

    it('should respond 400 to query param with amp and plus', function(done) {
        SERVER.pre(
            restify.plugins.pre.strictQueryParams({
                message: MESSAGE
            })
        );

        SERVER.use(
            restify.plugins.queryParser({
                mapParams: true,
                overrideParams: true
            })
        );

        SERVER.get('/query/:id', function(req, res, next) {
            assert.equal(req.params.id, 'bar');
            assert.equal(req.params.name, 'josep & jorge');
            assert.deepEqual(req.query, req.params);
            res.send();
            next();
        });

        CLIENT.get('/query/foo?id=bar&name=josep+&+jorge', function(
            err,
            _,
            res
        ) {
            assert.equal(typeof err, 'object');
            assert.equal(res.statusCode, 400);
            assert.deepEqual(JSON.parse(res.body), {
                code: 'BadRequest',
                message: MESSAGE
            });
            done();
        });
    });

    // eslint-disable-next-line
    it('should respond to non-strict key/val query param value with 400', function(done) {
        SERVER.pre(
            restify.plugins.pre.strictQueryParams({
                message: MESSAGE
            })
        );

        SERVER.use(
            restify.plugins.queryParser({
                mapParams: true,
                overrideParams: true
            })
        );

        SERVER.get('/query/:id', function(req, res, next) {
            res.send();
            next();
        });

        CLIENT.get('/query/foo?id=bar&name=josep&jorge', function(err, _, res) {
            assert.equal(typeof err, 'object');
            assert.equal(res.statusCode, 400);
            assert.deepEqual(JSON.parse(res.body), {
                code: 'BadRequest',
                message: MESSAGE
            });
            done();
        });
    });

    it('should respond to valid query param value with 200', function(done) {
        SERVER.pre(
            restify.plugins.pre.strictQueryParams({
                message: MESSAGE
            })
        );

        SERVER.use(
            restify.plugins.queryParser({
                mapParams: true,
                overrideParams: true
            })
        );

        SERVER.get('/query/:id', function(req, res, next) {
            assert.equal(req.params.id, 'bar');
            assert.equal(req.params.name, 'josep & jorge');
            assert.deepEqual(req.query, req.params);
            res.send();
            next();
        });

        CLIENT.get('/query/foo?id=bar&name=josep+%26+jorge', function(
            err,
            _,
            res
        ) {
            assert.equal(typeof err, 'object');
            assert.equal(res.statusCode, 200);
            done();
        });
    });

    it('should respond 200 with scaped amp and s', function(done) {
        SERVER.pre(
            restify.plugins.pre.strictQueryParams({
                message: MESSAGE
            })
        );

        SERVER.use(
            restify.plugins.queryParser({
                mapParams: true,
                overrideParams: true
            })
        );

        SERVER.get('/query', function(req, res, next) {
            assert.equal(req.params.id, 'bar');
            assert.equal(req.params.name, 'josep & jorge');
            assert.deepEqual(req.query, req.params);
            res.send();
            next();
        });

        CLIENT.get('/query?id=bar&name=josep%20%26%20jorge', function(
            err,
            _,
            res
        ) {
            assert.equal(typeof err, 'object');
            assert.equal(res.statusCode, 200);
            done();
        });
    });
});
