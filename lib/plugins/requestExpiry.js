'use strict';

var assert = require('assert-plus');
var GatewayTimeoutError = require('restify-errors').GatewayTimeoutError;

/**
 * A request expiry will use headers to tell if the
 * incoming request has expired or not. There are two options for this plugin:
 *  1. Absolute Time
 *     * Time in Milliseconds since the Epoch when this request should be
 *       considered expired
 *  2. Timeout
 *     * The request start time is supplied
 *     * A timeout, in milliseconds, is given
 *     * The timeout is added to the request start time to arrive at the
 *       absolute time in which the request is considered expired
 * @public
 * @function requestExpiry
 * @param    {Object} options        an options object
 * @param    {String} options.absoluteHeader The header key to be used for
 *                                   the expiry time of each request.
 * @param    {String} options.startHeader The header key for the start time
 *                                   of the request.
 * @param    {String} options.timeoutHeader The header key for the time in
 *                                   milliseconds that should ellapse before
 *                                   the request is considered expired.
 * @returns  {Function}
 */
function requestExpiry(options) {
    assert.object(options, 'options');
    assert.optionalString(options.absoluteHeader, 'options.absoluteHeader');
    assert.optionalString(options.startHeader, 'options.startHeader');
    assert.optionalString(options.timeoutHeader, 'options.timeoutHeader');

    var useAbsolute = (options.absoluteHeader !== undefined);
    var absoluteHeaderKey = options.absoluteHeader;
    var startHeaderKey = options.startHeader;
    var timeoutHeaderKey = options.timeoutHeader;

    return function requestExpirationCheck(req, res, next) {
        var expiryTime;

        if (useAbsolute) {
            expiryTime = Number(req.headers[absoluteHeaderKey]);
        } else {
            // Use the start time header and add the timeout header to it
            // to arrive at the expiration time
            var startTime = req.headers[startHeaderKey];
            var timeout = req.headers[timeoutHeaderKey];

            if (startTime && timeout) {
                expiryTime = Number(startTime) + Number(timeout);
            }
        }

        if (expiryTime) {

            // The request has expired
            if (Date.now() > expiryTime) {
                return next(new GatewayTimeoutError('Request has expired'));
            }
        }

        // Happy case
        return next();
    };
}

module.exports = requestExpiry;
