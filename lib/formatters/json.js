// Copyright 2012 Mark Cavage, Inc.  All rights reserved.



///--- Exports

module.exports = {

        'application/json': function formatJSON(req, res, body) {
                if (body instanceof Error) {
                        // snoop for RestError or HttpError, but don't rely on
                        // instanceof
                        if (body.statusCode)
                                res.statusCode = body.statusCode;

                        if (body.body) {
                                body = body.body;
                        } else {
                                body = {
                                        message: body.message
                                };
                        }
                } else if (Buffer.isBuffer(body)) {
                        body = body.toString('base64');
                }

                var data = JSON.stringify(body);
                res.setHeader('Content-Length', Buffer.byteLength(data));

                return (data);
        }

};


