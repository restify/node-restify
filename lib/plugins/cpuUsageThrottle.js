'use strict';

var assert = require('assert-plus');
var pidusage = require('pidusage');
var errors = require('restify-errors');
var EWMA = require('ewma');

/**
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
 * average over a user specified interval. example, if given an interval of
 * 250ms, this plugin will attempt to record the average CPU utilization over
 * 250ms intervals. Due to contention for resources, the duration of each
 * average may be wider or narrower than 250ms. To compensate for this, we use
 * an exponentially weighted moving average. The EWMA algorithm is provided by
 * the ewma module. The parameter for configuring the EWMA is halfLife. This
 * value controls how quickly each load average measurment decays to half it's
 * value when being represented in the current average. For example, if you
 * have an interval of 250, and a halfLife of 250, you will take the previous
 * ewma value multiplied by 0.5 and add it to the new CPU utilization average
 * measurement multiplied by 0.5. The previous value and the new measurement
 * would each represent 50% of the new value. A good way of thinking about the
 * halfLife is in terms of how responsive this plugin will be to spikes in CPU
 * utilization. The higher the halfLife, the longer CPU utilization will have
 * to remain above your defined limit before this plugin begins rejecting
 * requests and, converserly, the longer it will have to drop below your limit
 * before the plugin begins accepting requests again. This is a knob you will
 * want to with play when trying to determine the ideal value for your use
 * case.
 *
 * For a better understanding of the EWMA algorithn, refer to the documentation
 * for the ewma module.
 *
 * @public
 * @function cpuUsageThrottle
 * @param {Object} opts - Configure this plugin.
 * @param {Number} [opts.limit] - The point at which restify will begin
 *    rejecting a % of all requests at the front door.
 *    This value is a percentage.
 *    For example 0.8 === 80% average CPU utilization. Defaults to 0.75.
 * @param {Number} [opts.max] - The point at which restify will reject 100% of
 *    all requests at the front door. This is used in conjunction with limit to
 *    determine what % of traffic restify needs to reject when attempting to
 *    bring the average load back to the user requested values. Since Node.js is
 *    single threaded, the default for this is 1. In some rare cases, a Node.js
 *    process can exceed 100% CPU usage and you will want to update this value.
 * @param {Number} [opts.interval] - How frequently we calculate the average CPU
 *    utilization. When we calculate an average CPU utilization, we calculate it
 *    over this interval, and this drives whether or not we should be shedding
 *    load. This can be thought of as a "resolution" where the lower this value,
 *    the higher the resolution our load average will be and the more frequently
 *    we will recalculate the % of traffic we should be shedding. This check
 *    is rather lightweight, while the default is 250ms, you should be able to
 *    decrease this value without seeing a significant impact to performance.
 * @param {Number} [opts.halfLife] - When we sample the CPU usage on an
 *    interval, we create a series of data points.
 *    We take these points and calculate a
 *    moving average. The halfLife indicates how quickly a point "decays" to
 *    half it's value in the moving average. The lower the halfLife, the more
 *    impact newer data points have on the average. If you want to be extremely
 *    responsive to spikes in CPU usage, set this to a lower value. If you want
 *    your process to put more emphasis on recent historical CPU usage when
 *    determininng whether it should shed load, set this to a higher value. The
 *    unit is in ms. Defaults to 250.
 * @returns {Function} middleware to be registered on server.pre
 * @example
 * var restify = require('restify');
 *
 * var server = restify.createServer();
 * const options = {
 *   limit: .75,
 *   max: 1,
 *   interval: 250,
 *   halfLife: 500,
 * }
 *
 * server.pre(restify.plugins.cpuUsageThrottle(options));
 * @example
 * <caption>
 * You can also update the plugin during runtime using the `.update()` function.
 * This function accepts the same `opts` object as a constructor.
 * </caption>
 * var plugin = restify.plugins.cpuUsageThrottle(options);
 * server.pre(plugin);
 *
 * plugin.update({ limit: .4, halfLife: 5000 });
 */
function cpuUsageThrottlePlugin(opts) {
    // Scrub input and populate our configuration
    assert.object(opts, 'opts');
    assert.optionalNumber(opts.limit, 'opts.limit');
    assert.optionalNumber(opts.max, 'opts.max');
    assert.optionalNumber(opts.interval, 'opts.interval');
    assert.optionalNumber(opts.halfLife, 'opts.halfLife');

    var plugin = {};
    plugin._limit = typeof opts.limit === 'number' ? opts.limit : 0.75;
    plugin._max = opts.max || 1;
    plugin._interval = opts.interval || 250;
    plugin._halfLife = typeof opts.halfLife === 'number' ? opts.halfLife : 250;
    assert.ok(plugin._max > plugin._limit, 'limit must be less than max');

    plugin._ewma = new EWMA(plugin._halfLife);

    // plugin._reject represents the % of traffic that we should reject at the
    // current point in time based on how much over our limit we are. This is
    // updated on an interval by updateReject().
    plugin._reject = 0;

    // plugin._timeout keeps track of the current handle for the setTimeout we
    // use to gather CPU load averages, this allows us to cancel the timeout
    // when shutting down restify.
    plugin._timeout = null;

    // plugin._timeoutDelta represents the amount of time between when we
    // _should_ have run updateReject and the actual time it was invoked.
    // This allows us to monitor lag caused by both the event loop
    // and pidusage
    plugin._timeoutDelta = 0;
    plugin._timeoutStart = Date.now();

    // updateReject should be called on an interval, it checks the average CPU
    // usage between two invocations of updateReject.
    function updateReject() {
        pidusage(process.pid, function pidusageStat(e, stat) {
            // Requeue an updateReject irrespective of whether or not pidusage
            // encountered an error
            plugin._timeout = setTimeout(updateReject, plugin._interval);

            // If we were unable to get cpu usage, don't make any new decisions.
            if (
                !stat ||
                typeof stat.cpu !== 'number' ||
                Number.isNaN(stat.cpu)
            ) {
                return;
            }

            // Divide by 100 to match Linux's `top` format
            plugin._ewma.insert(stat.cpu / 100);
            plugin._cpu = plugin._ewma.value();

            // Update reject with the % of traffic we should be rejecting. This
            // is safe since max > limit so the denominator can never be 0. If
            // the current cpu usage is less that the limit, _reject will be
            // negative and we will never shed load
            plugin._reject =
                (plugin._cpu - plugin._limit) / (plugin._max - plugin._limit);

            // Calculate how long it took between when our interval should have
            // updated the _reject value and how long it actually took. This
            // metric accounts for the misbehaviour of pidusage
            var now = Date.now();
            plugin._timeoutDelta =
                now - plugin._timeoutStart - plugin._interval;
            plugin._timeoutStart = now;
        });
    }

    // Kick off updating our _reject value
    updateReject();

    function cpuUsageThrottle(req, res, next) {
        // Check to see if this request gets rejected. Since, in updateReject,
        // we calculate a percentage of traffic we are planning to reject, we
        // can use Math.random() (which picks from a uniform distribution in
        // [0,1)) to give us a `plugin._reject`% chance of dropping any given
        // request. This is a stateless was to drop approximatly
        // `plugin._reject`% of traffic.
        var probabilityDraw = Math.random();

        if (probabilityDraw >= plugin._reject) {
            return next(); // Don't reject this request
        }

        var err = new errors.ServiceUnavailableError({
            context: {
                plugin: 'cpuUsageThrottle',
                cpuUsage: plugin._cpu,
                limit: plugin._limit,
                max: plugin._max,
                reject: plugin._reject,
                halfLife: plugin._halfLife,
                interval: plugin._interval,
                probabilityDraw: probabilityDraw,
                lag: plugin._timeoutDelta
            }
        });

        return next(err);
    }

    // Allow the app to clear the timeout for this plugin if necessary, without
    // this we would never be able to clear the event loop when letting Node
    // shut down gracefully
    function close() {
        clearTimeout(plugin._timeout);
    }
    cpuUsageThrottle.close = close;

    // Expose internal plugin state for introspection
    Object.defineProperty(cpuUsageThrottle, 'state', {
        get: function get() {
            // We intentionally do not expose ewma since we don't want the user
            // to be able to update it's configuration, the current state of
            // ewma is represented in plugin._cpu
            return {
                limit: plugin._limit,
                max: plugin._max,
                interval: plugin._interval,
                halfLife: plugin._halfLife,
                cpuUsage: plugin._cpu,
                reject: plugin._reject,
                lag: plugin._timeoutDelta
            };
        }
    });

    /**
     * cpuUsageThrottle.update
     *
     * Allow the plugin's configuration to be updated during runtime.
     *
     * @private
     * @param {Object} newOpts - The opts object for reconfiguring this plugin,
     *    it follows the same format as the constructor for this plugin.
     * @returns {undefined} no return value
     */
    cpuUsageThrottle.update = function update(newOpts) {
        assert.object(newOpts, 'newOpts');
        assert.optionalNumber(newOpts.limit, 'newOpts.limit');
        assert.optionalNumber(newOpts.max, 'newOpts.max');
        assert.optionalNumber(newOpts.interval, 'newOpts.interval');
        assert.optionalNumber(newOpts.halfLife, 'newOpts.halfLife');

        if (newOpts.limit !== undefined) {
            plugin._limit = newOpts.limit;
        }

        if (newOpts.max !== undefined) {
            plugin._max = newOpts.max;
        }

        if (newOpts.interval !== undefined) {
            plugin._interval = newOpts.interval;
        }

        if (newOpts.halfLife !== undefined) {
            plugin._halfLife = newOpts.halfLife;
            // update our ewma with the new halfLife, we use the previous known
            // state as the initial state for our new halfLife in lieu of
            // having access to true historical data.
            plugin._ewma = new EWMA(plugin._halfLife, plugin._cpu);
        }

        // Ensure new values are still valid
        assert.ok(plugin._max > plugin._limit, 'limit must be less than max');

        // Update _reject with the new settings
        plugin._reject =
            (plugin._cpu - plugin._limit) / (plugin._max - plugin._limit);
    };

    return cpuUsageThrottle;
}

module.exports = cpuUsageThrottlePlugin;
