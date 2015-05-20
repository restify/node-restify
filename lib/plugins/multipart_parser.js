// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');
var formidable = require('formidable');

var errors = require('../errors');


///--- Globals

var BadRequestError = errors.BadRequestError;


///--- API

/**
 * Returns a plugin that will parse the HTTP request body IFF the
 * contentType is multipart/form-data
 *
 * If req.params already contains a given key, that key is skipped and an
 * error is logged.
 *
 * @return {Function} restify handler.
 * @throws {TypeError} on bad input
 */
function multipartBodyParser(options) {
    if (!options)
        options = {};
    assert.object(options, 'options');

    var override = options.overrideParams;

    function parseMultipartBody(req, res, next) {
        if (req.getContentType() !== 'multipart/form-data' ||
            (req.getContentLength() === 0 && !req.isChunked()))
            return (next());

        var form = new formidable.IncomingForm();
        // enable multiple files on a single upload field
        // (html5 multiple attribute)
        form.multiples = options.multiples || false;
        form.keepExtensions = options.keepExtensions ? true : false;
        if (options.uploadDir)
            form.uploadDir = options.uploadDir;
        if (options.maxFieldsSize)
            form.maxFieldsSize = options.maxFieldsSize;

        form.onPart = function onPart(part) {
            if (part.filename && options.multipartFileHandler)
                options.multipartFileHandler(part, req);
            else if (!part.filename && options.multipartHandler)
                options.multipartHandler(part, req);
            else
                form.handlePart(part);
        };

        form.parse(req, function (err, fields, files) {
            if (err)
                return (next(new BadRequestError(err.message)));

            req.body = fields;
            req.files = files;

            if (options.mapParams !== false) {
                Object.keys(fields).forEach(function (k) {
                    if (req.params[k] && !override)
                        return (false);

                    req.params[k] = fields[k];
                    return (true);
                });

                if (options.mapFiles) {
                    Object.keys(files).forEach(function (f) {
                        if (req.params[f] && !override)
                            return (false);
                        var fs = require('fs');
                        return fs.readFile(
                            files[f].path,
                            'utf8',
                            function (ex, data) {
                                if (ex) {
                                    return (false);
                                }
                                req.params[f] = data;
                                return (true);
                            });
                    });
                }
            }

            return (next());
        });

        return (false);
    }

    return (parseMultipartBody);
}

module.exports = multipartBodyParser;
