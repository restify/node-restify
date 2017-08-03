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
 * @param {Error} opts.res the error object to pass to res.send when the
 *    maximum concurrency is exceeded
 * @param {Number} opts.res.statusCode the status code to return when the
 *    maximum concurrency is exceeded
 * @param {Function} opts.server the instance of the restify server this module
 *    will throttle.
 * @returns {Function} middleware to be registered on server.pre
 */
function inflightRequestThrottle (opts) {

    // Scrub input and populate our configuration
    assert.object(opts, 'opts');
    assert.number(opts.limit, 'opts.limit');
    assert.object(opts.server, 'opts.server');
    assert.func(opts.server.inflightRequests, 'opts.server.inflightRequests');

    if (opts.res !== undefined && opts.res !== null) {
        assert.ok(opts.res instanceof Error, 'opts.res must be an error');
        assert.optionalNumber(opts.res.statusCode, 'opts.res.statusCode');
    }

    var self = {};
    self._res = opts.res || defaultResponse;
    self._limit = opts.limit;
    self._server = opts.server;

    function onRequest (req, res, next) {
        var inflightRequests = self._server.inflightRequests();

        if (inflightRequests > self._limit) {
            req.log.trace({
                plugin: 'inflightRequestThrottle',
                inflightRequests: inflightRequests,
                limit: self._limit
            }, 'maximum inflight requests exceeded, rejecting request');
            return res.send(self._res);
        }

        return next();
    }

    // We need to bind in order to keep our `this` context when passed back
    // out of the constructor.
    return onRequest;
}

inflightRequestThrottle.prototype.onRequest =

module.exports = inflightRequestThrottle;
