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
 * @param    {Function} cb cb
 * @returns  {String}
 */
function formatJSONP(req, res, body, cb) {
    if (!body) {
        res.setHeader('Content-Length', 0);
        return (null);
    }

    if (body instanceof Error) {
        if ((body.restCode || body.httpCode) && body.body) {
            body = body.body;
        } else {
            body = {
                message: body.message
            };
        }
    }

    if (Buffer.isBuffer(body)) {
        body = body.toString('base64');
    }

    var _cb = req.query.callback || req.query.jsonp;
    var data;

    if (_cb) {
        data = 'typeof ' + _cb + ' === \'function\' && ' +
                _cb + '(' + JSON.stringify(body) + ');';
    } else {
        data = JSON.stringify(body);
    }

    res.setHeader('Content-Length', Buffer.byteLength(data));
    return cb(null, data);
}

module.exports = formatJSONP;
