// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var errors = require('../errors');



///--- Globals

var PreconditionFailedError = errors.PreconditionFailedError;

var IF_MATCH_FAIL = 'if-match \'%s\' didn\'t match etag \'%s\'';
var IF_NO_MATCH_FAIL = 'if-none-match \'%s\' matched etag \'%s\'';
var IF_UNMOD_FAIL = 'object was modified at \'%s\'; if-unmodified-since \'%s\'';



///--- Helpers

function isValidDate(d) {
        return (!(isNaN(Date.parse(d))));
}



///--- API
// Reference RFC2616 section 14 for an explanation of what this all does.

function checkIfMatch(req, res, next) {
        var clientETags;
        var cur;
        var etag = res.etag || res.getHeader('etag');
        var ifMatch;
        var matched = false;

        if (typeof (etag) !== 'string' || etag.length !== 0)
                return (next());

        if ((ifMatch = req.headers['if-match'])) {
                /* JSSTYLED */
                clientETags = ifMatch.split(/\s*,\s*/);

                for (var i = 0; i < clientETags.length; i++) {
                        // only strong comparison
                        /* JSSTYLED */
                        cur = clientETags[i].replace(/^"(\w*)"$/, '$1');
                        if (cur === '*' || cur === etag) {
                                matched = true;
                                break;
                        }
                }

                if (!matched) {
                        var err = new PreconditionFailedError(IF_MATCH_FAIL,
                                                              ifMatch,
                                                              etag);
                        return (next(err));
                }
        }

        return (next());
}


function checkIfNoneMatch(req, res, next) {
        var clientETags;
        var cur;
        var etag = res.etag || res.getHeader('etag');
        var ifNoneMatch;
        var matched = false;

        if ((ifNoneMatch = req.headers['if-none-match'])) {
                /* JSSTYLED */
                clientETags = ifNoneMatch.split(/\s*,\s*/);

                for (var i = 0; i < clientETags.length; i++) {
                        // ignore weak validation
                        cur = clientETags[i].replace(/^W\//, '').
                                replace(/^"(\w*)"$/, '$1');

                        if ((cur === '*' || cur === etag) &&
                            (req.method !== 'GET' && req.method !== 'HEAD')) {
                                matched = true;
                                break;
                        }
                }

                if (matched) {
                        var err = new PreconditionFailedError(IF_NO_MATCH_FAIL,
                                                              ifNoneMatch,
                                                              etag);
                        return (next(err));
                }

                res.send(304);
                return (next(false));
        }

        return (next());
}


function checkIfModified(req, res, next) {
        var ifModified = req.headers['if-modified-since'];
        var modified = res.header('Last-Modified');
        if (!modified || !isValidDate(modified))
                return (next());

        modified = new Date(modified).getTime();

        if (ifModified && isValidDate(ifModified)) {
                ifModified = new Date(ifModified).getTime();
                if (ifModified >= modified) {
                        res.send(304);
                        return (next(false));
                }
        }

        return (next());
}


function checkIfUnmodified(req, res, next) {
        var clientDate;
        var ifUnmodified = req.headers['if-unmodified-since'];
        var modified = res.header('Last-Modified');

        if (!modified || !isValidDate(modified))
                return (next());

        modified = new Date(modified).getTime();

        if (ifUnmodified && isValidDate(ifUnmodified) &&
            (clientDate = req.headers['if-unmodified-since'])) {
                if (new Date(clientDate).getTime() < modified) {
                        var err = new PreconditionFailedError(IF_UNMOD_FAIL,
                                                              modified,
                                                              ifUnmodified);
                        return (next(err));
                }

        }

        return (next());
}



///--- Exports

/**
 * Returns a set of plugins that will compare an already set ETag header with
 * the client's If-Match and If-None-Match header, and an already set
 * Last-Modified header with the client's If-Modified-Since and
 * If-Unmodified-Since header.
 */
function conditionalRequest() {
        var chain = [
                checkIfMatch,
                checkIfNoneMatch,
                checkIfModified,
                checkIfUnmodified
        ];
        return (chain);
}

module.exports = conditionalRequest;
