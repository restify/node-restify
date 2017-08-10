'use strict';

var assert = require('assert-plus');
var GatewayTimeoutError = require('restify-errors').GatewayTimeoutError;

/**
 * Request expiry will use headers to tell if the incoming request has expired.
 * There are two options for this plugin:
 *  1. Absolute Time
 *     * Time in Milliseconds since Epoch when this request should be
 *     considered expired
 *  2. Timeout
 *     * The request start time is supplied
 *     * A timeout, in milliseconds, is given
 *     * The timeout is added to the request start time to arrive at the
 *       absolute time in which the request is considered expired
 * @public
 * @function requestExpiry
 * @param    {Object} opts        an options object
 * @param    {String} opts.absoluteHeader The header key to be used for
 *                                   the expiry time of each request.
 * @param    {String} opts.startHeader The header key for the start time
 *                                   of the request.
 * @param    {String} opts.timeoutHeader The header key for the time in
 *                                   milliseconds that should ellapse before
 *                                   the request is considered expired.
 * @returns  {Function}
 */
function requestExpiry(opts) {
    assert.object(opts, 'opts');
    assert.optionalString(opts.absoluteHeader, 'opts.absoluteHeader');

    if (!opts.absoluteHeader) {
        assert.string(opts.startHeader, 'opts.startHeader');
        assert.string(opts.timeoutHeader, 'opts.timeoutHeader');
    }


    var useAbsolute = (opts.absoluteHeader !== undefined);
    var absoluteHeaderKey = opts.absoluteHeader;
    var startHeaderKey = opts.startHeader;
    var timeoutHeaderKey = opts.timeoutHeader;

    return function requestExpirationCheck(req, res, next) {
        /*
         * Add check expiry API to to req if it doesn't already exist. We only
         * add this the first time this handler is run, since this handler
         * could be used in multiple places in the handler chain.
         */
        if (!req._expiryTime) {
            // if the headers don't exist, then the request will never expire.
            req._expiryTime = Infinity;

            if (useAbsolute) {
                var expiryTime = parseInt(req.headers[absoluteHeaderKey], 10);

                if (!isNaN(expiryTime)) {
                    req._expiryTime = expiryTime;
                }
            } else {
                // Use the start time header and add the timeout header to it
                // to arrive at the expiration time
                var startTime = parseInt(req.headers[startHeaderKey], 10);
                var timeout = parseInt(req.headers[timeoutHeaderKey], 10);

                if (!isNaN(startTime) && !isNaN(timeout)) {
                    req._expiryTime = startTime + timeout;
                }
            }

            req.isExpired = function isExpired() {
                return Date.now() > req._expiryTime;
            };
        }

        if (req.isExpired()) {
            // The request has expired
            return next(new GatewayTimeoutError({
                message: 'Request has expired',
                context: {
                    expiryTime: req._expiryTime,
                    mode: opts.absoluteHeader ? 'absolute' : 'relative'
                }
            }));
        } else {
            // Happy case
            return next();
        }
    };
}

module.exports = requestExpiry;
