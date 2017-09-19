'use strict';

var assert = require('assert-plus');
var pidusage = require('pidusage');
var genericThrottle = require('./genericThrottle.js');

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
 * @param {Object} opts Configure this plugin.
 * @param {Number} [opts.limit] The point at which restify will begin rejecting
 *    a % of all requests at the front door. This value is a percentage.
 *    For example 0.8 === 80% average CPU utilization. Defaults to 0.75.
 * @param {Number} [opts.max] The point at which restify will reject 100% of all
 *    requests at the front door. This is used in conjunction with limit to
 *    determine what % of traffic restify needs to reject when attempting to
 *    bring the average load back to the user requested values. Since Node.js is
 *    single threaded, the default for this is 1. In some rare cases, a Node.js
 *    process can exceed 100% CPU usage and you will want to update this value.
 * @param {Number} [opts.interval] How frequently we calculate the average CPU
 *    utilization. When we calculate an average CPU utilization, we calculate it
 *    over this interval, and this drives whether or not we should be shedding
 *    load. This can be thought of as a "resolution" where the lower this value,
 *    the higher the resolution our load average will be and the more frequently
 *    we will recalculate the % of traffic we should be shedding. This check
 *    is rather lightweight, while the default is 250ms, you should be able to
 *    decrease this value without seeing a significant impact to performance.
 * @param {Number} [opts.halfLife] When we sample the CPU usage on an interval,
 *    we create a series of data points. We take these points and calculate a
 *    moving average. The halfLife indicates how quickly a point "decays" to
 *    half it's value in the moving average. The lower the halfLife, the more
 *    impact newer data points have on the average. If you want to be extremely
 *    responsive to spikes in CPU usage, set this to a lower value. If you want
 *    your process to put more emphasis on recent historical CPU usage when
 *    determininng whether it should shed load, set this to a higher value. The
 *    unit is in ms. Defaults to 250.
 * @returns {Function} middleware to be registered on server.pre
 */
function cpuUsageThrottle (opts) {
    // Scrub input and populate our configuration
    assert.object(opts, 'opts');
    assert.optionalNumber(opts.limit, 'opts.limit');
    assert.optionalNumber(opts.max, 'opts.max');
    assert.optionalNumber(opts.interval, 'opts.interval');
    assert.optionalNumber(opts.halfLife, 'opts.halfLife');

    var self = {};
    self.limit = (typeof opts.limit === 'number') ?
        opts.limit : 0.75;
    self.max = opts.max || 1;
    self.interval = opts.interval || 250;
    self.halfLife = (typeof opts.halfLife === 'number') ? opts.halfLife : 250;
    assert.ok(self.max > self.limit, 'limit must be less than max');
    self.getMetric = function getMetric(cb) {
        pidusage.stat(process.pid, function (e, stat) {
            return cb(e, stat.cpu / 100);
        });
    };

    // Please look away

    // We are just a wrapper around the genericThrottle
    self = genericThrottle(self);
    // Set our name to cpuUsageThrottle for server.debuginfo
    Object.defineProperty(self, 'name', { value: 'cpuUsageThrottle' });

    // Expose internal plugin state for introspection, we need to capture the
    // parent's state getter and then modify it for our own needs
    var parentState = Object.getOwnPropertyDescriptor(self, 'state').get;

    Object.defineProperty(self, 'state', {
        get: function () {
            var state = parentState();
            state.cpuUsage = state.metric;
            delete state.metric;
            return state;
        }
    });

    return self;
}

module.exports = cpuUsageThrottle;
