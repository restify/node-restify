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

describe('dedupe forward slashes in URL', function() {
    before(function(done) {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server')
        });

        SERVER.pre(restify.plugins.pre.dedupeSlashes());

        SERVER.get('/foo/bar/', function respond(req, res, next) {
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

    it('should not remove single slashes', function(done) {
        CLIENT.get('/foo/bar/', function(err, _, res, data) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            assert.equal(data, '/foo/bar/');
            done();
        });
    });

    it('should remove duplicate slashes', function(done) {
        CLIENT.get('//////foo///bar///////', function(err, _, res, data) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            assert.equal(data, '/foo/bar/');
            done();
        });
    });

    // eslint-disable-next-line
    it('should remove duplicate slashes including trailing slashes', function(done) {
        CLIENT.get('//foo//bar//', function(err, _, res, data) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            assert.equal(data, '/foo/bar/');
            done();
        });
    });
});
