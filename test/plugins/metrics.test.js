'use strict';

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


describe('request metrics plugin', function () {

    beforeEach(function (done) {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server'),
            handleUncaughtExceptions: true
        });

        SERVER.listen(0, '127.0.0.1', function () {
            PORT = SERVER.address().port;
            CLIENT = restifyClients.createJsonClient({
                url: 'http://127.0.0.1:' + PORT,
                dtrace: helper.dtrace,
                retry: false,
                requestTimeout: 200
            });

            done();
        });
    });

    afterEach(function (done) {
        CLIENT.close();
        SERVER.removeAllListeners();
        SERVER.close(done);
    });


    it('should return metrics for a given request', function (done) {

        SERVER.on('after', restify.plugins.metrics({
            server: SERVER
        }, function (err, metrics, req, res, route) {
            assert.ifError(err);

            assert.isObject(metrics, 'metrics');
            assert.equal(metrics.statusCode, 202);
            assert.isAtLeast(metrics.latency, 100);
            assert.equal(metrics.path, '/foo');
            assert.equal(metrics.connectionState, undefined);
            assert.equal(metrics.method, 'GET');
            assert.isNumber(metrics.inflightRequests);

            assert.isObject(req, 'req');
            assert.isObject(res, 'res');
            assert.isObject(route, 'route');
        }));

        SERVER.get('/foo', function (req, res, next) {
            setTimeout(function () {
                res.send(202, 'hello world');
                return next();
            }, 100);
        });

        CLIENT.get('/foo?a=1', function (err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 202);
            return done();
        });
    });


    it('should return \'RequestCloseError\' err', function (done) {

        // we test that the client times out and closes the request. server
        // flushes request responsibly but connectionState should indicate it
        // was closed by the server.

        SERVER.on('after', restify.plugins.metrics({
            server: SERVER
        }, function (err, metrics, req, res, route) {
            assert.ok(err);
            assert.equal(err.name, 'RequestCloseError');

            assert.isObject(metrics, 'metrics');
            assert.equal(metrics.statusCode, 202);
            assert.isAtLeast(metrics.latency, 200);
            assert.equal(metrics.path, '/foo');
            assert.equal(metrics.method, 'GET');
            assert.equal(metrics.connectionState, 'close');
            assert.isNumber(metrics.inflightRequests);
            return done();
        }));

        SERVER.get('/foo', function (req, res, next) {
            setTimeout(function () {
                res.send(202, 'hello world');
                return next();
            }, 250);
        });

        CLIENT.get('/foo?a=1', function (err, _, res) {
            // request should timeout
            assert.ok(err);
            assert.equal(err.name, 'RequestTimeoutError');
        });
    });


    it('should return \'RequestAbortedError\' err', function (done) {

        // we test that the client times out and closes the request. server
        // flushes request responsibly but connectionState should indicate it
        // was closed by the server.

        SERVER.on('after', restify.plugins.metrics({
            server: SERVER
        }, function (err, metrics, req, res, route) {
            assert.ok(err);
            assert.equal(err.name, 'RequestAbortedError');

            assert.isObject(metrics, 'metrics');
            assert.equal(metrics.statusCode, 202);
            assert.isAtLeast(metrics.latency, 200);
            assert.equal(metrics.path, '/foo');
            assert.equal(metrics.method, 'GET');
            assert.equal(metrics.connectionState, 'aborted');
            assert.isNumber(metrics.inflightRequests);
        }));

        SERVER.get('/foo', function (req, res, next) {
            // simulate request being aborted by TCP socket being closed
            req.emit('aborted');
            res.send(202, 'hello world');
            return next();
        });

        CLIENT.get('/foo?a=1', function (err, _, res) {
            assert.ifError(err);
            return done();
        });
    });


    it('should handle uncaught exceptions', function (done) {

        // we test that the client times out and closes the request. server
        // flushes request responsibly but connectionState should indicate it
        // was closed by the server.

        SERVER.on('after', restify.plugins.metrics({
            server: SERVER
        }, function (err, metrics, req, res, route) {
            assert.ok(err);
            assert.equal(err.name, 'Error');
            assert.equal(err.message, 'boom');
            assert.isObject(err.domain);

            assert.isObject(metrics, 'metrics');
            assert.equal(metrics.statusCode, 500);
            assert.isNumber(metrics.latency, 200);
            assert.equal(metrics.path, '/foo');
            assert.equal(metrics.method, 'GET');
            assert.equal(metrics.connectionState, undefined);
            assert.isNumber(metrics.inflightRequests);
        }));

        SERVER.get('/foo', function (req, res, next) {
            throw new Error('boom');
        });

        CLIENT.get('/foo?a=1', function (err, _, res) {
            assert.ok(err);
            return done();
        });
    });
});
