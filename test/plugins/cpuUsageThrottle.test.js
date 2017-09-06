'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire');
var restify = require('../../lib/index.js');
var restifyClients = require('restify-clients');

// Allow tests to set the CPU usage and error message returned by pidUsage
var ERROR = null;
var CPU = 50;

var cpuUsageThrottle = proxyquire('../../lib/plugins/cpuUsageThrottle.js', {
    pidusage: {
        stat: function (pid, cb) {
            return cb(ERROR, { cpu: CPU });
        }
    }
});

var MR = Math.random;
describe('cpuUsageThrottle', function () {

    before('Setup: stub math.random', function (done) {
        Math.random = function () {
            return 0;
        };
        done();
    });

    it('Unit: Should shed load', function (done) {
        var logged = false;
        var opts = { limit: 0, interval: 500 };
        var plugin = cpuUsageThrottle(opts);
        function next (cont) {
            clearTimeout(plugin._timeout);
            assert(cont instanceof Error, 'Should call next with error');
            assert.equal(cont.statusCode, 503, 'Defaults to 503 status');
            assert(logged, 'Should have emitted a log');
            done();
        }
        function trace () {
            logged = true;
        }
        var log = { trace: trace };
        var fakeReq = { log: log };
        plugin(fakeReq, {}, next);
    });

    it('Unit: Should support custom response', function (done) {
        var err = new Error('foo');
        var opts = { limit: 0, interval:500, err: err };
        var plugin = cpuUsageThrottle(opts);
        function next (cont) {
            clearTimeout(plugin._timeout);
            assert.equal(cont, err, 'Overrides body');
            done();
        }
        var fakeReq = { log : { trace: function () {} } };
        plugin(fakeReq, {}, next);
    });

    it('Unit: Should let request through when not under load', function (done) {
        var opts = { interval: 500, limit: 0.9 };
        var plugin = cpuUsageThrottle(opts);
        function next (cont) {
            assert.isUndefined(cont, 'Should call next');
            clearTimeout(plugin._timeout);
            done();
        }
        var fakeReq = { log : { trace: function () {} } };
        plugin(fakeReq, {}, next);
    });

    it('Integration: Should shed load', function (done) {
        var server = restify.createServer();
        var client = {
            close: function () {}
        };
        var isDone = false;
        var to;
        function finish() {
            if (isDone) {
                return null;
            }
            clearTimeout(to);
            isDone = true;
            client.close();
            server.close();
            return done();
        }
        to = setTimeout(finish, 1000);
        var err = new Error('foo');
        err.statusCode = 555;
        var opts = { interval: 500, limit: 0, err: err };
        var plugin = cpuUsageThrottle(opts);
        server.pre(plugin);
        server.get('/foo', function (req, res, next) {
            res.send(200);
            next();
        });
        server.listen(0, '127.0.0.1', function () {
            client = restifyClients.createJsonClient({
                url: 'http://127.0.0.1:' + server.address().port,
                retry: false
            });
            client.get({ path: '/foo' }, function (e, _, res) {
                assert(e, 'Second request is shed');
                assert.equal(e.name,
                    'InternalServerError', 'Default err returned');
                assert.equal(res.statusCode, 555,
                    'Default shed status code returned');
                clearTimeout(plugin._timeout);
            });
        });
    });

    after('Teardown: Reset Math.random', function (done) {
        Math.random = MR;
        done();
    });
});
