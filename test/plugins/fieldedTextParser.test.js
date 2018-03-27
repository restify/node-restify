'use strict';
/* eslint-disable func-names */

// core requires
var fs = require('fs');
var path = require('path');

// external requires
var assert = require('chai').assert;
var restify = require('../../lib/index.js');
var restifyClients = require('restify-clients');

// local files
var helper = require('../lib/helper');

var fsOptions = { encoding: 'utf8' };
var PORT = process.env.UNIT_TEST_PORT || 3333;
var CLIENT;
var SERVER;
var DATA_CSV = fs.readFileSync(
    path.join(__dirname, '/files/data-csv.txt'),
    fsOptions
);
var DATA_TSV = fs.readFileSync(
    path.join(__dirname, '/files/data-tsv.txt'),
    fsOptions
);
var OBJECT_CSV = require(path.join(__dirname, '/files/object-csv.json'));
var OBJECT_TSV = require(path.join(__dirname, '/files/object-tsv.json'));

/**
 * Tests
 */

describe('fielded text parser', function() {
    beforeEach(function(done) {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server')
        });
        SERVER.use(restify.plugins.bodyParser());
        SERVER.listen(PORT, '127.0.0.1', function() {
            CLIENT = restifyClients.createClient({
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

    it('should parse CSV body', function(done) {
        var options = {
            path: '/data',
            headers: {
                'Content-Type': 'text/csv'
            }
        };

        SERVER.post('/data', function respond(req, res, next) {
            res.send({
                status: 'okay',
                parsedReq: req.body
            });
            return next();
        });

        CLIENT.post(options, function(err, req) {
            assert.ifError(err);
            req.on('result', function(errReq, res) {
                assert.ifError(errReq);
                res.body = '';
                res.setEncoding('utf8');
                res.on('data', function(chunk) {
                    res.body += chunk;
                });
                res.on('end', function() {
                    res.body = JSON.parse(res.body);
                    var parsedReqStr = JSON.stringify(res.body.parsedReq);
                    var objectStr = JSON.stringify(OBJECT_CSV);
                    assert.equal(parsedReqStr, objectStr);
                    done();
                });
            });
            req.write(DATA_CSV);
            req.end();
        });
    });

    // eslint-disable-next-line
    it('#100 should parse CSV body even if bodyparser declared twice', function(done) {
        SERVER.use(restify.plugins.bodyParser());
        var options = {
            path: '/data',
            headers: {
                'Content-Type': 'text/csv'
            }
        };

        SERVER.post('/data', function respond(req, res, next) {
            res.send({
                status: 'okay',
                parsedReq: req.body
            });
            return next();
        });

        CLIENT.post(options, function(err, req) {
            assert.ifError(err);
            req.on('result', function(errReq, res) {
                assert.ifError(errReq);
                res.body = '';
                res.setEncoding('utf8');
                res.on('data', function(chunk) {
                    res.body += chunk;
                });
                res.on('end', function() {
                    res.body = JSON.parse(res.body);
                    var parsedReqStr = JSON.stringify(res.body.parsedReq);
                    var objectStr = JSON.stringify(OBJECT_CSV);
                    assert.equal(parsedReqStr, objectStr);
                    done();
                });
            });
            req.write(DATA_CSV);
            req.end();
        });
    });

    it('should parse TSV body', function(done) {
        var options = {
            path: '/data',
            headers: {
                'Content-Type': 'text/tsv'
            }
        };

        SERVER.post('/data', function respond(req, res, next) {
            res.send({
                status: 'okay',
                parsedReq: req.body
            });
            return next();
        });

        CLIENT.post(options, function(err, req) {
            assert.ifError(err);
            req.on('result', function(errReq, res) {
                assert.ifError(errReq);
                res.body = '';
                res.setEncoding('utf8');
                res.on('data', function(chunk) {
                    res.body += chunk;
                });
                res.on('end', function() {
                    res.body = JSON.parse(res.body);
                    var parsedReqStr = JSON.stringify(res.body.parsedReq);
                    var objectStr = JSON.stringify(OBJECT_TSV);
                    assert.equal(parsedReqStr, objectStr);
                    done();
                });
            });
            req.write(DATA_TSV);
            req.end();
        });
    });

    it('plugins-GH-6: should expose rawBody on request', function(done) {
        var options = {
            path: '/data',
            headers: {
                'Content-Type': 'text/csv'
            }
        };

        SERVER.post('/data', function respond(req, res, next) {
            assert.ok(req.rawBody);
            res.send();
            return next();
        });

        CLIENT.post(options, function(err, req) {
            assert.ifError(err);
            req.on('result', function(errReq, res) {
                assert.ifError(errReq);
                res.body = '';
                res.setEncoding('utf8');
                res.on('data', function(chunk) {
                    res.body += chunk;
                });
                res.on('end', done);
            });
            req.write(DATA_TSV);
            req.end();
        });
    });
});
