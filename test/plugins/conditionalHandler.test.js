'use strict';
/* eslint-disable func-names */

var assert = require('chai').assert;
var restify = require('../../lib/index.js');
var restifyClients = require('restify-clients');
var parallel = require('vasync').parallel;

// local files
var helper = require('../lib/helper');

// local globals
var SERVER;
var CLIENT;
var PORT;

function handlerFactory(response, version) {
    return function handler(req, res, next) {
        res.send(response);
        if (version) {
            assert.equal(req.matchedVersion(), version);
        }
        next();
    };
}

describe('conditional request', function() {
    describe('version', function() {
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

        it('should find handler by string version', function(done) {
            SERVER.get(
                '/',
                restify.plugins.conditionalHandler([
                    {
                        handler: handlerFactory('v1.1.0', 'v1.1.0'),
                        version: 'v1.1.0'
                    },
                    {
                        handler: handlerFactory('v1.2.0', 'v1.2.0'),
                        version: 'v1.2.0'
                    }
                ])
            );

            parallel(
                {
                    funcs: [
                        function v1(callback) {
                            var opts = {
                                path: '/',
                                headers: {
                                    'accept-version': '1.1.0'
                                }
                            };
                            CLIENT.get(opts, function(err, _, res, response) {
                                assert.ifError(err);
                                assert.equal(res.statusCode, 200);
                                assert.equal(response, 'v1.1.0');
                                callback();
                            });
                        },
                        function v2(callback) {
                            var opts = {
                                path: '/',
                                headers: {
                                    'accept-version': '1.2.0'
                                }
                            };
                            CLIENT.get(opts, function(err, _, res, response) {
                                assert.ifError(err);
                                assert.equal(res.statusCode, 200);
                                assert.equal(
                                    res.headers['api-version'],
                                    'v1.2.0'
                                );
                                assert.equal(response, 'v1.2.0');
                                callback();
                            });
                        }
                    ]
                },
                function parallelDone(err) {
                    assert.ifError(err);
                    done();
                }
            );
        });

        it('should find handler by array of versions', function(done) {
            SERVER.get(
                '/',
                restify.plugins.conditionalHandler([
                    {
                        handler: handlerFactory('v1.x, v2.x'),
                        version: ['v1.1.0', 'v2.0.0']
                    },
                    {
                        handler: handlerFactory('v3.x'),
                        version: 'v3.0.0'
                    }
                ])
            );

            parallel(
                {
                    funcs: [
                        function v1(callback) {
                            var opts = {
                                path: '/',
                                headers: {
                                    'accept-version': '2.x'
                                }
                            };
                            CLIENT.get(opts, function(err, _, res, response) {
                                assert.ifError(err);
                                assert.equal(res.statusCode, 200);
                                assert.equal(response, 'v1.x, v2.x');
                                callback();
                            });
                        },
                        function v2(callback) {
                            var opts = {
                                path: '/',
                                headers: {
                                    'accept-version': '3.x'
                                }
                            };
                            CLIENT.get(opts, function(err, _, res, response) {
                                assert.ifError(err);
                                assert.equal(res.statusCode, 200);
                                assert.equal(response, 'v3.x');
                                callback();
                            });
                        }
                    ]
                },
                function parallelDone(err) {
                    assert.ifError(err);
                    done();
                }
            );
        });

        it('should find handler with 1.x', function(done) {
            SERVER.get(
                '/',
                restify.plugins.conditionalHandler([
                    {
                        handler: handlerFactory('v1.1.0'),
                        version: 'v1.1.0'
                    },
                    {
                        handler: handlerFactory('v1.2.0'),
                        version: 'v1.2.0'
                    }
                ])
            );

            var opts = {
                path: '/',
                headers: {
                    'accept-version': '1.x'
                }
            };
            CLIENT.get(opts, function(err, _, res, response) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.equal(response, 'v1.2.0');
                done();
            });
        });

        it('should find handler with ~1.1.0', function(done) {
            SERVER.get(
                '/',
                restify.plugins.conditionalHandler([
                    {
                        handler: handlerFactory('v1.1.1'),
                        version: 'v1.1.1'
                    },
                    {
                        handler: handlerFactory('v1.2.0'),
                        version: 'v1.2.0'
                    }
                ])
            );

            var opts = {
                path: '/',
                headers: {
                    'accept-version': '~1.1.0'
                }
            };
            CLIENT.get(opts, function(err, _, res, response) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.equal(response, 'v1.1.1');
                done();
            });
        });

        it('should find handler with ^1.1.0', function(done) {
            SERVER.get(
                '/',
                restify.plugins.conditionalHandler([
                    {
                        handler: handlerFactory('v1.1.1'),
                        version: 'v1.1.1'
                    },
                    {
                        handler: handlerFactory('v1.2.0'),
                        version: 'v1.2.0'
                    }
                ])
            );

            var opts = {
                path: '/',
                headers: {
                    'accept-version': '^1.1.0'
                }
            };
            CLIENT.get(opts, function(err, _, res, response) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.equal(response, 'v1.2.0');
                done();
            });
        });

        it('should find largest version with missing header', function(done) {
            SERVER.get(
                '/',
                restify.plugins.conditionalHandler([
                    {
                        handler: handlerFactory('v1.1.0'),
                        version: 'v1.1.0'
                    },
                    {
                        handler: handlerFactory('v1.2.0'),
                        version: 'v1.2.0'
                    }
                ])
            );

            var opts = {
                path: '/',
                headers: {}
            };
            CLIENT.get(opts, function(err, _, res, response) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.equal(response, 'v1.2.0');
                done();
            });
        });

        it('should throw invalid version error', function(done) {
            SERVER.get(
                '/',
                restify.plugins.conditionalHandler([
                    {
                        handler: handlerFactory('v1.1.0'),
                        version: 'v1.1.0'
                    },
                    {
                        handler: handlerFactory('v1.2.0'),
                        version: 'v1.2.0'
                    }
                ])
            );

            var opts = {
                path: '/',
                headers: {
                    'accept-version': '1.3.0'
                }
            };
            CLIENT.get(opts, function(err, _, res, response) {
                assert.equal(err.name, 'InvalidVersionError');
                assert.equal(err.message, '1.3.0 is not supported by GET /');
                assert.equal(res.statusCode, 400);
                done();
            });
        });
    });

    describe('content type', function() {
        beforeEach(function(done) {
            SERVER = restify.createServer({
                dtrace: helper.dtrace,
                log: helper.getLog('server')
            });

            SERVER.listen(0, '127.0.0.1', function() {
                PORT = SERVER.address().port;
                CLIENT = restifyClients.createStringClient({
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

        it('should find handler by content type by string', function(done) {
            SERVER.get(
                '/',
                restify.plugins.conditionalHandler([
                    {
                        handler: handlerFactory('application/json'),
                        contentType: 'application/json'
                    },
                    {
                        handler: handlerFactory('text/plain'),
                        contentType: 'text/plain'
                    }
                ])
            );

            parallel(
                {
                    funcs: [
                        function v1(callback) {
                            var opts = {
                                path: '/',
                                headers: {
                                    accept: 'application/json'
                                }
                            };
                            CLIENT.get(opts, function(err, _, res, response) {
                                assert.ifError(err);
                                assert.equal(res.statusCode, 200);
                                assert.equal(response, '"application/json"');
                                callback();
                            });
                        },
                        function v2(callback) {
                            var opts = {
                                path: '/',
                                headers: {
                                    accept: 'text/plain'
                                }
                            };
                            CLIENT.get(opts, function(err, _, res, response) {
                                assert.ifError(err);
                                assert.equal(res.statusCode, 200);
                                assert.equal(response, 'text/plain');
                                callback();
                            });
                        }
                    ]
                },
                function parallelDone(err) {
                    assert.ifError(err);
                    done();
                }
            );
        });

        it('should find handler by array of content types', function(done) {
            SERVER.get(
                '/',
                restify.plugins.conditionalHandler([
                    {
                        handler: handlerFactory('application/*'),
                        contentType: [
                            'application/json',
                            'application/javascript'
                        ]
                    },
                    {
                        handler: handlerFactory('text/plain'),
                        contentType: 'text/plain'
                    }
                ])
            );

            var opts = {
                path: '/',
                headers: {
                    accept: 'application/javascript'
                }
            };
            CLIENT.get(opts, function(err, _, res, response) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.equal(response, '"application/*"');
                done();
            });
        });

        it('should find handler with multiple accept', function(done) {
            SERVER.get(
                '/',
                restify.plugins.conditionalHandler([
                    {
                        handler: handlerFactory('application/*'),
                        contentType: 'application/json'
                    },
                    {
                        handler: handlerFactory('text/plain'),
                        contentType: 'text/plain'
                    }
                ])
            );

            var opts = {
                path: '/',
                headers: {
                    accept: 'text/html,text/plain'
                }
            };
            CLIENT.get(opts, function(err, _, res, response) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.equal(response, 'text/plain');
                done();
            });
        });

        it('should find handler with application/*', function(done) {
            SERVER.get(
                '/',
                restify.plugins.conditionalHandler([
                    {
                        handler: handlerFactory('application/*'),
                        contentType: 'application/json'
                    },
                    {
                        handler: handlerFactory('text/plain'),
                        contentType: 'text/plain'
                    }
                ])
            );

            var opts = {
                path: '/',
                headers: {
                    accept: 'application/json'
                }
            };
            CLIENT.get(opts, function(err, _, res, response) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.equal(response, '"application/*"');
                done();
            });
        });

        it('should find handler with content type and version', function(done) {
            SERVER.get(
                '/',
                restify.plugins.conditionalHandler([
                    {
                        handler: handlerFactory('application/json, 1.1.0'),
                        contentType: 'application/json',
                        version: '1.1.0'
                    },
                    {
                        handler: handlerFactory('application/json, 1.2.0'),
                        contentType: 'application/json',
                        version: '1.2.0'
                    },
                    {
                        handler: handlerFactory('text/plain'),
                        contentType: 'text/plain'
                    }
                ])
            );

            var opts = {
                path: '/',
                headers: {
                    accept: 'application/json',
                    'accept-version': '1.2.0'
                }
            };
            CLIENT.get(opts, function(err, _, res, response) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.equal(response, '"application/json, 1.2.0"');
                done();
            });
        });

        it('should throw invalid media type error', function(done) {
            SERVER.get(
                '/',
                restify.plugins.conditionalHandler([
                    {
                        handler: handlerFactory('application/json'),
                        contentType: 'application/json'
                    },
                    {
                        handler: handlerFactory('text/plain'),
                        contentType: 'text/plain'
                    }
                ])
            );

            var opts = {
                path: '/',
                headers: {
                    accept: 'text/html'
                }
            };
            CLIENT.get(opts, function(err, _, res, response) {
                assert.equal(err.name, 'UnsupportedMediaTypeError');
                assert.equal(
                    err.message,
                    '{"code":"UnsupportedMediaType","message":"text/html"}'
                );
                assert.equal(res.statusCode, 415);
                done();
            });
        });
    });

    describe('multiple handlers', function() {
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

        it('should run each of the handlers', function(done) {
            var counter = 0;

            SERVER.get(
                '/',
                restify.plugins.conditionalHandler([
                    {
                        handler: [
                            function handler1(req, res, next) {
                                counter += 1;
                                next();
                            },
                            function handler2(req, res, next) {
                                counter += 1;
                                next();
                            },
                            function handler3(req, res, next) {
                                counter += 1;
                                res.send('v1.2.0');
                            }
                        ],
                        version: 'v1.2.0'
                    }
                ])
            );

            var opts = {
                path: '/',
                headers: {
                    'accept-version': '1.2.0'
                }
            };
            CLIENT.get(opts, function(err, _, res, response) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.equal(counter, 3, 'calls all of the handlers');
                assert.equal(response, 'v1.2.0');
                done();
            });
        });
    });
});
