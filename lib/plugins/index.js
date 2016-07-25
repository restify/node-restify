// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

///--- Exports

module.exports = {
    acceptParser: require('./accept'),
    auditLogger: require('./audit'),
    authorizationParser: require('./authorization'),
    bodyParser: require('./body_parser'),
    bodyReader: require('./body_reader'),
    conditionalRequest: require('./conditional_request'),
    CORS: require('./cors'),
    dateParser: require('./date'),
    jsonp: require('./jsonp'),
    urlEncodedBodyParser: require('./form_body_parser'),
    requestLogger: require('./bunyan'),
    gzipResponse: require('./gzip'),
    fullResponse: require('./full_response'),
    jsonBodyParser: require('./json_body_parser'),
    multipartBodyParser: require('./multipart_body_parser'),
    queryParser: require('./query'),
    requestExpiry: require('./request_expiry'),
    sanitizePath: require('./pre/pre_path'),
    serveStatic: require('./static'),
    throttle: require('./throttle'),

    pre: {
        pause: require('./pre/pause'),
        sanitizePath: require('./pre/pre_path'),
        userAgentConnection: require('./pre/user_agent')
    }
};
