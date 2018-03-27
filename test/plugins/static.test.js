'use strict';
/* eslint-disable func-names */

// core requires
var fs = require('fs');
var path = require('path');
var net = require('net');

// external requires
var assert = require('chai').assert;
var mkdirp = require('mkdirp');
var restify = require('../../lib/index.js');
var restifyClients = require('restify-clients');
var rimraf = require('rimraf');

// local files
var helper = require('../lib/helper');

// local globals
var SERVER;
var CLIENT;
var PORT;
var FILES_TO_DELETE = [];
var DIRS_TO_DELETE = [];

describe('static resource plugin', function() {
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
        var i;

        for (i = 0; i < FILES_TO_DELETE.length; ++i) {
            try {
                fs.unlinkSync(FILES_TO_DELETE[i]);
            } catch (err) {
                /* normal */
            }
        }

        for (i = 0; i < DIRS_TO_DELETE.length; ++i) {
            try {
                rimraf.sync(DIRS_TO_DELETE[i]);
            } catch (err) {
                /* normal */
            }
        }

        CLIENT.close();
        SERVER.close(done);
    });

    function serveStaticTest(done, testDefault, tmpDir, regex, staticFile) {
        var staticContent = '{"content": "abcdefg"}';
        var staticObj = JSON.parse(staticContent);
        var testDir = 'public';
        var testFileName = 'index.json';
        var routeName = 'GET wildcard';
        var tmpPath = path.join(__dirname, '../', tmpDir);

        mkdirp(tmpPath, function(err) {
            assert.ifError(err);
            DIRS_TO_DELETE.push(tmpPath);
            var folderPath = path.join(tmpPath, testDir);

            mkdirp(folderPath, function(err2) {
                assert.ifError(err2);

                DIRS_TO_DELETE.push(folderPath);
                var file = path.join(folderPath, testFileName);

                fs.writeFile(file, staticContent, function(err3) {
                    assert.ifError(err3);
                    FILES_TO_DELETE.push(file);
                    var p = '/' + testDir + '/' + testFileName;
                    var opts = { directory: tmpPath };

                    if (staticFile) {
                        opts.file = p;
                    }

                    if (testDefault) {
                        p = '/' + testDir + '/';
                        opts.default = testFileName;
                        routeName += ' with default';
                    }

                    SERVER.get(
                        {
                            path: '/' + testDir + '/*',
                            name: routeName
                        },
                        restify.plugins.serveStatic(opts)
                    );

                    CLIENT.get(p, function(err4, req, res, obj) {
                        assert.ifError(err4);
                        assert.equal(
                            res.headers['cache-control'],
                            'public, max-age=3600'
                        );
                        assert.deepEqual(obj, staticObj);
                        done();
                    });
                });
            });
        });
    }

    function testNoAppendPath(done, testDefault, tmpDir, regex, staticFile) {
        var staticContent = '{"content": "abcdefg"}';
        var staticObj = JSON.parse(staticContent);
        var testDir = 'public';
        var testFileName = 'index.json';
        var routeName = 'GET wildcard';
        var tmpPath = path.join(__dirname, '../', tmpDir);

        mkdirp(tmpPath, function(err) {
            assert.ifError(err);
            DIRS_TO_DELETE.push(tmpPath);
            var folderPath = path.join(tmpPath, testDir);

            mkdirp(folderPath, function(err2) {
                assert.ifError(err2);

                DIRS_TO_DELETE.push(folderPath);
                var file = path.join(folderPath, testFileName);

                fs.writeFile(file, staticContent, function(err3) {
                    assert.ifError(err3);
                    FILES_TO_DELETE.push(file);
                    var p = '/' + testDir + '/' + testFileName;
                    var opts = { directory: folderPath };
                    opts.appendRequestPath = false;

                    if (staticFile) {
                        opts.file = testFileName;
                    }

                    if (testDefault) {
                        p = '/' + testDir + '/';
                        opts.default = testFileName;
                        routeName += ' with default';
                    }

                    SERVER.get(
                        {
                            path: '/' + testDir + '/*',
                            name: routeName
                        },
                        restify.plugins.serveStatic(opts)
                    );

                    CLIENT.get(p, function(err4, req, res, obj) {
                        assert.ifError(err4);
                        assert.equal(
                            res.headers['cache-control'],
                            'public, max-age=3600'
                        );
                        assert.deepEqual(obj, staticObj);
                        done();
                    });
                });
            });
        });
    }

    it('static serves static files', function(done) {
        serveStaticTest(done, false, '.tmp');
    });

    it('static serves static files in nested folders', function(done) {
        serveStaticTest(done, false, '.tmp/folder');
    });

    it('static serves static files in with a root regex', function(done) {
        serveStaticTest(done, false, '.tmp', '/.*');
    });

    // eslint-disable-next-line
    it('static serves static files with a root, !greedy, regex', function(done) {
        serveStaticTest(done, false, '.tmp', '/?.*');
    });

    it('static serves default file', function(done) {
        serveStaticTest(done, true, '.tmp');
    });

    // eslint-disable-next-line
    it('restify-GH-379 static serves file with parentheses in path', function(done) {
        serveStaticTest(done, false, '.(tmp)');
    });

    it('restify-GH-719 serve a specific static file', function(done) {
        // serve the same default file .tmp/public/index.json
        // but get it from opts.file
        serveStaticTest(done, false, '.tmp', null, true);
    });

    // eslint-disable-next-line
    it('static serves static file with appendRequestPath = false', function(done) {
        testNoAppendPath(done, false, '.tmp');
    });

    // eslint-disable-next-line
    it('static serves default file with appendRequestPath = false', function(done) {
        testNoAppendPath(done, true, '.tmp');
    });

    // eslint-disable-next-line
    it('restify serve a specific static file with appendRequestPath = false', function(done) {
        testNoAppendPath(done, false, '.tmp', null, true);
    });

    it('static responds 404 for missing file', function(done) {
        var p = '/public/no-such-file.json';
        var tmpPath = path.join(process.cwd(), '.tmp');

        SERVER.get(
            '/public/.*',
            restify.plugins.serveStatic({ directory: tmpPath })
        );

        CLIENT.get(p, function(err, req, res, obj) {
            assert.ok(err);
            assert.strictEqual(err.statusCode, 404);
            assert.strictEqual(err.restCode, 'ResourceNotFound');
            done();
        });
    });

    // eslint-disable-next-line
    it('GH-1382 static responds 404 for missing file with percent-codes', function(done) {
        var p = '/public/no-%22such-file.json';
        var tmpPath = path.join(process.cwd(), '.tmp');

        SERVER.get(
            '/public/.*',
            restify.plugins.serveStatic({ directory: tmpPath })
        );

        CLIENT.get(p, function(err, req, res, obj) {
            assert.ok(err);
            assert.equal(err.statusCode, 404);
            assert.equal(err.restCode, 'ResourceNotFound');
            done();
        });
    });

    // To ensure this will always get properly restored (even in case of a test
    // failure) we do it here.
    var originalCreateReadStream = fs.createReadStream;
    afterEach(function() {
        fs.createReadStream = originalCreateReadStream;
    });

    var TMP_PATH = path.join(__dirname, '../', '.tmp');
    var RAW_REQUEST =
        'GET /index.html HTTP/1.1\r\n' +
        'Host: 127.0.0.1:' +
        PORT +
        '\r\n' +
        'User-Agent: curl/7.48.0\r\n' +
        'Accept: */*\r\n' +
        '\r\n';

    it(
        'static does not leak the file stream and next() is properly called ' +
            'when the client disconnects before receiving a reply',
        function(done) {
            var streamWasAlreadyCreated = false;
            var streamWasClosed = false;
            var socket = new net.Socket();

            fs.createReadStream = function() {
                // Just in case the code would open more streams in the future.
                assert.strictEqual(streamWasAlreadyCreated, false);
                streamWasAlreadyCreated = true;

                var stream = originalCreateReadStream.apply(this, arguments);
                stream.once('close', function() {
                    streamWasClosed = true;
                });

                socket.end();
                return stream;
            };

            mkdirp(TMP_PATH, function(err) {
                assert.ifError(err);
                DIRS_TO_DELETE.push(TMP_PATH);
                fs.writeFileSync(
                    path.join(TMP_PATH, 'index.html'),
                    'Hello world!'
                );

                var serve = restify.plugins.serveStatic({
                    directory: TMP_PATH
                });

                SERVER.get('/index.html', function(req, res, next) {
                    serve(req, res, function(nextRoute) {
                        assert.strictEqual(streamWasClosed, true);
                        assert.strictEqual(nextRoute, false);
                        done();
                    });
                });

                socket.connect({ host: '127.0.0.1', port: PORT }, function() {
                    socket.write(RAW_REQUEST, 'utf-8', function(err2, data) {
                        assert.ifError(err2);
                    });
                });
            });
        }
    );

    it(
        'static does not open a file stream and next() is properly called ' +
            'when the client disconnects immediately after sending a request',
        function(done) {
            fs.createReadStream = function() {
                assert(false);
            };

            mkdirp(TMP_PATH, function(err) {
                assert.ifError(err);
                DIRS_TO_DELETE.push(TMP_PATH);
                fs.writeFileSync(
                    path.join(TMP_PATH, 'index.html'),
                    'Hello world!'
                );

                var serve = restify.plugins.serveStatic({
                    directory: TMP_PATH
                });

                SERVER.get('/index.html', function(req, res, next) {
                    // closed before serve
                    serve(req, res, function(nextRoute) {
                        assert.strictEqual(nextRoute, false);
                        done();
                    });
                });
                SERVER.on('after', function(req, res, route, afterErr) {
                    assert(afterErr.name, 'RequestCloseError');
                    done();
                });

                var socket = new net.Socket();
                socket.connect({ host: '127.0.0.1', port: PORT }, function() {
                    socket.write(RAW_REQUEST, 'utf-8', function(err2, data) {
                        assert.ifError(err2);
                        socket.end();
                    });
                });
            });
        }
    );

    it('static responds 404 for missing file', function(done) {
        var p = '/public/no-such-file.json';
        var tmpPath = path.join(process.cwd(), '.tmp');

        SERVER.get(
            '/public/.*',
            restify.plugins.serveStatic({ directory: tmpPath })
        );

        CLIENT.get(p, function(err, req, res, obj) {
            assert.ok(err);
            assert.equal(err.statusCode, 404);
            assert.equal(err.restCode, 'ResourceNotFound');
            return done();
        });
    });

    // eslint-disable-next-line
    it('GH-1382 static responds 404 for missing file with percent-codes', function(done) {
        var p = '/public/no-%22such-file.json';
        var tmpPath = path.join(process.cwd(), '.tmp');

        SERVER.get(
            '/public/.*',
            restify.plugins.serveStatic({ directory: tmpPath })
        );

        CLIENT.get(p, function(err, req, res, obj) {
            assert.ok(err);
            assert.equal(err.statusCode, 404);
            assert.equal(err.restCode, 'ResourceNotFound');
            return done();
        });
    });
});
