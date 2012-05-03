// Copyright 2012 Mark Cavage, Inc.  All rights reserved.



///--- Exports

module.exports = {

        'text/plain': function formatText(req, res, body) {
                if (body instanceof Error) {
                        body = body.message;
                } else if (typeof (body) === 'object') {
                        body = JSON.stringify(body);
                } else {
                        body = body.toString();
                }

                res.setHeader('Content-Length', Buffer.byteLength(body));
                return (body);
        }
};
