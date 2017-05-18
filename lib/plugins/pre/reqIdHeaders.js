'use strict';

var assert = require('assert-plus');

var DEFAULT_HEADERS = ['request-id', 'x-request-id'];


/**
 * Automatically reuse incoming request header as the request id.
 * @public
 * @function createReqIdHeaders
 * @param {Object} opts an options object
 * @param {Array} opts.headers array of headers from where to pull existing
 * request id headers
 * @returns {Function}
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
