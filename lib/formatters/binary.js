// Copyright 2012 Mark Cavage, Inc.  All rights reserved.


///--- Exports

function formatBinary(req, res, body) {
    if (body instanceof Error)
        res.statusCode = body.statusCode || 500;

    if (!Buffer.isBuffer(body))
        body = new Buffer(body.toString());

    res.setHeader('Content-Length', body.length);
    return (body);
}

module.exports = formatBinary;