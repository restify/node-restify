// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

///--- Exports

module.exports = {
    acceptParser: require('./plugins/accept'),
    auditLogger: require('./plugins/audit'),
    authorizationParser: require('./plugins/authorization'),
    bodyParser: require('./plugins/bodyParser'),
    bodyReader: require('./plugins/bodyReader'),
    conditionalRequest: require('./plugins/conditionalRequest'),
    dateParser: require('./plugins/date'),
    fullResponse: require('./plugins/fullResponse'),
    gzipResponse: require('./plugins/gzip'),
    jsonBodyParser: require('./plugins/jsonBodyParser'),
    jsonp: require('./plugins/jsonp'),
    multipartBodyParser: require('./plugins/multipartBodyParser'),
    oauth2TokenParser: require('./plugins/oauth2TokenParser'),
    queryParser: require('./plugins/query'),
    metrics: require('./plugins/metrics'),
    requestExpiry: require('./plugins/requestExpiry'),
    requestLogger: require('./plugins/bunyan'),
    serveStatic: require('./plugins/static'),
    throttle: require('./plugins/throttle'),
    urlEncodedBodyParser: require('./plugins/formBodyParser'),


    pre: {
        context: require('./pre/context'),
        dedupeSlashes: require('./pre/dedupeSlashes'),
        pause: require('./pre/pause'),
        reqIdHeaders: require('./pre/reqIdHeaders'),
        sanitizePath: require('./pre/prePath'),
        strictQueryParams: require('./pre/strictQueryParams'),
        userAgentConnection: require('./pre/userAgent')
    }
};
