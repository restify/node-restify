'use strict';
/* eslint-disable func-names */

// core requires
var child_process = require('child_process');
var http = require('http');

// external requires
var assert = require('chai').assert;
var restify = require('../../lib/index.js');

// local files
var helper = require('../lib/helper');

// local globals
var SERVER;
var SERVER_PORT;
var SERVER_ADDRESS = '127.0.0.1';
var SERVER_ENDPOINT;
var TEST_ENDPOINT;
var TEST_RESPONSE_DATA = 'foobar';
var TEST_RESPONSE_DATA_LENGTH = TEST_RESPONSE_DATA.length;
var TEST_PATH = '/test/userAgent';

describe('userAgent pre-route handler', function() {
    beforeEach(function(done) {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server')
        });

        // Enable the user agent pre-route handler, since this is the component
        // under test.
        SERVER.use(restify.plugins.pre.userAgentConnection());

        SERVER.head('/test/:name', function(req, res, next) {
            // Explicitly set Content-Length response header so that we can test
            // for its removal (or lack thereof) by the userAgentConnection
            // pre-route handler in tests below.
            res.setHeader('Content-Length', TEST_RESPONSE_DATA_LENGTH);
            res.send(200, TEST_RESPONSE_DATA);
            next();
        });

        SERVER.listen(0, SERVER_ADDRESS, function() {
            SERVER_PORT = SERVER.address().port;
            SERVER_ENDPOINT = SERVER_ADDRESS + ':' + SERVER_PORT;
            TEST_ENDPOINT = SERVER_ENDPOINT + TEST_PATH;
            done();
        });
    });

    afterEach(function(done) {
        SERVER.close(done);
    });

    // By default, the userAgentConnection pre-route handler must:
    //
    // 1. set the 'connection' header to 'close'
    //
    // 2. remove the content-length header from the response
    //
    // when a HEAD request is handled and the client's user agent is curl.
    it('sets proper headers for HEAD requests from curl', function(done) {
        var CURL_CMD = ['curl', '-sS', '-i', TEST_ENDPOINT, '-X', 'HEAD'].join(
            ' '
        );

        child_process.exec(CURL_CMD, function onExec(err, stdout, stderr) {
            assert.ifError(err);

            var lines = stdout.split(/\n/);

            var contentLengthHeaderNotPresent = lines.every(
                function checkContentLengthNotPresent(line) {
                    return /Content-Length:.*/.test(line) === false;
                }
            );
            var connectionCloseHeaderPresent = lines.some(
                function checkConnectionClosePresent(line) {
                    return /Connection: close/.test(line);
                }
            );

            assert.ok(contentLengthHeaderNotPresent);
            assert.ok(connectionCloseHeaderPresent);

            done();
        });
    });

    // When handling a HEAD request, and if the client's user agent is not curl,
    // the userAgentConnection should not remove the content-length header from
    // the response, and it should not replace the value of the 'connection'
    // header by 'close'.
    // eslint-disable-next-line
    it('sets proper headers for HEAD requests from non-curl clients', function(done) {
        var req = http.request(
            {
                hostname: SERVER_ADDRESS,
                port: SERVER_PORT,
                path: TEST_PATH,
                method: 'HEAD',
                headers: {
                    'user-agent': 'foobar',
                    connection: 'keep-alive'
                }
            },
            function onResponse(res) {
                var responseHeaders = res.headers;

                assert.ok(responseHeaders.hasOwnProperty('content-length'));
                assert.equal(responseHeaders.connection, 'keep-alive');

                // destroy the socket explicitly now since the request was
                // explicitly requesting to not destroy the socket by setting
                // its connection header to 'keep-alive'.
                req.abort();

                done();
            }
        );

        req.on('error', function onReqError(err) {
            assert.ifError(err);
            done();
        });

        req.end();
    });
});
