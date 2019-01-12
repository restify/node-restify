// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var fs = require('fs');

var assert = require('assert-plus');
var formidable = require('formidable');
var once = require('once');
var errors = require('restify-errors');
var vasync = require('vasync');

///--- API

/**
 * Returns a plugin that will parse the HTTP request body IFF the
 * contentType is multipart/form-data
 *
 * If req.params already contains a given key, that key is skipped and an
 * error is logged.
 *
 * @public
 * @function multipartBodyParser
 * @param    {Object}          options - an options object
 * @throws   {BadRequestError}
 * @returns  {Function} Handler
 */
function multipartBodyParser(options) {
    var opts = options || {};
    assert.object(opts, 'opts');
    assert.optionalBool(opts.overrideParams, 'opts.overrideParams');
    assert.optionalBool(opts.multiples, 'opts.multiples');
    assert.optionalBool(opts.keepExtensions, 'opts.keepExtensions');
    assert.optionalString(opts.uploadDir, 'opts.uploadDir');
    assert.optionalNumber(opts.maxFieldsSize, 'opts.maxFieldsSize');
    assert.optionalString(opts.hash, 'opts.hash');
    assert.optionalFunc(opts.multipartFileHandler, 'opts.multipartFileHandler');
    assert.optionalFunc(opts.multipartHandler, 'opts.multipartHandler');
    assert.optionalBool(opts.mapParams, 'opts.mapParams');
    assert.optionalBool(opts.mapFiles, 'opts.mapFiles');
    assert.optionalNumber(opts.maxFileSize, 'opts.maxFileSize');

    var override = opts.overrideParams;

    function parseMultipartBody(req, res, originalNext) {
        // save original body on req.rawBody and req._body
        req.rawBody = req._body = undefined;

        var next = once(originalNext);

        if (
            req.getContentType() !== 'multipart/form-data' ||
            (req.getContentLength() === 0 && !req.isChunked())
        ) {
            return next();
        }

        var form = new formidable.IncomingForm();

        // enable multiple files on a single upload field
        // (html5 multiple attribute)
        form.multiples = opts.multiples || false;
        form.keepExtensions = opts.keepExtensions ? true : false;

        if (opts.uploadDir) {
            form.uploadDir = opts.uploadDir;
        }

        if (opts.maxFieldsSize) {
            form.maxFieldsSize = opts.maxFieldsSize;
        }

        if (opts.maxFileSize) {
            form.maxFileSize = opts.maxFileSize;
        }

        if (opts.hash) {
            form.hash = opts.hash;
        }

        form.onPart = function onPart(part) {
            if (part.filename && opts.multipartFileHandler) {
                opts.multipartFileHandler(part, req);
            } else if (!part.filename && opts.multipartHandler) {
                opts.multipartHandler(part, req);
            } else {
                form.handlePart(part);
            }
        };

        return form.parse(req, function parse(err, fields, files) {
            if (err) {
                return next(new errors.BadRequestError(err.message));
            }

            req.body = fields;
            req.files = files;

            if (opts.mapParams !== false) {
                Object.keys(fields).forEach(function forEach(k) {
                    if (req.params[k] && !override) {
                        return;
                    }

                    req.params[k] = fields[k];
                });

                if (opts.mapFiles) {
                    var barrier = vasync.barrier();
                    barrier.on('drain', function onDrain() {
                        return next();
                    });

                    barrier.start('fs');
                    Object.keys(files).forEach(function forEach(f) {
                        if (req.params[f] && !override) {
                            return;
                        }
                        barrier.start('fs' + f);
                        fs.readFile(files[f].path, function readFile(ex, data) {
                            barrier.done('fs' + f);
                            /*
                             * We want to stop the request here, if there's
                             * an error trying to read the file from disk.
                             * Ideally we'd like to stop the other oustanding
                             * file reads too, but there's no way to cancel
                             * in flight fs reads.  So we just return an
                             * error, and be grudgingly let the other file
                             * reads finish.
                             */
                            if (ex) {
                                return next(
                                    new errors.InternalError(
                                        ex,
                                        'unable to read file' + f
                                    )
                                );
                            }
                            req.params[f] = data;
                            return true;
                        });
                    });
                    barrier.done('fs');
                    return false;
                } else {
                    return next();
                }
            } else {
                return next();
            }
        });
    }

    return parseMultipartBody;
}

module.exports = multipartBodyParser;
