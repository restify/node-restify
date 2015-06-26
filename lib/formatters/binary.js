// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

///--- Exports

/**
 * binary formatter.
 * @public
 * @function formatBinary
 * @param    {Object} req  the request object
 * @param    {Object} res  the response object
 * @param    {Object} body response body
 * @param    {Function} cb cb
 * @returns  {Buffer}
 */
function formatBinary(req, res, body, cb) {
    if (body instanceof Error) {
        res.statusCode = body.statusCode || 500;
    }

    if (!Buffer.isBuffer(body)) {
        body = new Buffer(body.toString());
    }

    res.setHeader('Content-Length', body.length);
    return cb(null, body);
}

module.exports = formatBinary;
