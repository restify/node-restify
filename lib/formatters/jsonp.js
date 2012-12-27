// Copyright 2012 Mark Cavage, Inc.  All rights reserved.



///--- Exports

function formatJSONP(req, res, body) {
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

        if (Buffer.isBuffer(body))
                body = body.toString('base64');

        var cb = req.query.callback || req.query.jsonp;
        var data;
        if (cb) {
                data = cb + '(' + JSON.stringify(body) + ');';
        } else {
                data = JSON.stringify(body);
        }

        res.setHeader('Content-Length', Buffer.byteLength(data));
        return (data);
}

module.exports = formatJSONP;
