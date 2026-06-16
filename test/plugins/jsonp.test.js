'use strict';
/* eslint-disable func-names */

var assert = require('chai').assert;
var restify = require('../../lib/index.js');
var restifyClients = require('restify-clients');

var helper = require('../lib/helper');

var SERVER;
var CLIENT;
var PORT;

describe('jsonp plugin', function() {
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

    it('should set content-type', function(done) {
        SERVER.use(restify.plugins.jsonp());

        SERVER.get('/jsonp/cb', function(req, res, next) {
            assert.equal(
                res.getHeader('Content-Type'),
                'application/javascript'
            );
            res.send();
            next();
        });

        CLIENT.get('/jsonp/cb?callback=myFn', function(err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });
});
