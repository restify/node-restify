// Copyright 2013 Mark Cavage, Inc.  All rights reserved.

'use strict';

var assert = require('assert-plus');


///--- Globals

var ALLOW_HEADERS = [
    'accept',
    'accept-version',
    'content-type',
    'request-id',
    'origin',
    'x-api-version',
    'x-request-id'
];

var EXPOSE_HEADERS = [
    'api-version',
    'content-length',
    'content-md5',
    'content-type',
    'date',
    'request-id',
    'response-time'
];

// Normal
var AC_ALLOW_ORIGIN = 'Access-Control-Allow-Origin';
var AC_ALLOW_CREDS = 'Access-Control-Allow-Credentials';
var AC_EXPOSE_HEADERS = 'Access-Control-Expose-Headers';


///--- Internal Functions

// turn a string defining an allowed domain into a regex
function toRegExp(str) {
    if (str instanceof RegExp) {
        return str;
    }
    var regexStr = str
      // escape all the special characters, except *
      .replace(/[\-\[\]\/\{\}\(\)\+\?\.\\\^\$\|]/g, '\\$&')
      // replace all instances of * with a proper regex wildcard
      .replace(/\*/g, '.*');

    return new RegExp('^(https?://)?' + regexStr + '$', 'i');
}

function matchOrigin(req, origins) {
    var origin = req.headers.origin;

    function belongs(o) {
        return o.test(origin);
    }

    return ((origin && origins.some(belongs)) ? origin : false);
}


///--- API

/**
 * From http://www.w3.org/TR/cors/#resource-processing-model
 *
 * If "simple" request (paraphrased):
 *
 * 1. If the Origin header is not set, or if the value of Origin is not a
 *    case-sensitive match to any values listed in `opts.origins`, do not
 *    send any CORS headers
 *
 * 2. If the resource supports credentials add a single
 *    'Access-Control-Allow-Credentials' header with the value as "true", and
 *    ensure 'AC-Allow-Origin' is not '*', but is the request header value,
 *    otherwise add a single Access-Control-Allow-Origin header, with either the
 *    value of the Origin header or the string "*" as value
 *
 * 3. Add Access-Control-Expose-Headers as appropriate
 *
 * Pre-flight requests are handled by the router internally
 *
 * @public
 * @function cors
 * @param    {Object}   opts an options object
 * @returns  {Function}
 */
function cors(opts) {
    assert.optionalObject(opts, 'options');
    opts = opts || {};
    assert.optionalBool(opts.credentials, 'options.credentials');
    assert.optionalArrayOfString(opts.headers, 'options.headers');

    if (opts.origins) {
        assert.ok(Array.isArray(opts.origins), 'options.origins');
        opts.origins.forEach(function (origin, index) {
            assert.ok(typeof origin === 'string' || origin instanceof RegExp,
              'options.origins[' + index + ']');
        });
    }

    cors.credentials = opts.credentials;
    cors.origins = opts.origins || ['*'];

    var headers = (opts.headers || []).slice(0);
    cors.originPatterns = cors.origins.map(toRegExp);

    EXPOSE_HEADERS.forEach(function (h) {
        if (headers.indexOf(h) === -1) {
            headers.push(h);
        }
    });

    // Handler for simple requests
    function restifyCORSSimple(req, res, next) {
        var origin;

        if (!(origin = matchOrigin(req, cors.originPatterns))) {
            next();
            return;
        }

        function corsOnHeader() {
            origin = req.headers.origin;

            if (opts.credentials) {
                res.setHeader(AC_ALLOW_ORIGIN, origin);
                res.setHeader(AC_ALLOW_CREDS, 'true');
            } else {
                res.setHeader(AC_ALLOW_ORIGIN, origin);
            }

            res.setHeader(AC_EXPOSE_HEADERS, headers.join(', '));
        }

        res.once('header', corsOnHeader);
        next();
    }

    return (restifyCORSSimple);
}


///--- Exports

module.exports = cors;

// All of these are needed for the pre-flight code over in lib/router.js
cors.ALLOW_HEADERS = ALLOW_HEADERS;
cors.EXPOSE_HEADERS = EXPOSE_HEADERS;
cors.credentials = false;
cors.origins = [];
cors.matchOrigin = function (req, origins) {
    // we need to pass an array of regexes to `matchOrigin`,
    // so do the conversion
    return matchOrigin(
        req,
        // if the `origins` parameter is the original config value
        // then there is no need to regenerate the regexes
        origins === cors.origins ? cors.originPatterns : origins.map(toRegExp)
    );
};
