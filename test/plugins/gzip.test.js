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

describe('gzip parser', function() {
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

    it('should gzip response', function(done) {
        SERVER.use(restify.plugins.gzipResponse());

        SERVER.get('/gzip/:id', function(req, res, next) {
            res.send({
                hello: 'world'
            });
            next();
        });

        var opts = {
            path: '/gzip/foo',
            headers: {
                'Accept-Encoding': 'gzip'
            }
        };
        CLIENT.get(opts, function(err, _, res, obj) {
            assert.ifError(err);
            assert.deepEqual({ hello: 'world' }, obj);
            done();
        });
    });

    it('gzip large response', function(done) {
        var testResponseSize = 65536 * 3;
        var TestStream = function() {
            this.readable = true;
            this.sentSize = 0;
            this.totalSize = testResponseSize;
            this.interval = null;
        };
        require('util').inherits(TestStream, require('stream'));
        TestStream.prototype.resume = function() {
            var self = this;

            if (!this.interval) {
                this.interval = setInterval(function() {
                    var chunkSize = Math.min(
                        self.totalSize - self.sentSize,
                        65536
                    );

                    if (chunkSize > 0) {
                        var chunk = new Array(chunkSize + 1);
                        chunk = chunk.join('a');
                        self.emit('data', chunk);
                        self.sentSize += chunkSize;
                    } else {
                        self.emit('data', '"}');
                        self.emit('end');
                        self.pause();
                    }
                }, 1);
            }
        };

        TestStream.prototype.pause = function() {
            clearInterval(this.interval);
            this.interval = null;
        };

        var bodyStream = new TestStream();

        SERVER.use(restify.plugins.gzipResponse());
        SERVER.get('/gzip/:id', function(req, res, next) {
            bodyStream.resume();
            res.write('{"foo":"');
            bodyStream.pipe(res);
            next();
        });

        var opts = {
            path: '/gzip/foo',
            headers: {
                'Accept-Encoding': 'gzip'
            }
        };
        CLIENT.get(opts, function(err, _, res, obj) {
            assert.ifError(err);
            var expectedResponse = {
                foo: new Array(testResponseSize + 1).join('a')
            };
            assert.deepEqual(expectedResponse, obj);
            done();
        });
    });

    it('gzip body json ok', function(done) {
        SERVER.use(restify.plugins.gzipResponse());
        SERVER.use(
            restify.plugins.queryParser({
                mapParams: true
            })
        );
        SERVER.use(
            restify.plugins.bodyParser({
                mapParams: true
            })
        );
        SERVER.post('/body/:id', function(req, res, next) {
            assert.equal(req.params.id, 'foo');
            assert.equal(req.params.name, 'markc');
            assert.equal(req.params.phone, '(206) 555-1212');
            res.send();
            next();
        });

        var obj = {
            phone: '(206) 555-1212',
            name: 'somethingelse'
        };
        CLIENT.gzip = {};
        CLIENT.post('/body/foo?name=markc', obj, function(err, _, res) {
            assert.ifError(err);
            assert.ok(res);

            if (res) {
                assert.equal(res.statusCode, 200);
            }
            done();
        });
    });
});
