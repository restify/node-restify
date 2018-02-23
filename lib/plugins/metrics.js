'use strict';

var assert = require('assert-plus');
var hrTimeDurationInMs = require('./utils/hrTimeDurationInMs');

/**
 * Timing internals
 *
 * Timings are also saved when there is no handler in the given category.
 * Some handler categories are optional, for example there is no
 * `use` and `route` for 404.
 *
 * @private
 *
 * req._timeStart      - request lifecycle started in restify
 * req._timePreStart   - pre handlers started
 * req._timePreEnd     - all pre handlers finished
 * req._timeUseStart   - use handlers started
 * req._timeUseEnd     - all use handlers finished
 * req._timeRouteStart - route handlers started
 * req._timeRouteEnd   - all route handlers finished
 * req._timeFlushed    - request flushed, may happens before handlers finished
 * req._timeFinished   - both all handlers finished and request flushed
 */

///--- API

/**
 * The module includes the following plugins to be used with restify's `after`
 * event, e.g., `server.on('after', restify.plugins.metrics());`:
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
 * server.on('after', restify.plugins.metrics({ server: server },
 *     function (err, metrics, req, res, route) {
 *         // metrics is an object containing information about the request
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
            totalLatency: hrTimeDurationInMs(req._timeStart, req._timeFinished),
            latency: hrTimeDurationInMs(req._timeStart, req._timeFlushed),
            preLatency: hrTimeDurationInMs(req._timePreStart, req._timePreEnd),
            useLatency: hrTimeDurationInMs(req._timeUseStart, req._timeUseEnd),
            routeLatency: hrTimeDurationInMs(
                req._timeRouteStart,
                req._timeRouteEnd
            ),
            // the cleaned up url path
            // e.g., /foo?a=1 => /foo
            path: req.path(),
            // connection state can currently only have the following values:
            // 'close' | undefined.
            //
            // if the connection state is 'close'
            // the status code will be set to 444
            // it is possible to get a 200 statusCode with a connectionState
            // value of 'close'. i.e., the client timed out,
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
 * @param {Number} metrics.totalLatency latency includes both request is flushed
 *                                      and all handlers finished
 * @param {Number} metrics.latency latency when request is flushed
 * @param {Number|null} metrics.preLatency pre handlers latency
 * @param {Number|null} metrics.useLatency use handlers latency
 * @param {Number|null} metrics.routeLatency route handlers latency
 * @param {String} metrics.path `req.path()` value
 * @param {Number} metrics.inflightRequests Number of inflight requests pending
 *   in restify.
 * @param {Number} metrics.unifinishedRequests Same as `inflightRequests`
 * @param {String} metrics.connectionState can be either `'close'` or
 *  `undefined`. If this value is set, err will be a
 *   corresponding `RequestCloseError`.
 *   If connectionState is either
 *   `'close'`, then the `statusCode` is not applicable since the
 *   connection was severed before a response was written.
 * @param {Request} req the request obj
 * @param {Response} res the response obj
 * @param {Route} route the route obj that serviced the request
 */

///-- Exports

module.exports = createMetrics;
