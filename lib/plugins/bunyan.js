// Copyright 2012 Mark Cavage, Inc.  All rights reserved.


///--- API

function requestLogger(req, res, next) {
        if (!req.log)
                return (next());

        req.log = req.log.child({req_id: req.getId()}, true);
        return (next());
}

module.exports = requestLogger;
