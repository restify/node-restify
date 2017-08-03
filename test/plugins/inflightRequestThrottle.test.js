'use strict';

var assert = require('chai').assert;
var restify = require('../../lib/index.js');
var restifyClients = require('restify-clients');
var P = restify.plugins.inflightRequestThrottle;

function fakeServer(count) {
    return {
        inflightRequests: function () {
            return count;
        }
    };
}

describe('inlfightRequestThrottle', function () {

    it('Unit: Should shed load', function (done) {
        var logged = false;
        var p = P({ server: fakeServer(10), limit: 1 });
        function send (body) {
            assert(logged, 'Should have emitted a log');
            assert.equal(body.statusCode, 503, 'Defaults to 503 status');
            assert(body instanceof Error, 'Defaults to error body');
            done();
        }
        function next () {
            assert(false, 'Should not call next');
            done();
        }
        function trace () {
            logged = true;
        }
        var log = { trace: trace };
        var fakeReq = { log: log };
        p(fakeReq, { send: send }, next);
    });

    it('Unit: Should support custom response', function (done) {
        var server = fakeServer(10);
        var resp = new Error('foo');
        var p = P({ server: server, limit: 1, resp: resp });
        function send (body) {
            assert.equal(body, resp, 'Overrides body');
            done();
        }
        function next () {
            assert(false, 'Should not call next');
            done();
        }
        var fakeReq = { log : { trace: function () {} } };
        p(fakeReq, { send: send }, next);
    });

    it('Unit: Should let request through when not under load', function (done) {
        var p = P({ server: fakeServer(1), limit: 2 });
        function send () {
            assert(false, 'Should not call send');
            done();
        }
        function next () {
            assert(true, 'Should call next');
            done();
        }
        var fakeReq = { log : { trace: function () {} } };
        p(fakeReq, { send: send }, next);
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
        to = setTimeout(finish, 2000);
        var resp = new Error('foo');
        resp.statusCode = 555;
        server.pre(P({ server: server, limit: 1, resp: resp }));
        var RESP;
        server.get('/foo', function (req, res) {
            if (RESP) {
                res.send(999);
            } else {
                RESP = res;
            }
        });
        server.listen(0, '127.0.0.1', function () {
            client = restifyClients.createJsonClient({
                url: 'http://127.0.0.1:' + server.address().port,
                retry: false
            });
            client.get({ path: '/foo' }, function (e, _, res) {
                assert(e === null || e === undefined,
                    'First request isnt shed');
                assert.equal(res.statusCode, 200, '200 returned on success');
                finish();
            });
            client.get({ path: '/foo' }, function (e, _, res) {
                assert(e, 'Second request is shed');
                assert.equal(e.name,
                    'InternalServerError', 'Default err returned');
                assert.equal(res.statusCode, 555,
                    'Default shed status code returned');
                RESP.send(200);
            });
        });
    });
});
