'use strict';

var assert = require('assert-plus');

var DEFAULT_HEADERS = ['request-id', 'x-request-id'];

/**
 * This plugin pulls the value from an incoming request header and uses it
 * as the value of the request id. Subsequent calls to `req.id()`
 * will return the header values.
 *
 * @public
 * @function reqIdHeaders
 * @param {Object}   opts - an options object
 * @param {String[]} opts.headers - array of headers from where to pull existing
 *                                request id headers. Lookup precedence
 *                                is left to right (lowest index first)
 * @returns {Function} Handler
 */
function createReqIdHeaders(opts) {
    assert.object(opts, 'opts');
    assert.arrayOfString(opts.headers, 'opts.headers');

    var headers = opts.headers.concat(DEFAULT_HEADERS);

    return function reqIdHeaders(req, res, next) {
        for (var i = 0; i < headers.length; i++) {
            var val = req.header(headers[i]);

            if (val) {
                req.id(val);
                break;
            }
        }

        return next();
    };
}

///--- Exports

module.exports = createReqIdHeaders;
