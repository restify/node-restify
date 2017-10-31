// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

///--- Exports

/**
 * JSONP formatter. like JSON, but with a callback invocation.
 * Unicode escapes line and paragraph separators.
 *
 * @public
 * @function formatJSONP
 * @param    {Object} req - the request object
 * @param    {Object} res - the response object
 * @param    {Object} body - response body
 * @returns  {String} data
 */
function formatJSONP(req, res, body) {
    if (!body) {
        res.setHeader('Content-Length', 0);
        return null;
    }

    if (Buffer.isBuffer(body)) {
        body = body.toString('base64');
    }

    var _cb = req.query.callback || req.query.jsonp;
    var data;

    if (_cb) {
        data =
            'typeof ' +
            _cb +
            " === 'function' && " +
            _cb +
            '(' +
            JSON.stringify(body) +
            ');';
    } else {
        data = JSON.stringify(body);
    }

    data = data.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

    res.setHeader('Content-Length', Buffer.byteLength(data));
    return data;
}

module.exports = formatJSONP;
