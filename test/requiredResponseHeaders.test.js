'use strict';
/* eslint-disable func-names */

var restifyClients = require('restify-clients');

var restify = require('../lib');

if (require.cache[__dirname + '/lib/helper.js']) {
    delete require.cache[__dirname + '/lib/helper.js'];
}
var helper = require('./lib/helper.js');

///--- Globals

var after = helper.after;
var before = helper.before;
var test = helper.test;

var JSON_CLIENT;
var LOCALHOST;
var PORT = process.env.UNIT_TEST_PORT || 0;
var SERVER;

///--- Tests

before(function(callback) {
    try {
        SERVER = restify.createServer({
            handleUncaughtExceptions: true,
            log: helper.getLog('server'),
            requiredResponseHeaders: ['content-type']
        });
        SERVER.listen(PORT, '127.0.0.1', function() {
            PORT = SERVER.address().port;
            JSON_CLIENT = restifyClients.createJsonClient({
                url: 'http://127.0.0.1:' + PORT,
                dtrace: helper.dtrace,
                retry: false
            });
            LOCALHOST = 'http://' + '127.0.0.1:' + PORT;
            callback();
        });
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});

after(function(callback) {
    try {
        SERVER.close(callback);
        JSON_CLIENT.close();
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});

test('sendRaw throws when no content-type set on response', function(t) {
    /*
     * In this case, res.sendRaw does not go through content type negotiation
     * and as a result does not set any content-type header. Since we also don't
     * set that header manually and the set of required headers includes
     * 'content-type', we expect res.sendRaw to throw.
     */
    SERVER.get('/foo', function handle(req, res, next) {
        res.sendRaw(200, JSON.stringify({ foo: 'bar' }));
    });

    SERVER.on('uncaughtException', function onUncaught(req, res, route, err) {
        t.ok(err, 'res.send threw expectedly');
        t.equal(err.message, 'Missing required headers: content-type');
        t.end();
    });

    JSON_CLIENT.get(LOCALHOST + '/foo', function onRes(err) {
        t.ok(err);
    });
});

test('sendRaw does not throw when content-type set on response', function(t) {
    /*
     * In this case, res.sendRaw does not go through content type negotiation
     * and as a result does not set any content-type header. However, we do set
     * the content-type header manually and as a result even though the set of
     * required headers includes 'content-type', we don't expect res.sendRaw to
     * throw.
     */
    SERVER.get('/foo', function handle(req, res, next) {
        res.header('content-type', 'application/json');
        res.sendRaw(200, JSON.stringify({ foo: 'bar' }));
    });

    SERVER.on('uncaughtException', function onUncaught(req, res, route, err) {
        t.ifError(err, 'res.send threw unexpectedly');
    });

    JSON_CLIENT.get(LOCALHOST + '/foo', function onRes(err, req, res, body) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.deepEqual(body, { foo: 'bar' });
        t.end();
    });
});

test('send does not throw when content-type inferred', function(t) {
    /*
     * In this case, the response's content-type is inferred by res.send because
     * the negotiated content-type is 'application/json' and the set of built-in
     * formatters includes that content-type.
     */
    SERVER.get('/foo', function handle(req, res, next) {
        res.send(200, { foo: 'bar' });
    });

    SERVER.on('uncaughtException', function onUncaught(req, res, route, err) {
        t.ifError(err, 'res.send threw unexpectedly');
    });

    JSON_CLIENT.get(LOCALHOST + '/foo', function onRes(err, req, res, body) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.deepEqual(body, { foo: 'bar' });
        t.end();
    });
});
