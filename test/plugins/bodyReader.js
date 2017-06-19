'use strict';

// core requires

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


describe('body reader', function () {

    describe('gzip content encoding', function () {

        beforeEach(function (done) {
            SERVER = restify.createServer({
                dtrace: helper.dtrace,
                log: helper.getLog('server')
            });

            SERVER.listen(0, '127.0.0.1', function () {
                PORT = SERVER.address().port;

                done();
            });
        });

        afterEach(function (done) {
            CLIENT.close();
            SERVER.close(done);
        });

        it('should parse gzip encoded content', function (done) {
            SERVER.use(restify.plugins.bodyParser());

            CLIENT = restifyClients.createJsonClient({
                url: 'http://127.0.0.1:' + PORT,
                retry: false,
                gzip: {}
            });

            SERVER.post('/compressed', function (req, res, next) {
                assert.equal(req.body.apple, 'red');
                res.send();
                next();
            });

            CLIENT.post('/compressed', {
                apple: 'red'
            }, function (err, _, res) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        });

        it('should not accept unsupported content encoding', function (done) {
            SERVER.use(restify.plugins.bodyParser());

            CLIENT = restifyClients.createJsonClient({
                url: 'http://127.0.0.1:' + PORT,
                retry: false,
                headers: {
                    'content-encoding': 'unsupported'
                }
            });

            SERVER.post('/compressed', function (req, res, next) {
                assert.equal(req.body.apple, 'red');
                res.send();
                next();
            });

            CLIENT.post('/compressed', {
                apple: 'red'
            }, function (err, _, res) {
                assert.isOk(err, 'should fail');
                assert.equal(res.statusCode, 415);
                assert.equal(res.headers['accept-encoding'], 'gzip');
                done();
            });
        });

        it('should parse unencoded content', function (done) {
            SERVER.use(restify.plugins.bodyParser());

            CLIENT = restifyClients.createJsonClient({
                url: 'http://127.0.0.1:' + PORT,
                retry: false
            });

            SERVER.post('/compressed', function (req, res, next) {
                assert.equal(req.body.apple, 'red');
                res.send();
                next();
            });

            CLIENT.post('/compressed', {
                apple: 'red'
            }, function (err, _, res) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        });
    });

});
