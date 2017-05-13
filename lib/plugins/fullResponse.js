// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var crypto = require('crypto');
var httpDate = require('./utils/httpDate');


///--- API

function setHeaders(req, res) {
    var hash;
    var now = new Date();

    if (!res.getHeader('Connection')) {
        res.setHeader('Connection',
            req.isKeepAlive() ? 'Keep-Alive' : 'close');
    }

    if (res._data && !res.getHeader('Content-MD5')) {
        hash = crypto.createHash('md5');
        hash.update(res._data);
        res.setHeader('Content-MD5', hash.digest('base64'));
    }

    if (!res.getHeader('Date')) {
        res.setHeader('Date', httpDate(now));
    }

    if (res.etag && !res.getHeader('Etag')) {
        res.setHeader('Etag', res.etag);
    }

    if (!res.getHeader('Server')) {
        res.setHeader('Server', res.serverName);
    }

    if (res.version && !res.getHeader('Api-Version')) {
        res.setHeader('Api-Version', res.version);
    }

    if (!res.getHeader('Request-Id')) {
        res.setHeader('Request-Id', req.getId());
    }

    if (!res.getHeader('Response-Time')) {
        res.setHeader('Response-Time', now.getTime() - req._time);
    }

}


/**
 * handles disappeared CORS headers.
 * https://github.com/restify/node-restify/issues/284
 * @public
 * @function fullResponse
 * @returns  {Function}
 */
function fullResponse() {
    function restifyResponseHeaders(req, res, next) {
        res.once('header', function () {

            // Restify 1.0 compatibility
            if (res.defaultResponseFormatters) {
                res.defaultResponseFormatters(res._data);
            }

            res.emit('beforeSend', res._data, res._body);

            // end backwards-compatibility
            return (setHeaders(req, res));
        });

        return (next());
    }

    return (restifyResponseHeaders);
}


///--- Exports

module.exports = fullResponse;
