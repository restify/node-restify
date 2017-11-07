'use strict';

var BadRequestError = require('restify-errors').BadRequestError;
var assert = require('assert-plus');

///--- API

/**
 * Prevents `req.urls` non-strict key-value query params
 *
 * The Request-URI is transmitted in the format specified in section 3.2.1.
 * If the Request-URI is encoded using the "% HEX HEX" encoding [42],
 * the origin server MUST decode the Request-URI
 * in order to properly interpret the request.
 * Servers SHOULD respond to invalid Request-URIs
 * with an appropriate status code.
 *
 * part of Hypertext Transfer Protocol -- HTTP/1.1 | 5.1.2 Request-URI
 * RFC 2616 Fielding, et al.
 *
 * @public
 * @function strictQueryParams
 * @param    {Object}   [options] - an options object
 * @param    {String}   [options.message] - a custom error message
 *                              default value:
 *                              "Url query params does not meet strict format"
 * @returns  {Function} Handler
 */
function strictQueryParams(options) {
    var opts = options || {};
    assert.optionalObject(opts, 'options');
    assert.optionalString(opts.message, 'options.message');

    function _strictQueryParams(req, res, next) {
        var keyValQParams = !/(\&(?!(\w+=\w+)))/.test(req.url);

        if (!keyValQParams) {
            var msg = opts.message
                ? opts.message
                : 'Url query params does not meet strict format';
            return next(new BadRequestError(msg));
        }

        return next();
    }

    return _strictQueryParams;
}

///--- Exports

module.exports = strictQueryParams;
