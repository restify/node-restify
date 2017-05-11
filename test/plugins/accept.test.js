'use strict';

// external requires
var assert = require('chai').assert;
var restify = require('../../lib/index.js');
var restifyClients = require('restify-clients');

// local files
var helper = require('../lib/helper');
var plugins = require('../../lib').plugins;

// local globals
var SERVER;
var CLIENT;
var PORT;

describe('accept parser', function () {

    before(function (done) {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server')
        });

        SERVER.use(plugins.acceptParser(SERVER.acceptable));

        SERVER.get('/', function respond(req, res, next) {
            res.send();
            next();
        });

        SERVER.listen(0, '127.0.0.1', function () {
            PORT = SERVER.address().port;
            CLIENT = restifyClients.createJsonClient({
                url: 'http://127.0.0.1:' + PORT,
                dtrace: helper.dtrace,
                retry: false
            });

            done();
        });
    });

    after(function (done) {
        CLIENT.close();
        SERVER.close(done);
    });


    it('accept ok', function (done) {
        CLIENT.get('/', function (err, _, res) {
            assert.ifError(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });

    it('accept not ok (406)', function (done) {
        var opts = {
            path: '/',
            headers: {
                accept: 'foo/bar'
            }
        };

        CLIENT.get(opts, function (err, _, res) {
            assert.ok(err);
            assert.equal(err.name, 'NotAcceptableError');
            assert.equal(res.statusCode, 406);
            done();
        });
    });
});

