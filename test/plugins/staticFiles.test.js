'use strict';
/* eslint-disable func-names */

// core requires
var fs = require('fs');
var path = require('path');
var net = require('net');

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

describe('staticFiles plugin - no options', function() {
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

    var STATIC_FILES_PATH = __dirname + '/testStaticFiles';
    function simpleTests(endpoint, filePath, contentType, done) {
        var ENDPOINT = endpoint;
        var fileSuffixPath = filePath;
        var requestPath = path.join(ENDPOINT, fileSuffixPath);
        var fileOnDisk = path.join(STATIC_FILES_PATH, fileSuffixPath);
        if (fileSuffixPath.endsWith('/')) {
            fileOnDisk = path.join(fileOnDisk, 'index.html');
        }
        var fileContent = fs.readFileSync(fileOnDisk, 'utf8');
        var fileStat = fs.statSync(fileOnDisk);
        SERVER.get(
            ENDPOINT + '/*',
            restify.plugins.serveStaticFiles(path.resolve(STATIC_FILES_PATH))
        );

        CLIENT.get(encodeURI(requestPath), function(err, req, res, obj) {
            assert.ifError(err);
            assert.equal(fileContent, obj);
            // Verify headers
            assert.equal(res.headers['cache-control'], 'public, max-age=0');
            assert.equal(
                res.headers['content-type'],
                contentType //'text/html; charset=UTF-8'
            );
            assert.exists(res.headers.etag);
            assert.equal(
                res.headers['last-modified'],
                fileStat.mtime.toUTCString()
            );
            done();
        });
    }
    it('serve static file', function(done) {
        simpleTests('/public', 'index.html', 'text/html; charset=UTF-8', done);
    });
    it('serve default static file(index.html)', function(done) {
        simpleTests('/public', '/', 'text/html; charset=UTF-8', done);
    });
    it('serve static file(file1.txt)', function(done) {
        simpleTests('/public', 'file1.txt', 'text/plain; charset=UTF-8', done);
    });
    it('serve nested static files in request', function(done) {
        simpleTests(
            '/public',
            'docs/doc.md',
            'text/markdown; charset=UTF-8',
            done
        );
    });
    it('serve default nested static file(index.html)', function(done) {
        simpleTests('/public', 'docs/', 'text/html; charset=UTF-8', done);
    });
    it('serve file paths with special chars', function(done) {
        simpleTests(
            '/public',
            'special/$_$/bad (file).txt',
            'text/plain; charset=UTF-8',
            done
        );
    });
});

describe('staticFiles plugin - with options', function() {
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

    var STATIC_FILES_PATH = __dirname + '/testStaticFiles';

    var OPTIONS = {
        maxAge: 3600000, // this is in millisecs
        etag: false,
        setHeaders: function setCustomHeaders(response, requestedPath, stat) {
            response.setHeader('restify-plugin-x', 'awesome');
        }
    };

    function testsWithOptions(endpoint, filePath, options, contentType, done) {
        var ENDPOINT = endpoint;
        var fileSuffixPath = filePath;
        var requestPath = path.join(ENDPOINT, fileSuffixPath);
        var fileOnDisk = path.join(STATIC_FILES_PATH, fileSuffixPath);
        if (fileSuffixPath.endsWith('/')) {
            fileOnDisk = path.join(fileOnDisk, 'index.html');
        }
        var fileContent = fs.readFileSync(fileOnDisk, 'utf8');
        var fileStat = fs.statSync(fileOnDisk);
        SERVER.get(
            ENDPOINT + '/*',
            restify.plugins.serveStaticFiles(
                path.resolve(STATIC_FILES_PATH),
                options
            )
        );

        CLIENT.get(encodeURI(requestPath), function(err, req, res, obj) {
            assert.ifError(err);
            assert.equal(fileContent, obj);
            // Verify headers
            assert.equal(res.headers['cache-control'], 'public, max-age=3600');
            assert.equal(
                res.headers['content-type'],
                contentType //'text/html; charset=UTF-8'
            );
            assert.notExists(res.headers.etag);
            assert.equal(
                res.headers['last-modified'],
                fileStat.mtime.toUTCString()
            );
            assert.equal(res.headers['restify-plugin-x'], 'awesome');
            done();
        });
    }

    it('serve static file', function(done) {
        testsWithOptions(
            '/public',
            'index.html',
            OPTIONS,
            'text/html; charset=UTF-8',
            done
        );
    });
    it('serve default static file(index.html)', function(done) {
        testsWithOptions(
            '/public',
            '/',
            OPTIONS,
            'text/html; charset=UTF-8',
            done
        );
    });
    it('serve static file(file1.txt)', function(done) {
        testsWithOptions(
            '/public',
            'file1.txt',
            OPTIONS,
            'text/plain; charset=UTF-8',
            done
        );
    });
    it('serve nested static files in request', function(done) {
        testsWithOptions(
            '/public',
            'docs/doc.md',
            OPTIONS,
            'text/markdown; charset=UTF-8',
            done
        );
    });
    it('serve default nested static file(index.html)', function(done) {
        testsWithOptions(
            '/public',
            'docs/',
            OPTIONS,
            'text/html; charset=UTF-8',
            done
        );
    });
    it('serve file paths with special chars', function(done) {
        testsWithOptions(
            '/public',
            'special/$_$/bad (file).txt',
            OPTIONS,
            'text/plain; charset=UTF-8',
            done
        );
    });
});

describe('staticFiles plugin - negative cases', function() {
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

    var STATIC_FILES_PATH = __dirname + '/testStaticFiles';
    var OPTIONS = {
        maxAge: 3600000, // this is in millisecs
        etag: false,
        setHeaders: function setCustomHeaders(response, requestedPath, stat) {
            response.setHeader('restify-plugin-x', 'awesome');
        }
    };
    function negativeTests(
        endpoint,
        filePath,
        expectedStatusCode,
        expectedStatusMsg,
        done
    ) {
        var ENDPOINT = endpoint;
        var fileSuffixPath = filePath;
        var requestPath = path.join(ENDPOINT, fileSuffixPath);
        SERVER.get(
            ENDPOINT + '/*',
            restify.plugins.serveStaticFiles(
                path.resolve(STATIC_FILES_PATH),
                OPTIONS
            )
        );

        CLIENT.get(encodeURI(requestPath), function(err, req, res, obj) {
            assert.exists(err);
            assert.equal(res.statusCode, expectedStatusCode);
            assert.equal(res.statusMessage, expectedStatusMsg);
            done();
        });
    }
    it('fail to serve root directory', function(done) {
        negativeTests('/public', '', 404, 'Not Found', done);
    });
    it('fail to serve nested directory', function(done) {
        negativeTests('/public', 'docs', 403, 'Forbidden', done);
    });
    it('fail on file not found', function(done) {
        negativeTests('/public', 'file2.txt', 404, 'Not Found', done);
    });
    it('fail on nested file not found', function(done) {
        negativeTests(
            '/public',
            'docs/doc_not_there.md',
            404,
            'Not Found',
            done
        );
    });
    it('fail on missing file special characters', function(done) {
        negativeTests(
            '/public',
            'special/$_$/bad (file)~notExists.txt',
            404,
            'Not Found',
            done
        );
    });
    it('fail on POST', function(done) {
        var ENDPOINT = '/public';
        var fileSuffixPath = 'docs/';
        var requestPath = path.join(ENDPOINT, fileSuffixPath);
        SERVER.post(
            ENDPOINT + '/*',
            restify.plugins.serveStaticFiles(
                path.resolve(STATIC_FILES_PATH),
                OPTIONS
            )
        );

        CLIENT.get(encodeURI(requestPath), function(err, req, res, obj) {
            assert.exists(err);
            assert.equal(res.statusCode, 405);
            assert.equal(res.statusMessage, 'Method Not Allowed');
            done();
        });
    });
});

describe('staticFiles plugin - with sockets', function() {
    // for some reason the server.close with socket
    // takes longer to close
    this.timeout(15000);
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
        SERVER.close(done);
    });

    var STATIC_FILES_PATH = __dirname + '/testStaticFiles';

    var OPTIONS = {
        maxAge: 3600000, // this is in millisecs
        etag: false,
        setHeaders: function setCustomHeaders(response, requestedPath, stat) {
            response.setHeader('restify-plugin-x', 'awesome');
        }
    };

    function testsWithOptions(endpoint, filePath, done) {
        var ENDPOINT = endpoint;
        var fileSuffixPath = filePath;
        var requestPath = path.join(ENDPOINT, fileSuffixPath);
        var socket = new net.Socket();

        SERVER.get(
            ENDPOINT + '/*',
            restify.plugins.serveStaticFiles(
                path.resolve(STATIC_FILES_PATH),
                OPTIONS
            )
        );

        var RAW_REQUEST =
            'GET ' +
            requestPath +
            ' HTTP/1.1\r\n' +
            'Host: 127.0.0.1:' +
            PORT +
            '\r\n' +
            'User-Agent: curl/7.48.0\r\n' +
            'Accept: */*\r\n' +
            '\r\n';

        socket.connect({ host: '127.0.0.1', port: PORT }, function() {
            socket.write(RAW_REQUEST, 'utf8', function(err2, data) {
                assert.ifError(err2);
            });
        });

        socket.on('data', function(data) {
            var stringData = data.toString('utf8');
            assert.isTrue(stringData.indexOf('restify-plugin-x') > 0);
            done();
        });
    }

    it('serve static file', function(done) {
        testsWithOptions('/public', 'index.html', done);
    });
});
