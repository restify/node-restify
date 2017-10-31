'use strict';

var assert = require('assert-plus');
var hrTimeDurationInMs = require('./utils/hrTimeDurationInMs');

///--- API

/**
 * The module includes the following plugins to be used with restify's `after`
 * event, e.g., `server.on('after', plugins.metrics());`:
 *
 * A plugin that listens to the server's after event and emits information
 * about that request.
 *
 * @public
 * @function metrics
 * @param {Object} opts - an options obj
 * @param {Server} opts.server - restify server
 * @param {createMetrics~callback} callback - a callback fn
 * @returns {Function} returns a function suitable to be used
 *   with restify server's `after` event
 * @example
 * server.on('after', plugins.metrics(function onMetrics(err, metrics) {
 *      // metrics is an object containing information about the request
 * }));
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
            latency: hrTimeDurationInMs(req._time, process.hrtime()),
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
            connectionState: req.connectionState && req.connectionState(),
            unfinishedRequests:
                opts.server.inflightRequests && opts.server.inflightRequests(),
            inflightRequests:
                opts.server.inflightRequests && opts.server.inflightRequests()
        };

        return callback(err, data, req, res, route);
    };
}

/**
 * Callback used by metrics plugin
 * @callback metrics~callback
 * @param {Error} err
 * @param {Object} metrics - metrics about the request
 * @param {Number} metrics.statusCode status code of the response. can be
 *   undefined in the case of an uncaughtException
 * @param {String} metrics.method http request verb
 * @param {Number} metrics.latency request latency
 * @param {String} metrics.path `req.path()` value
 * @param {Number} metrics.inflightRequests Number of inflight requests pending
 *   in restify.
 * @param {Number} metrics.unifinishedRequests Same as `inflightRequests`
 * @param {String} metrics.connectionState can be either `'close'`,
 *   `'aborted'`, or `undefined`. If this value is set, err will be a
 *   corresponding `RequestCloseError` or `RequestAbortedError`.
 *   If connectionState is either
 *   `'close'` or `'aborted'`, then the `statusCode` is not applicable since the
 *   connection was severed before a response was written.
 * @param {Request} req the request obj
 * @param {Response} res the response obj
 * @param {Route} route the route obj that serviced the request
 */

///-- Exports

module.exports = createMetrics;
