'use strict';

var assert = require('assert-plus');
var GatewayTimeoutError = require('./../errors').GatewayTimeoutError;

/**
 * A request expiry will use the headers to tell if the
 * incoming request has expired or not.  The header is
 * expected to be in absolute time.
 */
function requestExpiry(options) {
    assert.object(options, 'options');
    assert.string(options.header, 'options.header');
    var headerKey = options.header;

    return function(req, res, next) {
        var expiryTime = Number(req.headers[headerKey]);

        // The request has expired
        if (expiryTime !== undefined && Date.now() > expiryTime) {
            return next(new GatewayTimeoutError('Request has expired'));
        }

        // Happy case
        return next();
    };
}

module.exports = requestExpiry;
