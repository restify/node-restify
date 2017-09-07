'use strict';

var assert = require('assert-plus');
var pidusage = require('pidusage');
var errors = require('restify-errors');
var defaultResponse = errors.ServiceUnavailableError;
var EWMA = require('ewma');

/**
 * cpuUsageThrottle
 *
 * cpuUsageThrottle is a middleware that rejects a variable number of requests
 * (between 0% and 100%) based on a historical view of CPU utilization of a
 * Node.js process. Essentially, this plugin allows you to define what
 * constitutes a saturated Node.js process via CPU utilization and it will
 * handle dropping a % of requests based on that definiton. This is useful when
 * you would like to keep CPU bound tasks from piling up causing an increased
 * per-request latency.
 *
 * The algorithm asks you for a maximum CPU utilization rate, which it uses to
 * determine at what point it should be rejecting 100% of traffic. For a normal
 * Node.js service, this is 1 since Node is single threaded. It uses this,
 * paired with a limit that you provide to determine the total % of traffic it
 * should be rejecting. For example, if you specify a limit of .5 and a max of
 * 1, and the current EWMA (next paragraph) value reads .75, this plugin will
 * reject approximately 50% of all requests.
 *
 * When looking at the process' CPU usage, this algorithm will take a load
 * average over a user specified interval. This is similar to Linux's top. For
 * example, if given an interval of 250ms, this plugin will attempt to record
 * the average CPU utilization over 250ms intervals. Due to contention for
 * resources, the duration of each average may be wider or narrower than 250ms.
 * To compensate for this, we use an exponentially weighted moving average.
 * The EWMA algorithm is provided by the ewma module. The parameter for
 * configuring the EWMA is halfLife. This value controls how quickly each
 * load average measurment decays to half it's value when being represented in
 * the current average. For example, if you have an interval of 250, and a
 * halfLife of 250, you will take the previous ewma value multiplied by  .5 and
 * add it to the new CPU utilization average measurement multiplied by .5. The
 * previous value and the new measurement would each represent 50% of the new
 * value. A good way of thinking about the halfLife is in terms of how
 * responsive this plugin will be to spikes in CPU utilization. The higher the
 * halfLife, the longer CPU utilization will have to remain above your defined
 * limit before this plugin begins rejecting requests and, converserly, the
 * longer it will have to drop below your limit before the plugin begins
 * accepting requests again. This is a knob you will want to with play when
 * trying to determine the ideal value for your use case.
 *
 * For a better understanding of the EWMA algorithn, refer to the documentation
 * for the ewma module.
 *
 * @param {Object} opts Configure this plugin.
 * @param {Number} opts.limit The point at which restify will begin rejecting a
 *    % of all requests at the front door. This value is a percentage like you
 *    would see when running `top` on linux. For example 0.8 === 80%.
 * @param {Number} [opts.max] The point at which restify will reject 100% of all
 *    requests at the front door. This is used in conjunction with limit to
 *    determine what % of traffic restify needs to reject when attempting to
 *    bring the average load back to the user requested values. Since Node.js is
 *    single threaded, the default for this is 1. In some rare cases, a Node.js
 *    process can exceed 100% CPU usage and you will want to update this value.
 * @param {Number} [opts.interval] How frequently to check if we should be
 *    rejecting/accepting connections. It's best to keep this value as low as
 *    possible without creating a significant impact on perfomance in order to
 *    keep your server as responsive to change as possible. Defaults to 250.
 * @param {Number} [opts.halfLife] When we sample the CPU usage on an interval,
 *    we create a series of data points. We take these points and calculate a
 *    moving average. The halfLife indicates how quickly a point "decays" to
 *    half it's value in the moving average. The lower the halfLife, the more
 *    impact newer data points have on the average. If you want to be extremely
 *    responsive to spikes in CPU usage, set this to a lower value. If you want
 *    your process to put more emphasis on recent historical CPU usage when
 *    determininng whether it should shed load, set this to a higher value. The
 *    unit is in ms. The default is to set this to the same value as interval.
 * @param {Error} [opts.err] A restify error used as a response when the
 *    cpu usage limit is exceeded, this should be created with
 *    require('restify-errors').makeConstructor.
 * @returns {Function} middleware to be registered on server.pre
 */
function cpuUsageThrottle (opts) {

    // Scrub input and populate our configuration
    assert.object(opts, 'opts');
    assert.number(opts.limit, 'opts.limit');
    assert.optionalNumber(opts.max, 'opts.max');
    assert.optionalNumber(opts.interval, 'opts.interval');
    assert.optionalNumber(opts.halfLife, 'opts.halfLife');

    if (opts.err !== undefined && opts.err !== null) {
        assert.ok((new opts.err()) instanceof errors.HttpError,
            'opts.err must be an error');
        assert.optionalNumber(opts.err.statusCode, 'opts.err.statusCode');
    }

    var self = {};
    self._err = opts.err || defaultResponse;
    self._limit = opts.limit;
    self._max = opts.max || 1;
    self._interval = opts.interval || 250;
    self._halfLife = (typeof opts.halfLife === 'number') ?
      opts.halfLife : opts.interval;
    self._timeout = null;
    assert.ok(self._max > self._limit, 'limit must be less than max');

    self._ewma = new EWMA(self._halfLife);

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
            // is safe since max > limit so the denominator can never be 0. If
            // the current cpu usage is less that the limit, _reject will be
            // negative and we will never shed load
            self._reject =
                (self._cpu - self._limit) / (self._max - self._limit);
            self._timeout = setTimeout(updateReject, self._interval);
        });
    }

    // Kick off updating our _reject value
    updateReject();

    function onRequest (req, res, next) {
        // Check to see if this request gets rejected. Since, in updateReject,
        // we calculate a percentage of traffic we are planning to reject, we
        // can use Math.random() (which picks from a uniform distribution in
        // [0,1)) to give us a `self._reject`% chance of dropping any given
        // request. This is a stateless was to drop approximatly `self._reject`%
        // of traffic.
        var draw = Math.random();

        if (draw >= self._reject) {
            return next(); // Don't reject this request
        }

        var err = new self._err({
            context: {
                plugin: 'cpuUsageThrottle',
                cpuUsage: self._cpu,
                limit: self._limit,
                max: self._max,
                reject: self._reject,
                halfLife: self._halfLife,
                interval: self._interval,
                draw: draw
            }
        });

        return next(err);
    }

    // Allow the app to clear the timeout for this plugin if necessary, without
    // this we would never be able to clear the event loop when letting Node
    // shut down gracefully
    function close () {
        clearTimeout(self._timeout);
    }
    onRequest.close = close;

    // Expose internal plugin state for introspection
    onRequest.state = self;

    return onRequest;
}

module.exports = cpuUsageThrottle;
