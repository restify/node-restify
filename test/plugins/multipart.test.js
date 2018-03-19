'use strict';
/* eslint-disable func-names */

// core requires
var http = require('http');

// external requires
var assert = require('chai').assert;
var restify = require('../../lib/index.js');

// local files
var helper = require('../lib/helper');

// local globals
var SERVER;
var PORT;

describe('multipart parser', function() {
    beforeEach(function(done) {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server')
        });

        SERVER.get('/', function respond(req, res, next) {
            res.send();
            next();
        });

        SERVER.listen(0, '127.0.0.1', function() {
            PORT = SERVER.address().port;
            done();
        });
    });

    afterEach(function(done) {
        SERVER.close(done);
    });

    it('body multipart ok', function(done) {
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

        SERVER.post('/multipart/:id', function(req, res, next) {
            assert.equal(req.params.id, 'foo');
            assert.equal(req.params.mood, 'happy');
            assert.equal(req.params.endorphins, '9000');
            res.send();
            next();
        });

        var opts = {
            hostname: '127.0.0.1',
            port: PORT,
            path: '/multipart/foo?mood=happy',
            agent: false,
            method: 'POST',
            headers: {
                'Content-Type': 'multipart/form-data; boundary=huff'
            }
        };

        var client = http.request(opts, function(res) {
            assert.equal(res.statusCode, 200);
            done();
        });

        client.write(
            '--huff\r\nContent-Disposition: form-data; ' +
                'name="endorphins"\r\n\r\n9000\r\n--huff--'
        );
        client.end();
    });

    it('gh-847 body multipart no files ok', function(done) {
        SERVER.use(
            restify.plugins.queryParser({
                mapParams: true
            })
        );
        SERVER.use(
            restify.plugins.bodyParser({
                mapFiles: true,
                mapParams: true,
                keepExtensions: true,
                uploadDir: '/tmp/',
                override: true
            })
        );

        SERVER.post('/multipart/:id', function(req, res, next) {
            assert.equal(req.params.id, 'foo');
            assert.equal(req.params.mood, 'happy');
            assert.equal(req.params.endorphins, '9000');
            res.send();
            next();
        });

        var opts = {
            hostname: '127.0.0.1',
            port: PORT,
            path: '/multipart/foo?mood=happy',
            agent: false,
            method: 'POST',
            headers: {
                'Content-Type': 'multipart/form-data; boundary=huff'
            }
        };

        var client = http.request(opts, function(res) {
            assert.equal(res.statusCode, 200);
            done();
        });

        // don't actually upload a file
        client.write(
            '--huff\r\nContent-Disposition: form-data; ' +
                'name="endorphins"\r\n\r\n9000\r\n--huff--'
        );
        client.end();
    });

    it('gh-847 body multipart files ok', function(done) {
        var shine =
            'Well you wore out your welcome with random precision, ' +
            'rode on the steel breeze. Come on you raver, you seer of ' +
            'visions, come on you painter, you piper, you prisoner, and shine!';
        var echoes =
            'Overhead the albatross hangs motionless upon the air ' +
            'And deep beneath the rolling waves in labyrinths of coral ' +
            'caves The echo of a distant tide Comes willowing across the ' +
            'sand And everything is green and submarine';
        SERVER.use(
            restify.plugins.queryParser({
                mapParams: true
            })
        );
        SERVER.use(
            restify.plugins.bodyParser({
                mapFiles: true,
                mapParams: true,
                keepExtensions: true,
                uploadDir: '/tmp/',
                override: true
            })
        );
        SERVER.post('/multipart/:id', function(req, res, next) {
            assert.equal(req.params.id, 'foo');
            assert.equal(req.params.mood, 'happy');
            assert.equal(req.params.endorphins, '12');
            assert.ok(req.params.shine);
            assert.ok(req.params.echoes);
            assert.equal(req.params.shine.toString('utf8'), shine);
            assert.equal(req.params.echoes.toString('utf8'), echoes);
            res.send();
            next();
        });

        var opts = {
            hostname: '127.0.0.1',
            port: PORT,
            path: '/multipart/foo?mood=happy',
            agent: false,
            method: 'POST',
            headers: {
                'Content-Type': 'multipart/form-data; boundary=huff'
            }
        };

        var client = http.request(opts, function(res) {
            assert.equal(res.statusCode, 200);
            done();
        });

        client.write('--huff\r\n');
        client.write(
            'Content-Disposition: form-data; name="endorphins"\r\n\r\n'
        );
        client.write('12\r\n');

        client.write('--huff\r\n');

        client.write(
            'Content-Disposition: form-data; name="shine"; ' +
                'filename="shine.txt"\r\n'
        );
        client.write('Content-Type: text/plain\r\n\r\n');
        client.write(shine + '\r\n');
        client.write('--huff\r\n');

        client.write(
            'Content-Disposition: form-data; name="echoes"; ' +
                'filename="echoes.txt"\r\n'
        );
        client.write('Content-Type: text/plain\r\n\r\n');
        client.write(echoes + '\r\n');
        client.write('--huff--');

        client.end();
    });

    it('body multipart ok custom handling', function(done) {
        var detailsString =
            'High endorphin levels make you happy. ' +
            'Mostly... I guess. Whatever.';
        SERVER.post(
            '/multipart/:id',
            restify.plugins.bodyParser({
                multipartHandler: function(part) {
                    var buffer = new Buffer(0);
                    part.on('data', function(data) {
                        buffer = Buffer.concat([data]);
                    });

                    part.on('end', function() {
                        assert.equal(part.name, 'endorphins');
                        assert.equal(buffer.toString('ascii'), '12');
                    });
                },
                multipartFileHandler: function(part) {
                    var buffer = new Buffer(0);
                    part.on('data', function(data) {
                        buffer = Buffer.concat([data]);
                    });

                    part.on('end', function() {
                        assert.equal(part.name, 'details');
                        assert.equal(part.filename, 'mood_details.txt');
                        assert.equal(buffer.toString('ascii'), detailsString);
                    });
                },
                mapParams: false
            }),
            function(req, res, next) {
                res.send();
                next();
            }
        );

        var opts = {
            hostname: '127.0.0.1',
            port: PORT,
            path: '/multipart/foo?mood=sad',
            agent: false,
            method: 'POST',
            headers: {
                'Content-Type': 'multipart/form-data; boundary=huff'
            }
        };

        var client = http.request(opts, function(res) {
            assert.equal(res.statusCode, 200);
            done();
        });

        client.write('--huff\r\n');
        client.write(
            'Content-Disposition: form-data; name="endorphins"\r\n\r\n'
        );
        client.write('12\r\n');

        client.write('--huff\r\n');

        // jscs:disable maximumLineLength
        client.write(
            'Content-Disposition: form-data; name="details"; ' +
                'filename="mood_details.txt"\r\n'
        );

        // jscs:enable maximumLineLength
        client.write('Content-Type: text/plain\r\n\r\n');
        client.write(detailsString + '\r\n');
        client.write('--huff--');

        client.end();
    });

    it('restify-GH-694 pass hash option through to Formidable', function(done) {
        var content = 'Hello World!';
        var hash = '2ef7bde608ce5404e97d5f042f95f89f1c232871';
        SERVER.post(
            '/multipart',
            restify.plugins.bodyParser({ hash: 'sha1' }),
            function(req, res, next) {
                assert.equal(req.files.details.hash, hash);
                res.send();
                next();
            }
        );

        var opts = {
            hostname: '127.0.0.1',
            port: PORT,
            path: '/multipart',
            agent: false,
            method: 'POST',
            headers: {
                'Content-Type': 'multipart/form-data; boundary=huff'
            }
        };

        var client = http.request(opts, function(res) {
            assert.equal(res.statusCode, 200);
            done();
        });

        client.write('--huff\r\n');

        // jscs:disable maximumLineLength
        client.write(
            'Content-Disposition: form-data; name="details"; ' +
                'filename="mood_details.txt"\r\n'
        );

        // jscs:enable maximumLineLength
        client.write('Content-Type: text/plain\r\n\r\n');
        client.write(content + '\r\n');
        client.write('--huff--');

        client.end();
    });

    it('Ensure maxFileSize change is enforced', function(done) {
        var shine =
            'Well you wore out your welcome with random precision, ' +
            'rode on the steel breeze. Come on you raver, you seer of ' +
            'visions, come on you painter, you piper, you prisoner, and shine!';
        var echoes =
            'Overhead the albatross hangs motionless upon the air ' +
            'And deep beneath the rolling waves in labyrinths of coral ' +
            'caves The echo of a distant tide Comes willowing across the ' +
            'sand And everything is green and submarine';

        var shortest = Math.min(shine.length, echoes.length);

        SERVER.use(
            restify.plugins.queryParser({
                mapParams: true
            })
        );
        SERVER.use(
            restify.plugins.bodyParser({
                mapFiles: true,
                mapParams: true,
                keepExtensions: true,
                uploadDir: '/tmp/',
                override: true,
                // Set limit to shortest of the 'files',
                //  longer will trigger an error.
                maxFileSize: shortest
            })
        );
        SERVER.post('/multipart/:id', function(req, res, next) {
            assert.equal(req.params.id, 'foo');
            assert.equal(req.params.mood, 'happy');
            assert.equal(req.params.endorphins, '12');
            assert.ok(req.params.shine);
            assert.ok(req.params.echoes);
            assert.equal(req.params.shine.toString('utf8'), shine);
            assert.equal(req.params.echoes.toString('utf8'), echoes);
            res.send();
            next();
        });

        var opts = {
            hostname: '127.0.0.1',
            port: PORT,
            path: '/multipart/foo?mood=happy',
            agent: false,
            method: 'POST',
            headers: {
                'Content-Type': 'multipart/form-data; boundary=huff'
            }
        };

        var client = http.request(opts, function(res) {
            assert.equal(res.statusCode, 400);
            var body = '';
            res.on('data', function(d) {
                body += d;
            });
            res.on('end', function() {
                var rsp = JSON.parse(body);
                assert.equal(rsp.code, 'BadRequest');
                assert.equal(
                    rsp.message.substring(0, 30),
                    'maxFileSize exceeded, received'
                );
                done();
            });
        });

        client.write('--huff\r\n');
        client.write(
            'Content-Disposition: form-data; name="endorphins"\r\n\r\n'
        );
        client.write('12\r\n');

        client.write('--huff\r\n');

        client.write(
            'Content-Disposition: form-data; name="shine"; ' +
                'filename="shine.txt"\r\n'
        );
        client.write('Content-Type: text/plain\r\n\r\n');
        client.write(shine + '\r\n');
        client.write('--huff\r\n');

        client.write(
            'Content-Disposition: form-data; name="echoes"; ' +
                'filename="echoes.txt"\r\n'
        );
        client.write('Content-Type: text/plain\r\n\r\n');
        client.write(echoes + '\r\n');
        client.write('--huff--');

        client.end();
    });
});
