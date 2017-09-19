'use strict';

var assert = require('assert-plus');
var errors = require('restify-errors');
var EWMA = require('ewma');

/**
 * genericThrottle
 *
 * genericThrottle is a middleware that can be used to specify an arbitrary
 * metric to throttle traffic against. This plugin allows you to define what
 * constitutes a saturated Node.js process and it will handle dropping a % of
 * requests based on that definition. This is useful when you want to maintain
 * a per-request SLA.
 *
 * The algorithm asks you for a maximum value, which it uses to determine at
 * which point a process is 100% saturated causing it to drop 100% of traffic.
 * It also asks for an initial limit, which is where it begins rejecting
 * traffic. For example, if you specify a limit of .5 and a max of 1, and the
 * current EWMA (next paragraph) value reads .75, this plugin will reject
 * approximately 50% of all requests.
 *
 * When looking at a metric, this algorithm will take an average over a user
 * specified interval. For example, if given an interval of 250ms, this plugin
 * will attempt to call your provided metric handler every 250ms. Due to
 * contention for resources, and how fast your handler can return a result, the
 * duration of each average may be wider or narrower than the provided interval.
 * To compensate for this, we use an exponentially weighted moving average. The
 * EWMA algorithm is provided by the ewma module, which should be consulted if
 * you wish to have an indepth understanding of the behaviour of this algorithm.
 * The parameter for configuring the EMWA is halfLife. This value controls how
 * quickly each reported metric "decays" to half of it's value when being
 * represented in the current average. For example, if you have an interval of
 * 250, and a halfLife of 250, you will take the previous ewma value multiplied
 * by .5 and add it to the new metric's value multiplied by .5 to get the new
 * EWMA value. In this scenario, each value will represent exactly 50% of the
 * new EWMA if the interval is met exactly.
 *
 * A good way of thinking about the halfLife is in terms of how responsive this
 * plugin is to spikes in your metric data. The higher the halfLife, the less
 * responsive this plugin will be to changes in your provided metric. This is
 * a knob you will want to play with when trying to determine the ideal value
 * for your use case.
 *
 * @param {Object} opts Configure this plugin.
 * @param {Number} [opts.limit] The point at which restify will begin rejecting
 *    a % of all requests at the front door.
 * @param {Number} [opts.max] The point at which restify will reject 100% of all
 *    requests at the front door. This is used in conjunction with limit to
 *    determine what % of traffic restify will reject.
 * @param {Number} [opts.interval] How frequently we update our EWMA.
 * @param {Number} [opts.halfLife] How quickly measurments decay in the EWMA.
 * @param {Function} opts.getMetric This function will be invoked when this
 *    plugin needs a new measurement. The only parameter to this function will
 *    be an error first callback. Provide it with an error if you can't take
 *    the measurement or cb(null, measurment) if you can.
 * @returns {Function} middleware to be registered on server.pre
 */
function genericThrottlePlugin (opts) {

    // Scrub input and populate our configuration
    assert.object(opts, 'opts');
    assert.number(opts.limit, 'opts.limit');
    assert.number(opts.max, 'opts.max');
    assert.number(opts.interval, 'opts.interval');
    assert.number(opts.halfLife, 'opts.halfLife');
    assert.func(opts.getMetric, 'opts.getMetric');

    var self = {};
    self._limit = opts.limit;
    self._max = opts.max;
    self._interval = opts.interval;
    self._halfLife = opts.halfLife;
    self._getMetric = opts.getMetric;
    assert.ok(self._max > self._limit, 'limit must be less than max');

    self._ewma = new EWMA(self._halfLife);

    // self._reject represents the % of traffic that we should reject at the
    // current point in time based on how much over our limit we are. This is
    // updated on an interval by updateReject().
    self._reject = 0;

    // self._timeout keeps track of the current handle for the setTimeout we
    // use to gather metric averages, this allows us to cancel the timeout when
    // shutting down restify.
    self._timeout = null;

    // self._timeoutDelta represents the amount of time between when we _should_
    // have run updateReject and the actual time it was invoked. This allows
    // us to monitor lag caused by both the event loop and _getMetric.
    self._timeoutDelta = 0;
    self._timeoutStart = Date.now();

    function updateReject() {
        self._getMetric(function (e, metric) {
            // Requeue an updateReject irrespective of whether or not getMetric
            // encountered an error
            self._timeout = setTimeout(updateReject, self._interval);

            // If we were unable to get the metric, don't new decisions.
            if (e ||
                typeof metric !== 'number' ||
                Number.isNaN(metric)) {
                return;
            }

            self._ewma.insert(metric);
            self._metric = self._ewma.value();

            // Update reject with the % of traffic we should be rejecting. This
            // is safe since max > limit so the denominator can never be 0. If
            // the current metric is less that the limit, _reject will be
            // negative and we will never shed load
            self._reject =
                (self._metric - self._limit) / (self._max - self._limit);

            // Calculate how long it took between when our interval should have
            // updated the _reject value and how long it actually took.
            var now = Date.now();
            self._timeoutDelta = now - self._timeoutStart;
            self._timeoutStart = now;
        });
    }

    // Kick off updating our _reject value
    updateReject();

    function genericThrottle (req, res, next) {
        // Check to see if this request gets rejected. Since, in updateReject,
        // we calculate a percentage of traffic we are planning to reject, we
        // can use Math.random() (which picks from a uniform distribution in
        // [0,1)) to give us a `self._reject`% chance of dropping any given
        // request. This is a stateless was to drop approximatly `self._reject`%
        // of traffic.
        var probabilityDraw = Math.random();

        if (probabilityDraw >= self._reject) {
            return next(); // Don't reject this request
        }

        var context = genericThrottle.state;
        context.probabilityDraw = probabilityDraw;
        context.plugin = genericThrottle.name;
        var err = new errors.ServiceUnavailableError({
            context: context
        });

        return next(err);
    }

    // Allow the app to clear the timeout for this plugin if necessary, without
    // this we would never be able to clear the event loop when letting Node
    // shut down gracefully
    function close () {
        clearTimeout(self._timeout);
    }
    genericThrottle.close = close;

    // Expose internal plugin state for introspection
    Object.defineProperty(genericThrottle, 'state', {
        get: function () {
            // We intentionally do not expose ewma since we don't want the user
            // to be able to update it's configuration, the current state of
            // ewma is represented in self._metric
            return {
                limit: self._limit,
                max: self._max,
                interval: self._interval,
                halfLife: self._halfLife,
                metric: self._metric,
                reject: self._reject,
                lag: self._timeoutDelta
            };
        },
        configurable: true
    });

    /**
     * genericThrottle.update
     *
     * Allow the plugin's configuration to be updated during runtime.
     *
     * @param {Object} newOpts The opts object for reconfiguring this plugin,
     *    it follows the same format as the constructor for this plugin.
     * @returns {undefined}
     */
    genericThrottle.update = function update(newOpts) {
        assert.object(newOpts, 'newOpts');
        assert.optionalNumber(newOpts.limit, 'newOpts.limit');
        assert.optionalNumber(newOpts.max, 'newOpts.max');
        assert.optionalNumber(newOpts.interval, 'newOpts.interval');
        assert.optionalNumber(newOpts.halfLife, 'newOpts.halfLife');

        if (newOpts.limit !== undefined) {
            self._limit = newOpts.limit;
        }

        if (newOpts.max !== undefined) {
            self._max = newOpts.max;
        }

        if (newOpts.interval !== undefined) {
            self._interval = newOpts.interval;
        }

        if (newOpts.halfLife !== undefined) {
            self._halfLife = newOpts.halfLife;
            // update our ewma with the new halfLife, we use the previous known
            // state as the initial state for our new halfLife in lieu of
            // having access to true historical data.
            self._ewma = new EWMA(self._halfLife, self._metric);
        }

        // Ensure new values are still valid
        assert.ok(self._max > self._limit, 'limit must be less than max');

        // Update _reject with the new settings
        self._reject =
            (self._metric - self._limit) / (self._max - self._limit);
    };

    return genericThrottle;
}

module.exports = genericThrottlePlugin;
