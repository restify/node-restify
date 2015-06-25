// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var fs = require('fs');

var assert = require('assert-plus');
var formidable = require('formidable');
var once = require('once');
var vasync = require('vasync');

var errors = require('../errors');



///--- API

/**
 * Returns a plugin that will parse the HTTP request body IFF the
 * contentType is multipart/form-data
 *
 * If req.params already contains a given key, that key is skipped and an
 * error is logged.
 * @public
 * @function multipartBodyParser
 * @param    {Object}          options an options object
 * @throws   {BadRequestError}
 * @returns  {Function}
 */
function multipartBodyParser(options) {
    if (!options) {
        options = {};
    }
    assert.object(options, 'options');
    assert.optionalBool(options.overrideParams, 'options.overrideParams');
    assert.optionalBool(options.multiples, 'options.multiples');
    assert.optionalBool(options.keepExtensions, 'options.keepExtensions');
    assert.optionalString(options.uploadDir, 'options.uploadDir');
    assert.optionalNumber(options.maxFieldsSize, 'options.maxFieldsSize');
    assert.optionalString(options.hash, 'options.hash');
    assert.optionalFunc(options.multipartFileHandler,
                        'options.multipartFileHandler');
    assert.optionalFunc(options.multipartHandler, 'options.multipartHandler');
    assert.optionalBool(options.mapParams, 'options.mapParams');
    assert.optionalBool(options.mapFiles, 'options.mapFiles');

    var override = options.overrideParams;

    function parseMultipartBody(req, res, next) {
        next = once(next);

        if (req.getContentType() !== 'multipart/form-data' ||
            (req.getContentLength() === 0 && !req.isChunked())) {
            return (next());
        }

        var form = new formidable.IncomingForm();

        // enable multiple files on a single upload field
        // (html5 multiple attribute)
        form.multiples = options.multiples || false;
        form.keepExtensions = options.keepExtensions ? true : false;

        if (options.uploadDir) {
            form.uploadDir = options.uploadDir;
        }

        if (options.maxFieldsSize) {
            form.maxFieldsSize = options.maxFieldsSize;
        }

        if (options.hash) {
            form.hash = options.hash;
        }

        form.onPart = function onPart(part) {
            if (part.filename && options.multipartFileHandler) {
                options.multipartFileHandler(part, req);
            } else if (!part.filename && options.multipartHandler) {
                options.multipartHandler(part, req);
            } else {
                form.handlePart(part);
            }
        };

        form.parse(req, function (err, fields, files) {
            if (err) {
                return (next(new errors.BadRequestError(err.message)));
            }

            req.body = fields;
            req.files = files;

            if (options.mapParams !== false) {
                Object.keys(fields).forEach(function (k) {
                    if (req.params[k] && !override) {
                        return;
                    }

                    req.params[k] = fields[k];
                });

                if (options.mapFiles) {
                    var barrier = vasync.barrier();
                    barrier.on('drain', function () {
                        return next();
                    });

                    barrier.start('fs');
                    Object.keys(files).forEach(function (f) {
                        if (req.params[f] && !override) {
                            return;
                        }
                        barrier.start('fs' + f);
                        fs.readFile(files[f].path, function (ex, data) {
                            barrier.done('fs' + f);
                            /*
                             * We want to stop the request here, if there's an
                             * error trying to read the file from disk.
                             * Ideally we'd like to stop the other oustanding
                             * file reads too, but there's no way to cancel in
                             * flight fs reads.  So we just return an error, and
                             * be grudgingly let the other file reads finish.
                             */
                            if (ex) {
                                return next(new errors.InternalError(ex,
                                         'unable to read file' + f));
                            }
                            req.params[f] = data;
                            return (true);
                        });
                    });
                    barrier.done('fs');
                } else {
                    return next();
                }
            } else {
                return next();
            }

        });

        return (false);
    }

    return (parseMultipartBody);
}

module.exports = multipartBodyParser;
