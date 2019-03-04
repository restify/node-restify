// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

///--- Exports

module.exports = {
    acceptParser: require('./accept'),
    auditLogger: require('./audit'),
    authorizationParser: require('./authorization'),
    bodyParser: require('./bodyParser'),
    bodyReader: require('./bodyReader'),
    conditionalHandler: require('./conditionalHandler'),
    conditionalRequest: require('./conditionalRequest'),
    cpuUsageThrottle: require('./cpuUsageThrottle.js'),
    dateParser: require('./date'),
    fullResponse: require('./fullResponse'),
    gzipResponse: require('./gzip'),
    inflightRequestThrottle: require('./inflightRequestThrottle'),
    jsonBodyParser: require('./jsonBodyParser'),
    jsonp: require('./jsonp'),
    multipartBodyParser: require('./multipartBodyParser'),
    oauth2TokenParser: require('./oauth2TokenParser'),
    queryParser: require('./query'),
    metrics: require('./metrics'),
    requestExpiry: require('./requestExpiry'),
    requestLogger: require('./bunyan'),
    serveStatic: require('./static'),
    serveStaticFiles: require('./staticFiles'),
    throttle: require('./throttle'),
    urlEncodedBodyParser: require('./formBodyParser'),

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
