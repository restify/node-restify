// Copyright 2013 Mark Cavage, Inc.  All rights reserved.

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

function matchOrigin(req, origins) {
        var origin = req.headers['origin'];

        function belongs(o) {
                if (origin === o || o === '*') {
                        origin = o;
                        return (true);
                }

                return (false);
        }

        return ((origin && origins.some(belongs)) ? origin : false);
}



///--- API

//
// From http://www.w3.org/TR/cors/#resource-processing-model
//
// If "simple" request (paraphrased):
//
// 1. If the Origin header is not set, or if the value of Origin is not a
//    case-senstive match to any values listed in `opts.origins`, do not
//    send any CORS headers
//
// 2. If the resource supports credentials add a single
//    'Access-Controlw-Allow-Credentials' header with the value as "true", and
//    ensure 'AC-Allow-Origin' is not '*', but is the request header value,
//    otherwise add a single Access-Control-Allow-Origin header, with either the
//    value of the Origin header or the string "*" as value
//
// 3. Add Access-Control-Expose-Headers as appropriate
//
// Preflight requests are handled by the router internally
//
function cors(opts) {
        assert.optionalObject(opts, 'options');
        opts = opts || {};
        assert.optionalArrayOfString(opts.origins, 'options.origins');
        assert.optionalBool(opts.credentials, 'options.credentials');
        assert.optionalArrayOfString(opts.headers, 'options.headers');

        var headers = (opts.headers || []).slice(0);
        var origins = opts.origins || ['*'];

        EXPOSE_HEADERS.forEach(function (h) {
                if (headers.indexOf(h) === -1)
                        headers.push(h);
        });

        // Handler for simple requests
        function restifyCORSSimple(req, res, next) {
                var origin;
                if (!(origin = matchOrigin(req, origins))) {
                        next();
                        return;
                }

                function corsOnHeader() {
                        origin = req.headers['origin'];
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
cors.ALLOW_HEADERS = ALLOW_HEADERS;
