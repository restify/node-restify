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

    describe('gzip content encoding', function() {
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

    it('should not add a listener for each call on same socket', done => {
        SERVER.use(restify.plugins.bodyParser());

        let serverReq, serverRes, serverReqSocket;
        SERVER.post('/meals', function(req, res, next) {
            serverReq = req;
            serverRes = res;
            serverReqSocket = req.socket;
            res.send();
            next();
        });

        CLIENT = restifyClients.createJsonClient({
            url: 'http://127.0.0.1:' + PORT,
            retry: false,
            agent: new http.Agent({ keepAlive: true })
        });

        CLIENT.post('/meals', { breakfast: 'pancakes' }, (err, _, res) => {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);

            const firstReqSocket = serverReqSocket;
            const numReqListeners = listenerCount(serverReq);
            const numResListeners = listenerCount(serverRes);
            const numReqSocketListeners = listenerCount(serverReq.socket);

            // Without setImmediate, the second request will not reuse the socket.
            setImmediate(() => {
                CLIENT.post('/meals', { lunch: 'salad' }, (err2, __, res2) => {
                    assert.ifError(err2);
                    assert.equal(res2.statusCode, 200);
                    assert.equal(
                        serverReqSocket,
                        firstReqSocket,
                        'This test should issue two requests that share the ' +
                            'same socket.'
                    );
                    // The number of listeners on each emitter should not have
                    // increased since the first request.
                    assert.equal(listenerCount(serverReq), numReqListeners);
                    assert.equal(listenerCount(serverRes), numResListeners);
                    assert.equal(
                        listenerCount(serverReq.socket),
                        numReqSocketListeners
                    );
                    done();
                });
            });
        });
    });

    it('should call next for each successful request on same socket', done => {
        let nextCallCount = 0;
        SERVER.use(restify.plugins.bodyParser());
        SERVER.use((req, res, next) => {
            nextCallCount += 1;
            next();
        });

        let serverReqSocket;
        SERVER.post('/meals', function(req, res, next) {
            res.send();
            next();
        });

        CLIENT = restifyClients.createJsonClient({
            url: 'http://127.0.0.1:' + PORT,
            retry: false,
            agent: new http.Agent({ keepAlive: true })
        });

        CLIENT.post('/meals', { breakfast: 'waffles' }, (err, _, res) => {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            const firstReqSocket = serverReqSocket;
            assert.equal(nextCallCount, 1);

            // Without setImmediate, the second request will not reuse the socket.
            setImmediate(() => {
                CLIENT.post('/meals', { lunch: 'candy' }, (err2, __, res2) => {
                    assert.ifError(err2);
                    assert.equal(res2.statusCode, 200);
                    assert.equal(
                        serverReqSocket,
                        firstReqSocket,
                        'This test should issue two requests that share the ' +
                            'same socket.'
                    );
                    assert.equal(nextCallCount, 2);
                    done();
                });
            });
        });
    });
});

/**
 * @param {EventEmitter} emitter - An emitter
 * @returns {number} - The total number of listeners across all events
 */
function listenerCount(emitter) {
    let numListeners = 0;
    for (const eventName of emitter.eventNames()) {
        numListeners += emitter.listenerCount(eventName);
    }
    return numListeners;
}
