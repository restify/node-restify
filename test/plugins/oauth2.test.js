// Copyright 2016 Brian Aabel, Inc.  All rights reserved.

'use strict';
/* eslint-disable func-names */

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
var TEST_TOKEN = '18926970-A-nMnSHDqg8Fsunm6Qx1cF1APp';

describe('oauth2 token parser', function() {
    before(function(done) {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server')
        });

        SERVER.use(restify.plugins.bodyParser());
        SERVER.use(restify.plugins.oauth2TokenParser());

        SERVER.get('/', function respond(req, res, next) {
            res.send();
            next();
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

    after(function(done) {
        CLIENT.close();
        SERVER.close(done);
    });

    it('should parse oauth2 token from authorization header', function(done) {
        var opts = {
            path: '/test1/auth-header',
            headers: {
                Authorization: 'Bearer ' + TEST_TOKEN
            }
        };
        SERVER.get('/test1/auth-header', function(req, res, next) {
            assert.isNotNull(req.oauth2.accessToken);
            assert.equal(req.oauth2.accessToken, TEST_TOKEN);
            res.send();
            next();
        });
        CLIENT.get(opts, function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });

    // eslint-disable-next-line
    it('should do nothing (token is null) if there is no oauth2 token set', function(done) {
        var opts = {
            path: '/test2/do/nothing'
        };
        SERVER.get(opts, function(req, res, next) {
            assert.isNull(req.oauth2.accessToken);
            assert.equal(res.statusCode, 200);
            res.send();
            next();
        });
        CLIENT.get(opts, function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });

    it('should parse from request body', function(done) {
        var test3Url = '/test3/contenttype/ok';

        SERVER.post(test3Url, function(req, res, next) {
            assert.isNotNull(req.oauth2.accessToken);
            assert.equal(req.oauth2.accessToken, TEST_TOKEN);
            res.send();
            next();
        });

        var opts = {
            hostname: '127.0.0.1',
            port: PORT,
            path: test3Url,
            agent: false,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };
        var client = http.request(opts, function(res) {
            assert.equal(res.statusCode, 200);
            done();
        });
        client.write('access_token=' + TEST_TOKEN);
        client.end();
    });

    // eslint-disable-next-line
    it('should parse oauth2 token from request body(case-insensitive)', function(done) {
        var test4Url = '/test4/contenttype/mixedcase';

        SERVER.post(test4Url, function(req, res, next) {
            assert.isNotNull(req.oauth2.accessToken);
            assert.equal(req.oauth2.accessToken, TEST_TOKEN);
            res.send();
            next();
        });

        var opts = {
            hostname: '127.0.0.1',
            port: PORT,
            path: test4Url,
            agent: false,
            method: 'POST',
            headers: {
                'Content-Type': 'APPLICATION/x-www-form-urlencoded'
            }
        };
        var client = http.request(opts, function(res) {
            assert.equal(res.statusCode, 200);
            done();
        });
        client.write('access_token=' + TEST_TOKEN);
        client.end();
    });

    it('should ignore token from request body', function(done) {
        var test5Url = '/test5/contenttype/missing/1';

        SERVER.post(test5Url, function(req, res, next) {
            assert.isNull(req.oauth2.accessToken);
            res.send(200);
            next();
        });

        var opts5 = {
            hostname: '127.0.0.1',
            port: PORT,
            path: test5Url,
            agent: false,
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml'
            }
        };
        var client = http.request(opts5, function(res) {
            assert.equal(res.statusCode, 200);
            done();
        });
        client.write('access_token=' + TEST_TOKEN);
        client.end();
    });

    // eslint-disable-next-line
    it('should fail if more than one method is used to set the oauth2 token', function(done) {
        SERVER.post('/test6/multi/method/fail', function(req, res, next) {
            assert.isNull(req.oauth2.accessToken);
            res.send();
            next();
        });
        var opts = {
            path: '/test6/multi/method/fail',
            headers: {
                Authorization: 'Bearer ' + TEST_TOKEN,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        CLIENT.post(opts, { access_token: TEST_TOKEN }, function(err, _, res) {
            assert.ok(err);
            assert.equal(res.statusCode, 400);
            done();
        });
    });
});
