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

describe('chainable status', function() {
    before(function(done) {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server')
        });

        SERVER.use(restify.plugins.chainableStatus());

        SERVER.get('/chainable', function respond(req, res, next) {
            res.status(200).send(req.url);
            next();
        });

        SERVER.get('/non-chainable', function respond(req, res, next) {
            res.statusRestify(202);
            res.send(req.url);
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

    it('should return 200 status', function(done) {
        CLIENT.get('/chainable', function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });

    it('should return 202 status from non chainable status', function(done) {
        CLIENT.get('/non-chainable', function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 202);
            done();
        });
    });
});
