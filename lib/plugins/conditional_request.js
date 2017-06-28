// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var errors = require('../errors');


///--- Globals

var BadRequestError = errors.BadRequestError;
var PreconditionFailedError = errors.PreconditionFailedError;

var IF_MATCH_FAIL = 'if-match \'%s\' didn\'t match etag \'%s\'';
var IF_NO_MATCH_FAIL = 'if-none-match \'%s\' matched etag \'%s\'';
var IF_MOD_FAIL = 'object was modified at \'%s\'; if-modified-since \'%s\'';
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

        clientETags = ifMatch.split(/\s*,\s*/);

        for (var i = 0; i < clientETags.length; i++) {
            cur = clientETags[i];

            // only strong comparison

            cur = cur.replace(/^W\//, '');
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

        clientETags = ifNoneMatch.split(/\s*,\s*/);

        for (var i = 0; i < clientETags.length; i++) {
            cur = clientETags[i];

            // ignore weak validation
            cur = cur.replace(/^W\//, '');
            cur = cur.replace(/^"(\w*)"$/, '$1');

            if (cur === '*' || cur === etag) {
                matched = true;
                break;
            }
        }

        if (!matched) {
            return (next());
        }

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
    var code;
    var err;
    var ctime = req.header('if-modified-since');
    var mtime = res.mtime || res.header('Last-Modified') || '';

    if (!mtime || !ctime) {
        next();
        return;
    }

    try {
        //
        // Limitation: This doesn't handle Range header modifications.
        //
        // Note: this is not technically correct as per 2616 -
        // 2616 only specifies semantics for GET requests, not
        // any other method - but using if-modified-since with a
        // PUT or DELETE seems like returning 412 is sane
        //
        if (Date.parse(mtime) <= Date.parse(ctime)) {
            switch (req.method) {
                case 'GET':
                case 'HEAD':
                    code = 304;
                    break;

                default:
                    err = new PreconditionFailedError(IF_MOD_FAIL,
                        mtime,
                        ctime);
                    break;
            }
        }
    } catch (e) {
        next(new BadRequestError(e.message));
        return;
    }

    if (code !== undefined) {
        res.send(code);
        next(false);
        return;
    }

    next(err);
}


function checkIfUnmodified(req, res, next) {
    var err;
    var ctime = req.headers['if-unmodified-since'];
    var mtime = res.mtime || res.header('Last-Modified') || '';

    if (!mtime || !ctime) {
        next();
        return;
    }

    try {
        if (Date.parse(mtime) > Date.parse(ctime)) {
            err = new PreconditionFailedError(IF_UNMOD_FAIL,
                mtime,
                ctime);
        }
    } catch (e) {
        next(new BadRequestError(e.message));
        return;
    }

    next(err);
}


///--- Exports

/**
 * Returns a set of plugins that will compare an already set ETag header with
 * the client's If-Match and If-None-Match header, and an already set
 * Last-Modified header with the client's If-Modified-Since and
 * If-Unmodified-Since header.
 * @public
 * @throws {BadRequestError | PreconditionFailedError}
 * @function conditionalRequest
 * @returns  {Array}
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
