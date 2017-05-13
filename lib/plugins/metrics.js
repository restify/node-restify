'use strict';

var assert = require('assert-plus');


///--- API

/*
 * a plugin that listens to the server's after event and emits information
 * about that request.
 *
 * server.on('after', plugins.metrics(function onMetrics(err, metrics) {
 *     // metrics is an object containing information about the request
 * }));
 * @public
 * @function createMetrics
 * @param {Object} opts an options obj
 * @param {Object} opts.server restify server
 * @param {Function} callback a callback fn
 * @returns {Function} returns a function suitable to be used with restify
 * server's `after` event
 */
function createMetrics(opts, callback) {

    assert.object(opts, 'opts');
    assert.object(opts.server, 'opts.server');
    assert.func(callback, 'callback');

    return function metrics(req, res, route, err) {

        var data = {
            // response status code. in most cases this should be a proper
            // http status code, but in the case of an uncaughtException it can
            // be undefined. otherwise, in most normal scenarios, even calling
            // res.send() or res.end() should result in a 200 by default.
            statusCode: res.statusCode,
            // REST verb
            method: req.method,
            // overall request latency
            latency: Date.now() - req._time,
            // the cleaned up url path
            // e.g., /foo?a=1 => /foo
            path: req.path(),
            // connection state can currently only have the following values:
            // 'close' | 'aborted' | undefined.
            //
            // it is possible to get a 200 statusCode with a connectionState
            // value of 'close' or 'aborted'. i.e., the client timed out,
            // but restify thinks it "sent" a response. connectionState should
            // always be the primary source of truth here, and check it first
            // before consuming statusCode. otherwise, it may result in skewed
            // metrics.
            connectionState: (req.connectionState &&
                             req.connectionState()),
            unfinishedRequests: (opts.server.inflightRequests &&
                                opts.server.inflightRequests()),
            inflightRequests: (opts.server.inflightRequests &&
                                opts.server.inflightRequests())
        };

        return callback(err, data, req, res, route);
    };
}


///-- Exports

module.exports = createMetrics;
