// Copyright 2012 Mark Cavage, Inc.  All rights reserved.


///--- Exports

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
