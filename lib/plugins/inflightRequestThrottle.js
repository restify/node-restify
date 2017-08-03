'use strict';

var assert = require('assert-plus');
var ServiceUnavailableError = require('restify-errors').ServiceUnavailableError;
var defaultResponse = new ServiceUnavailableError('resource exhausted');

/**
 * inflightRequestThrottle
 *
 * @param {Object} opts configure this plugin
 * @param {Number} opts.limit maximum number of simultanenous
 *    connections the server will handle before returning an error
 * @param {Error} opts.resp the error object to pass to res.send when the
 *    maximum concurrency is exceeded
 * @param {Number} opts.resp.statusCode the status code to return when the
 *    maximum concurrency is exceeded
 * @param {Function} opts.server.inflightRequests A function that, when
 *    invoked, returns the number of requests currently being handled by the
 *    server.
 * @returns {Function} middleware to be registered on server.pre
 */
function inflightRequestThrottle (opts) {
    // Be nice to our users and let them drop the `new` keyword
    if (!(this instanceof inflightRequestThrottle)) {
        return new inflightRequestThrottle(opts); //jscs:ignore
    }
    var self = this;

    // Scrub input and populate our configuration
    assert.object(opts, 'opts');
    assert.number(opts.limit, 'opts.limit');
    assert.object(opts.server, 'opts.server');
    assert.func(opts.server.inflightRequests, 'opts.server.inflightRequests');

    if (opts.resp !== undefined && opts.resp !== null) {
        assert.ok(opts.resp instanceof Error, 'opts.resp must be an error');
        assert.optionalNumber(opts.resp.statusCode, 'opts.resp.statusCode');
    }

    self._resp = opts.resp || defaultResponse;
    self._limit = opts.limit;
    self._server = opts.server;

    // We need to bind in order to keep our `this` context when passed back
    // out of the constructor.
    return self.onRequest.bind(self);
}

inflightRequestThrottle.prototype.onRequest =
function onRequest (req, res, next) {
    var self = this;
    var inflightRequests = self._server.inflightRequests();

    if (inflightRequests > self._limit) {
        req.log.trace({
            plugin: 'inflightRequestThrottle',
            inflightRequests: inflightRequests,
            limit: self._limit
        }, 'maximum inflight requests exceeded, rejecting request');
        return res.send(self._resp);
    }

    return next();
};

module.exports = inflightRequestThrottle;
