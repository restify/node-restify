// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

///--- Exports

/**
 * JSONP formatter. like JSON, but with a callback invocation.
 * @public
 * @function formatJSONP
 * @param    {Object} req  the request object
 * @param    {Object} res  the response object
 * @param    {Object} body response body
 * @returns  {String}
 */
function formatText(req, res, body) {
    if (body instanceof Error) {
        res.statusCode = body.statusCode || 500;
        body = body.message;
    } else if (typeof (body) === 'object') {
        body = JSON.stringify(body);
    } else {
        body = body.toString();
    }

    res.setHeader('Content-Length', Buffer.byteLength(body));
    return (body);
}

module.exports = formatText;
