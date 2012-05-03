// Copyright 2012 Mark Cavage, Inc.  All rights reserved.



///--- Exports

module.exports = {

        'application/octet-stream': function formatBinary(req, res, body) {
                if (!Buffer.isBuffer(body))
                        body = new Buffer(body.toString());

                res.setHeader('Content-Length', body.length);
                return (body);
        }

};
