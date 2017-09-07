'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire');
var restify = require('../../lib/index.js');
var restifyClients = require('restify-clients');
var errors = require('restify-errors');

// Create a custom error for this test using a key that is unlikely to collide
var errorName = 'CPUTHROTTLE' + (Math.random() * 1e16);
var errorStatus = 503;
errors.makeConstructor(errorName, {
    statusCode: errorStatus
});
var restifyError = errors[errorName];

// Allow tests to set the CPU usage returned by pidUsage
var CPU = 50;

var cpuUsageThrottle = proxyquire('../../lib/plugins/cpuUsageThrottle.js', {
    pidusage: {
        stat: function (pid, cb) {
            return cb(null, { cpu: CPU });
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
        var opts = { limit: 0, interval: 500 };
        var plugin = cpuUsageThrottle(opts);
        function next (cont) {
            clearTimeout(plugin._timeout);
            assert(cont instanceof Error, 'Should call next with error');
            assert.equal(cont.statusCode, 503, 'Defaults to 503 status');
            done();
        }
        plugin({}, {}, next);
    });

    it('Unit: Should support custom response', function (done) {
        var opts = { limit: 0, interval:500, err: restifyError };
        var plugin = cpuUsageThrottle(opts);
        function next (cont) {
            clearTimeout(plugin._timeout);
            assert.equal(cont.name, restifyError.displayName, 'Overrides body');
            done();
        }
        plugin({}, {}, next);
    });

    it('Unit: Should let request through when not under load', function (done) {
        var opts = { interval: 500, limit: 0.9 };
        var plugin = cpuUsageThrottle(opts);
        function next (cont) {
            assert.isUndefined(cont, 'Should call next');
            clearTimeout(plugin._timeout);
            done();
        }
        plugin({}, {}, next);
    });

    it('Integration: Should shed load', function (done) {
        var server = restify.createServer();
        var client = {
            close: function () {}
        };
        var opts = { interval: 500, limit: 0, err: restifyError };
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
                assert.equal(e.name, errorName + 'Error',
                    'Default err returned');
                assert.equal(res.statusCode, errorStatus,
                    'Default shed status code returned');
                clearTimeout(plugin._timeout);
                done();
            });
        });
    });

    after('Teardown: Reset Math.random', function (done) {
        Math.random = MR;
        done();
    });
});
