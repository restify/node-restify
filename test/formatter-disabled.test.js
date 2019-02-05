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

var CLIENT;
var LOCALHOST;
var PORT = process.env.UNIT_TEST_PORT || 0;
var SERVER;

///--- Tests

before(function(callback) {
    try {
        SERVER = restify.createServer({
            handleUncaughtExceptions: true,
            log: helper.getLog('server'),
            disableResponseFormatting: true,
            formatters: {
                'foo/bar': function(req, res, body) {
                    return 'foo/bar';
                }
            }
        });
        SERVER.listen(PORT, '127.0.0.1', function() {
            PORT = SERVER.address().port;
            CLIENT = restifyClients.createStringClient({
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
        CLIENT.close();
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});

test('formatting disabled/no formatter available: res 200 ', function(t) {
    // When server is passed "disableResponseFormatting: true" at creation time,
    // res.send still sends a successful response even when a formatter is
    // not set up for a specific content-type.
    SERVER.get('/foo', function handle(req, res, next) {
        res.header('content-type', 'application/hal+json');
        res.send(200, 'unformatted response');
        return next();
    });

    CLIENT.get(LOCALHOST + '/foo', function(err, _, res, body) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.equal(res.headers['content-type'], 'application/hal+json');
        t.equal(body, 'unformatted response');
        t.end();
    });
});

test('formatting disabled/formater available: res not formatted', function(t) {
    // When server is passed "disableResponseFormatting: true" at creation time,
    // res.send still sends a successful response and not format response, even
    // though a formatter is set up for the response's content-type.
    SERVER.get('/foo', function handle(req, res, next) {
        res.header('content-type', 'foo/bar');
        res.send(200, 'unformatted response');
        return next();
    });

    CLIENT.get(LOCALHOST + '/foo', function(err, _, res, body) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.equal(res.headers['content-type'], 'foo/bar');
        t.equal(body, 'unformatted response');
        t.end();
    });
});

test('formatting disabled: res.send requires string or buffer', function(t) {
    SERVER.get('/foo', function handle(req, res, next) {
        res.header('content-type', 'foo/bar');

        try {
            res.send(200, { hello: 'world' });
            t.ok(false, 'res.send did not throw, expected to throw');
            t.end();
        } catch (err) {
            t.ok(err, 'res.send threw as expected');
            t.end();
        }
    });

    // We don't expect a response,
    CLIENT.get(LOCALHOST + '/foo' /*, callback explicitly not set */);
});
