'use strict';

var assert = require('assert-plus');
var pidusage = require('pidusage');
var ServiceUnavailableError = require('restify-errors').ServiceUnavailableError;
var defaultResponse = new ServiceUnavailableError('resource exhausted');
var EWMA = require('ewma')

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
 * @param {Number} opts.limit The point at which restify will begin rejecting a
 *    % of all requests at the front door. This value is a percentage like you
 *    would see when running `top` on linux. For example .8 === 80%.
 * @param {Number} opts.max The point at which restify will reject 100% of all
 *    requests at the front door. This is used in conjunction with limit to
 *    determine what % of traffic restify needs to reject when attempting to
 *    bring the average load back within tolerable thresholds. Since Node.js is
 *    single threaded, the default for this is 1. In some rare cases, a Node.js
 *    process can exceed 100% CPU usage and you will want to update this value.
 * @param {Number} opts.interval How frequently to check if we should be
 *    rejecting/accepting connections. It's best to keep this value as low as
 *    possible without creating a significant impact on perfomance in order to
 *    keep your server as responsive to change as possible.
 * @param {Number} opts.halfLife When we sample the CPU usage on an interval,
 *    we create a series of data points. We take these points and calculate a
 *    moving average. The halfLife indicates how quickly a point "decays" to
 *    half it's value in the moving average. The lower the halfLife, the more
 *    impact newer data points have on the average. If you want to be extremely
 *    responsive to spikes in CPU usage, set this to a lower value. If you want
 *    your process to put more emphasis on recent historical CPU usage when
 *    determininng whether it should shed load, set this to a higher value. The
 *    unit is in ms. The default is to set this to the same value as interval.
 * @param {Error} [opts.err] A restify error used as a response when the
 *    cpu usage limit is exceeded
 * @returns {Function} middleware to be registered on server.pre
 */
function cpuUsageThrottle (opts) {

    // Scrub input and populate our configuration
    assert.object(opts, 'opts');
    assert.number(opts.limit, 'opts.limit');
    assert.optionalNumber(opts.max, 'opts.max');
    assert.number(opts.interval, 'opts.interval');
    assert.optionalNumber(opts.halfLife, 'opts.halfLife');

    if (opts.err !== undefined && opts.err !== null) {
        assert.ok(opts.err instanceof Error, 'opts.err must be an error');
        assert.optionalNumber(opts.err.statusCode, 'opts.err.statusCode');
    }

    var self = {};
    self._err = opts.err || defaultResponse;
    self._limit = opts.limit;
    self._max = opts.max || 1;
    self._interval = opts.interval;
    self._halfLife = (typeof opts.halfLife === 'number') ?
      opts.halfLife : opts.interval;
    self._timeout = null;
    assert.ok(self._max > self._limit, 'limit must be less than max');

    // We start at 0 to compensate for the initial spike in CPU usage a server
    // experiences when starting up.
    self._ewma = new EWMA(self._halfLife, 0);

    // self._reject represents the % of traffic that we should reject at the
    // current point in time based on how much over our limit we are. This is
    // updated on an interval by updateReject().
    self._reject = 0;

    // updateReject should be called on an interval, it checks the average CPU
    // usage between two invocations of updateReject.
    function updateReject() {
        pidusage.stat(process.pid, function (e, stat) {
            // If we fail to stat for whatever reason, err on the side of
            // accepting traffic, while failure probably indicates something
            // horribly wrong with the server, identifying this error case and
            // appropriately responding is way outside the scope of this plugin
            if (e) {
                // When cpu is NaN, we should never reject
                stat = { cpu: NaN };
            }

            // Divide by 100 to match linux's top format
            self._cpu = stat.cpu / 100;
            // Update reject with the % of traffic we should be rejecting. This
            // is safe since max > limit so it can never be division by 0. If
            // the current cpu usage is less that the limit, _reject will be
            // negative and we will never shed load
            self._reject = (self._cpu - self._limit) / (self._max - self._limit)
            self._timeout = setTimeout(updateReject, self._interval);
        });
    }

    // Kick off updating our _reject value
    updateReject();

    function onRequest (req, res, next) {
        // Check to see if this request gets rejected
        if (self._reject > Math.random()) {
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
