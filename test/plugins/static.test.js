'use strict';
/* eslint-disable func-names */

// core requires
var fs = require('fs');
var net = require('net');
var os = require('os');
var path = require('path');

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

    function getTmpDir(tmpDir) {
        return path.normalize(
            path.join(__dirname, '../', tmpDir ? tmpDir : '.tmp')
        );
    }

    function serveStaticTest(
        done,
        testDefault,
        tmpDir,
        docRoot,
        testDir,
        match,
        staticFile,
        isAppendPath,
        assertStatusCode
    ) {
        var staticContent = '{"content": "abcdefg"}';
        var staticObj = JSON.parse(staticContent);
        var tmpDirMv = getTmpDir(tmpDir);
        if (!docRoot) {
            docRoot = tmpDirMv;
        } else {
            docRoot = path.normalize(path.join(__dirname, '../', docRoot));
        }
        var testDirMod = testDir;
        if (!testDirMod && testDirMod !== '') {
            testDirMod = 'public/';
        } else if (testDirMod && !testDirMod.endsWith('/')) {
            testDirMod += '/';
        }
        var testFileName = 'index.json';
        var routeName = 'GET wildcard';

        mkdirp(tmpDirMv, function(err) {
            assert.ifError(err);
            DIRS_TO_DELETE.push(tmpDirMv);
            var folderPath = path.join(tmpDirMv, testDirMod);

            mkdirp(folderPath, function(err2) {
                assert.ifError(err2);

                DIRS_TO_DELETE.push(folderPath);
                var file = path.join(folderPath, testFileName);

                fs.writeFile(file, staticContent, function(err3) {
                    assert.ifError(err3);
                    FILES_TO_DELETE.push(file);
                    var p = '/' + testDirMod + testFileName;
                    var opts = { directory: docRoot };

                    if (isAppendPath === false) {
                        opts.appendRequestPath = false;
                    }

                    if (match) {
                        opts.match = new RegExp('^' + match + '$');
                    }

                    if (staticFile) {
                        opts.file =
                            typeof staticFile === 'string' ? staticFile : p;
                    }

                    if (testDefault) {
                        p = '/public/';
                        opts.default = testFileName;
                        routeName += ' with default';
                    }

                    SERVER.get(
                        {
                            path: '/public/*',
                            name: routeName
                        },
                        restify.plugins.serveStatic(opts)
                    );

                    CLIENT.get(p, function(err4, req, res, obj) {
                        if (assertStatusCode) {
                            assert.strictEqual(
                                res.statusCode,
                                assertStatusCode
                            );
                        } else {
                            assert.ifError(err4);
                            assert.equal(
                                res.headers['cache-control'],
                                'public, max-age=3600'
                            );
                            assert.deepEqual(obj, staticObj);
                        }
                        done();
                    });
                });
            });
        });
    }

    function testNoAppendPath(
        done,
        testDefault,
        tmpDir,
        docRoot,
        testDir,
        match,
        staticFile
    ) {
        serveStaticTest(
            done,
            testDefault,
            tmpDir,
            docRoot,
            testDir,
            match,
            staticFile,
            false
        );
    }

    it('static serves static files', function(done) {
        serveStaticTest(done, false, '.tmp');
    });

    it('static serves static files in nested folders', function(done) {
        serveStaticTest(done, false, '.tmp/folder');
    });

    it('static serves static files in with a root regex', function(done) {
        serveStaticTest(done, false, '.tmp', null, null, '/.*');
    });

    // eslint-disable-next-line
    it('static serves static files with a root, !greedy, regex', function(done) {
        serveStaticTest(done, false, '.tmp', null, null, '/?.*');
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
        serveStaticTest(done, false, '.tmp', null, null, null, true);
    });

    // eslint-disable-next-line
    it('static serves static file with appendRequestPath = false', function(done) {
        testNoAppendPath(done, false, '.tmp', '.tmp/public');
    });

    // eslint-disable-next-line
    it('static serves default file with appendRequestPath = false', function(done) {
        testNoAppendPath(done, true, '.tmp', '.tmp/public');
    });

    // eslint-disable-next-line
    it('restify serve a specific static file with appendRequestPath = false', function(done) {
        testNoAppendPath(done, false, '.tmp', null, null, null, true);
    });

    it('static responds 404 for missing file', function(done) {
        var p = '/no-such-file.json';
        var tmpDir = getTmpDir();

        SERVER.get(
            '/(.*)',
            restify.plugins.serveStatic({
                directory: path.join(tmpDir, 'public')
            })
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
        var p = '/no-%22such-file.json';
        var tmpDir = getTmpDir();

        SERVER.get(
            '/.*',
            restify.plugins.serveStatic({
                directory: path.join(tmpDir, 'public')
            })
        );

        CLIENT.get(p, function(err, req, res, obj) {
            assert.ok(err);
            assert.equal(err.statusCode, 404);
            assert.equal(err.restCode, 'ResourceNotFound');
            done();
        });
    });

    // with append path
    it('GH-1910/1 respond 403 for path traversal', function(done) {
        var tmpDir = '.tmp';

        var traversalFile = path.join(getTmpDir(tmpDir), 'forbidden.json');
        var traversalPath = '/public/../../forbidden.json';

        function cb() {
            fs.writeFileSync(traversalFile, '{}');
            FILES_TO_DELETE.push(traversalFile);

            CLIENT.get(traversalPath, function(err, req, res, obj) {
                assert.ok(err, 'need to be an error');
                assert.equal(err.statusCode, 403);
                done();
            });
        }

        serveStaticTest(
            cb,
            false,
            tmpDir,
            tmpDir + '/public',
            null,
            null,
            null,
            true,
            404
        );
    });

    // no append path
    it('GH-1910/2 respond 404 for ignored path traversal', function(done) {
        var tmpDir = '.tmp';

        var traversalFile = path.join(getTmpDir(tmpDir), 'forbidden.json');
        var traversalPath = '/public/../../forbidden.json';

        function cb() {
            fs.writeFileSync(traversalFile, '{}');
            FILES_TO_DELETE.push(traversalFile);

            CLIENT.get(traversalPath, function(err, req, res, obj) {
                assert.ok(err, 'need to be an error');
                assert.equal(err.statusCode, 404);
                done();
            });
        }

        serveStaticTest(
            cb,
            false,
            tmpDir,
            tmpDir + '/public',
            null,
            null,
            null,
            false,
            200
        );
    });

    // check static file config
    it('GH-1910/3 respond 403 for misconfig path traversal', function(done) {
        var tmpDir = '.tmp';

        var traversalFile = path.join(getTmpDir(tmpDir), 'forbidden.json');
        var traversalPath = '/public/../../forbidden.json';

        function cb() {
            fs.writeFileSync(traversalFile, '{}');
            FILES_TO_DELETE.push(traversalFile);

            CLIENT.get('/public/', function(err, req, res, obj) {
                assert.ok(err, 'need to be an error');
                assert.equal(err.statusCode, 403);
                done();
            });
        }

        serveStaticTest(
            cb,
            false,
            tmpDir,
            tmpDir + '/public',
            null,
            null,
            traversalPath,
            true,
            403
        );
    });

    // url encoded slashes
    it('GH-1910/4 respond 403 for path traversal %2F', function(done) {
        var tmpDir = '.tmp';

        var traversalFile = path.join(getTmpDir(tmpDir), 'forbidden.json');
        var traversalPath = '/public/..%2F..%2Fforbidden.json';

        function cb() {
            fs.writeFileSync(traversalFile, '{}');
            FILES_TO_DELETE.push(traversalFile);

            CLIENT.get(traversalPath, function(err, req, res, obj) {
                assert.ok(err, 'need to be an error');
                assert.equal(err.statusCode, 403);
                done();
            });
        }

        serveStaticTest(
            cb,
            false,
            tmpDir,
            tmpDir + '/public',
            null,
            null,
            null,
            true,
            404
        );
    });

    // traverse completely above domain root for reaching root and sys-tmp
    it('GH-1910/5 respond 403 for extreme path traversal', function(done) {
        var tmpDir = '.tmp';
        var pathLevel = '';
        var testDir = path.join(getTmpDir(tmpDir), 'public');

        for (
            var i = 0, slast = testDir.lastIndexOf(path.sep) + 1;
            i >= 0 && i < slast;

        ) {
            i = testDir.indexOf(path.sep, i) + 1;
            if (i > 0) {
                pathLevel += '../';
            }
        }

        var traversalTmp = fs.mkdtempSync(
            path.join(os.tmpdir(), 'static-test-')
        );
        DIRS_TO_DELETE.push(traversalTmp);

        var traversalFile = path.join(traversalTmp, 'index.json');
        fs.writeFileSync(traversalFile, '{}');
        FILES_TO_DELETE.push(traversalFile);

        var traversalPath =
            '/public/../' +
            pathLevel.substring(0, pathLevel.length - 1) +
            traversalFile;
        traversalPath = traversalPath.replaceAll('\\', '/');

        function cb() {
            CLIENT.get(traversalPath, function(err, req, res, obj) {
                assert.ok(err, 'need to be an error');
                assert.equal(err.statusCode, 403);
                done();
            });
        }

        serveStaticTest(
            cb,
            false,
            tmpDir,
            tmpDir + '/public',
            null,
            null,
            null,
            true,
            404
        );
    });

    // To ensure this will always get properly restored (even in case of a test
    // failure) we do it here.
    var originalCreateReadStream = fs.createReadStream;
    afterEach(function() {
        fs.createReadStream = originalCreateReadStream;
    });

    var TMP_PATH = path.join(__dirname, '../', '.tmp');
    var PUBLIC_PATH = path.join(TMP_PATH, 'public');
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

            mkdirp(PUBLIC_PATH, function(err) {
                assert.ifError(err);
                DIRS_TO_DELETE.push(TMP_PATH);
                fs.writeFileSync(
                    path.join(PUBLIC_PATH, 'index.html'),
                    'Hello world!'
                );

                var serve = restify.plugins.serveStatic({
                    directory: PUBLIC_PATH
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

            mkdirp(PUBLIC_PATH, function(err) {
                assert.ifError(err);
                DIRS_TO_DELETE.push(TMP_PATH);
                fs.writeFileSync(
                    path.join(PUBLIC_PATH, 'index.html'),
                    'Hello world!'
                );

                var serve = restify.plugins.serveStatic({
                    directory: PUBLIC_PATH
                });

                var socket = new net.Socket();
                SERVER.get('/index.html', function(req, res, next) {
                    // closed before serve
                    socket.on('end', function() {
                        serve(req, res, function(nextRoute) {
                            assert.strictEqual(nextRoute, false);
                            done();
                        });
                    });
                });
                SERVER.on('after', function(req, res, route, afterErr) {
                    assert(afterErr.name, 'RequestCloseError');
                    done();
                });

                socket.connect({ host: '127.0.0.1', port: PORT }, function() {
                    socket.write(RAW_REQUEST, 'utf-8', function(err2, data) {
                        assert.ifError(err2);
                        socket.end();
                    });
                });
            });
        }
    );
});
