'use strict';
/* eslint-disable func-names */

// core requires
var http = require('http');

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

describe('body reader', function() {
    describe('gzip content encoding', function() {
        beforeEach(function(done) {
            SERVER = restify.createServer({
                dtrace: helper.dtrace,
                log: helper.getLog('server')
            });

            SERVER.listen(0, '127.0.0.1', function() {
                PORT = SERVER.address().port;

                done();
            });
        });

        afterEach(function(done) {
            CLIENT.close();
            SERVER.close(done);
        });

        it('should parse gzip encoded content', function(done) {
            SERVER.use(restify.plugins.bodyParser());

            CLIENT = restifyClients.createJsonClient({
                url: 'http://127.0.0.1:' + PORT,
                retry: false,
                gzip: {}
            });

            SERVER.post('/compressed', function(req, res, next) {
                assert.equal(req.body.apple, 'red');
                res.send();
                next();
            });

            CLIENT.post(
                '/compressed',
                {
                    apple: 'red'
                },
                function(err, _, res) {
                    assert.ifError(err);
                    assert.equal(res.statusCode, 200);
                    done();
                }
            );
        });

        it('should not accept unsupported content encoding', function(done) {
            SERVER.use(restify.plugins.bodyParser());

            CLIENT = restifyClients.createJsonClient({
                url: 'http://127.0.0.1:' + PORT,
                retry: false,
                headers: {
                    'content-encoding': 'unsupported'
                }
            });

            SERVER.post('/compressed', function(req, res, next) {
                assert.equal(req.body.apple, 'red');
                res.send();
                next();
            });

            CLIENT.post(
                '/compressed',
                {
                    apple: 'red'
                },
                function(err, _, res) {
                    assert.isOk(err, 'should fail');
                    assert.equal(res.statusCode, 415);
                    assert.equal(res.headers['accept-encoding'], 'gzip');
                    done();
                }
            );
        });

        it('should parse unencoded content', function(done) {
            SERVER.use(restify.plugins.bodyParser());

            CLIENT = restifyClients.createJsonClient({
                url: 'http://127.0.0.1:' + PORT,
                retry: false
            });

            SERVER.post('/compressed', function(req, res, next) {
                assert.equal(req.body.apple, 'red');
                res.send();
                next();
            });

            CLIENT.post(
                '/compressed',
                {
                    apple: 'red'
                },
                function(err, _, res) {
                    assert.ifError(err);
                    assert.equal(res.statusCode, 200);
                    done();
                }
            );
        });

        it('should handle client timeout', function(done) {
            SERVER.use(restify.plugins.bodyParser());

            SERVER.post('/compressed', function(req, res, next) {
                res.send('ok');
                next();
            });

            // set timeout to 100ms so test runs faster, when client stops
            // sending POST data
            SERVER.on('connection', function(socket) {
                socket.setTimeout(100);
            });

            var postData = 'hello world';

            var options = {
                hostname: '127.0.0.1',
                port: PORT,
                path: '/compressed?v=1',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // report postData + 1 so that request isn't sent
                    'Content-Length': Buffer.byteLength(postData) + 1
                }
            };

            var req = http.request(options, function(res) {
                // should never receive a response
                assert.isNotOk(res);
            });

            SERVER.on('after', function(req2) {
                if (req2.href() === '/compressed?v=2') {
                    assert.equal(SERVER.inflightRequests(), 0);
                    done();
                }
            });

            // will get a req error after 100ms timeout
            req.on('error', function(e) {
                // make another request to verify in flight request is only 1
                CLIENT = restifyClients.createJsonClient({
                    url: 'http://127.0.0.1:' + PORT,
                    retry: false
                });

                CLIENT.post(
                    '/compressed?v=2',
                    {
                        apple: 'red'
                    },
                    function(err, _, res, obj) {
                        assert.ifError(err);
                        assert.equal(res.statusCode, 200);
                    }
                );
            });

            // write data to request body, but don't req.send()
            req.write(postData);
        });
    });
});
