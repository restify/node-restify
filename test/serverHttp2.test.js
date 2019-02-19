'use strict';
/* eslint-disable func-names */

var path = require('path');
var fs = require('fs');
var http2;

// http2 module is not available < v8.4.0 (only with flag <= 8.8.0)
try {
    http2 = require('http2');
} catch (err) {
    console.log('HTTP2 module is not available');
    console.log(
        'Node.js version >= v8.8.8 required, current: ' + process.versions.node
    );
    return;
}

var restify = require('../lib');

if (require.cache[__dirname + '/lib/helper.js']) {
    delete require.cache[__dirname + '/lib/helper.js'];
}
var helper = require('./lib/helper.js');

///--- Globals

var after = helper.after;
var before = helper.before;
var test = helper.test;

var CERT = fs.readFileSync(path.join(__dirname, './keys/http2-cert.pem'));
var KEY = fs.readFileSync(path.join(__dirname, './keys/http2-key.pem'));
var CA = fs.readFileSync(path.join(__dirname, 'keys/http2-csr.pem'));

var PORT = process.env.UNIT_TEST_PORT || 0;
var CLIENT;
var SERVER;

///--- Tests

before(function(cb) {
    try {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            handleUncaughtExceptions: true,
            http2: {
                cert: CERT,
                key: KEY,
                ca: CA
            },
            log: helper.getLog('server')
        });
        SERVER.listen(PORT, '127.0.0.1', function() {
            PORT = SERVER.address().port;
            CLIENT = http2.connect('https://127.0.0.1:' + PORT, {
                rejectUnauthorized: false
            });

            cb();
        });
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});

after(function(cb) {
    try {
        CLIENT.destroy();
        SERVER.close(function() {
            CLIENT = null;
            SERVER = null;
            cb();
        });
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});

test('get (path only)', function(t) {
    SERVER.get('/foo/:id', function echoId(req, res, next) {
        t.ok(req.params);
        t.equal(req.params.id, 'bar');
        t.equal(req.isUpload(), false);
        res.json({ hello: 'world' });
        next();
    });

    var req = CLIENT.request({
        ':path': '/foo/bar',
        ':method': 'GET'
    });

    req.on('response', function(headers, flags) {
        var data = '';
        t.equal(headers[':status'], 200);

        req.on('data', function(chunk) {
            data += chunk;
        });
        req.on('end', function() {
            t.deepEqual(JSON.parse(data), { hello: 'world' });
            t.end();
        });
    });
    req.on('error', function(err) {
        t.ifError(err);
    });
});
