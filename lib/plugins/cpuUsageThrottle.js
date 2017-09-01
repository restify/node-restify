'use strict';

var assert = require('assert-plus');
var pidusage = require('pidusage');
var ServiceUnavailableError = require('restify-errors').ServiceUnavailableError;
var defaultResponse = new ServiceUnavailableError('resource exhausted');

/**
 * cpuUsageThrottle
 *
 * Place an upper limit on the CPU usage for this process. Once this limit is
 * exceeded, restify will begin rejecting requests at the front door. This
 * module can be used as a rough but effective way to prevent requests piling
 * up on a Node.js process, causing increased latencies. The CPU usage is a
 * percentage like you would see when running `top` on Linux. For example, if
 * you provide .8, restify will begin rejecting requests when the server
 * reaches 80% usage. The method we use for calculating the CPU usage will work
 * across platforms. The tighter the interval, the more leanient you should be
 * with your upper limit.
 *
 * @param {Object} opts Configure this plugin.
 * @param {Number} opts.limit Maximum CPU usage before restify begins rejecting
 *    requests at the front door, this is a %, for example .8 === 80%.
 * @param {Number} opts.interval How frequently to check if we should be
 *    rejecting/accepting connections. It's best to keep this value as low as
 *    possible without creating a significant impact on perfomance in order to
 *    keep your server as responsive to change as possible.
 * @param {Error} [opts.err] A restify error used as a response when the
 *    cpu usage limit is exceeded
 * @returns {Function} middleware to be registered on server.pre
 */
function cpuUsageThrottle (opts) {

    // Scrub input and populate our configuration
    assert.object(opts, 'opts');
    assert.number(opts.limit, 'opts.limit');
    assert.number(opts.interval, 'opts.interval');

    if (opts.err !== undefined && opts.err !== null) {
        assert.ok(opts.err instanceof Error, 'opts.err must be an error');
        assert.optionalNumber(opts.err.statusCode, 'opts.err.statusCode');
    }

    var self = {};
    self._err = opts.err || defaultResponse;
    self._limit = opts.limit;
    self._interval = opts.interval;
    self._cpu = NaN;
    self._reject = false;
    self._timeout = null;

    // updateReject should be called on an interval, it checks the average CPU
    // usage over the interval and determines whether or not the process should
    // be shedding load
    function updateReject() {
        pidusage.stat(function (e, stat) {
            // If we fail to stat for whatever reason, err on the side of
            // accepting traffic, while failure probably indicates something
            // horribly wrong with the server, identifying this error case and
            // appropriately responding is way outside the scope of this plugin
            if (e) {
                // By setting cpu to NaN, _reject will be false
                stat = { cpu: NaN };
            }

            // Cache cpu usage so we can log metadata when rejecting requests
            // Divide by 100 to match linux's top format
            self._cpu = stat.cpu / 100;
            // Update reject
            self._reject = self.cpu > self._limit;
            self._timeout = setTimeout(updateReject, self._interval);
        });
    }

    // Kick off updating our _reject value
    updateReject();

    function onRequest (req, res, next) {
        // Check to see if we should be rejecting requests
        if (self._reject) {
            // If so, log some metadata and return an error
            req.log.trace({
                plugin: 'cpuUsageThrottle',
                cpuUsage: self._cpu,
                limit: self._limit
            }, 'maximum cpu usage exceeded, rejecting request');
            res.send(self._err);
            return next(false);
        }

        // otherwise continue
        return next();
    }

    // Allow the app to clear the timeout for this plugin if necessary, without
    // this we would never be able to clear the event loop when letting Node
    // shut down gracefully
    function close () {
        clearTimeout(self._timeout);
    }
    onRequest.close = close;

    return onRequest;
}

module.exports = cpuUsageThrottle;
