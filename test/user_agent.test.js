'use strict';

var child_process = require('child_process');
var http = require('http');

var restify = require('../lib');

var helper = require('./lib/helper');
var plugins = require('../lib');

var test = helper.test;
var before = helper.before;
var after = helper.after;

var SERVER;
var SERVER_PORT;
var SERVER_ADDRESS = '127.0.0.1';
var SERVER_ENDPOINT;
var TEST_ENDPOINT;
var TEST_RESPONSE_DATA = 'foobar';
var TEST_RESPONSE_DATA_LENGTH = TEST_RESPONSE_DATA.length;
var TEST_PATH = '/test/userAgent';

before(function (callback) {
    SERVER = restify.createServer({
        dtrace: helper.dtrace,
        log: helper.getLog('server')
    });

    // Enable the user agent pre-route handler, since this is the component
    // under test.
    SERVER.use(plugins.pre.userAgentConnection());

    SERVER.head('/test/:name', function (req, res, next) {
        // Explicitly set Content-Length response header so that we can test
        // for its removal (or lack thereof) by the userAgentConnection
        // pre-route handler in tests below.
        res.setHeader('Content-Length', TEST_RESPONSE_DATA_LENGTH);
        res.send(200, TEST_RESPONSE_DATA);
        next();
    });


    SERVER.listen(0, SERVER_ADDRESS, function () {
        SERVER_PORT = SERVER.address().port;
        SERVER_ENDPOINT = SERVER_ADDRESS + ':' + SERVER_PORT;
        TEST_ENDPOINT = SERVER_ENDPOINT + TEST_PATH;
        callback();
    });
});

after(function (callback) {
    SERVER.close(callback);
});

// By default, the userAgentConnection pre-route handler must:
//
// 1. set the 'connection' header to 'close'
//
// 2. remove the content-length header from the response
//
// when a HEAD request is handled and the client's user agent is curl.
test('userAgent sets proper headers for HEAD requests from curl', function (t) {
    var CURL_CMD =
        ['curl', '-sS', '-i', TEST_ENDPOINT, '-X', 'HEAD'].join(' ');

    child_process.exec(CURL_CMD, function onExec(err, stdout, stderr) {
        t.ifError(err);

        var lines = stdout.split(/\n/);

        var contentLengthHeaderNotPresent =
            lines.every(function checkContentLengthNotPresent(line) {
                return /Content-Length:.*/.test(line) === false;
            });
        var connectionCloseHeaderPresent =
            lines.some(function checkConnectionClosePresent(line) {
                return /Connection: close/.test(line);
            });

        t.ok(contentLengthHeaderNotPresent);
        t.ok(connectionCloseHeaderPresent);

        t.end();
    });
});

// When handling a HEAD request, and if the client's user agent is not curl, the
// userAgentConnection pre-route handler should not remove the content-length
// header from the response, and it should not replace the value of the
// 'connection' header by 'close'.
test('userAgent sets proper headers for HEAD requests from non-curl clients',
    function (t) {
    var req = http.request({
        hostname: SERVER_ADDRESS,
        port: SERVER_PORT,
        path: TEST_PATH,
        method: 'HEAD',
        headers: {
            'user-agent': 'foobar',
            connection: 'keep-alive'
        }
    }, function onResponse(res) {
        var responseHeaders = res.headers;

        t.ok(responseHeaders.hasOwnProperty('content-length'));
        t.equal(responseHeaders.connection, 'keep-alive');

        // destroy the socket explicitly now since the request was
        // explicitly requesting to not destroy the socket by setting
        // its connection header to 'keep-alive'.
        req.abort();

        t.end();
    });

    req.on('error', function onReqError(err) {
        t.ifError(err);
        t.end();
    });

    req.end();
});
