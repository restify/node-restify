// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var errors = require('../errors');



///--- Globals

var BadRequestError = errors.BadRequestError;
var PreconditionFailedError = errors.PreconditionFailedError;

var IF_MATCH_FAIL = 'if-match \'%s\' didn\'t match etag \'%s\'';
var IF_NO_MATCH_FAIL = 'if-none-match \'%s\' matched etag \'%s\'';
var IF_UNMOD_FAIL = 'object was modified at \'%s\'; if-unmodified-since \'%s\'';



///--- API
// Reference RFC2616 section 14 for an explanation of what this all does.

function checkIfMatch(req, res, next) {
        var clientETags;
        var cur;
        var etag = res.etag || res.getHeader('etag') || '';
        var ifMatch;
        var matched = false;

        if ((ifMatch = req.headers['if-match'])) {
                /* JSSTYLED */
                clientETags = ifMatch.split(/\s*,\s*/);

                for (var i = 0; i < clientETags.length; i++) {
                        cur = clientETags[i];
                        // only strong comparison
                        /* JSSTYLED */
                        cur = cur.replace(/^W\//, '');
                        /* JSSTYLED */
                        cur = cur.replace(/^"(\w*)"$/, '$1');

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
        var etag = res.etag || res.getHeader('etag') || '';
        var ifNoneMatch;
        var matched = false;

        if ((ifNoneMatch = req.headers['if-none-match'])) {
                /* JSSTYLED */
                clientETags = ifNoneMatch.split(/\s*,\s*/);

                for (var i = 0; i < clientETags.length; i++) {
                        cur = clientETags[i];
                        // ignore weak validation
                        /* JSSTYLED */
                        cur = cur.replace(/^W\//, '');
                        /* JSSTYLED */
                        cur = cur.replace(/^"(\w*)"$/, '$1');

                        if (cur === '*' || cur === etag) {
                                matched = true;
                                break;
                        }
                }

                if (!matched)
                        return (next());

                if (req.method !== 'GET' && req.method !== 'HEAD') {
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
        var ctime = req.header('if-modified-since');
        var mtime = res.mtime || res.header('Last-Modified') || '';

        if (!mtime || !ctime)
                return (next());

        try {
                // TODO handle Range header modifications
                if (Date.parse(mtime) <= Date.parse(ctime)) {
                        res.send(304);
                        return (next(false));
                }
        } catch (e) {
                return (next(new BadRequestError(e.message)));
        }

        return (next());
}


function checkIfUnmodified(req, res, next) {
        var ctime = req.headers['if-unmodified-since'];
        var mtime = res.mtime || res.header('Last-Modified') || '';

        if (!mtime || !ctime)
                return (next());

        try {
                if (Date.parse(mtime) > Date.parse(ctime)) {
                        return (next(new PreconditionFailedError(IF_UNMOD_FAIL,
                                                                 mtime,
                                                                 ctime)));
                }
        } catch (e) {
                return (next(new BadRequestError(e.message)));
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
