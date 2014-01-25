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
    options = options || {};
    assert.object(options, 'options');
    var override = options.overrideParams;

    function parseMultipartBody(req, res, next) {
        if (req.getContentType() !== 'multipart/form-data' || (req.getContentLength() === 0 && !req.isChunked()))
            return (next());

        var form = new formidable.IncomingForm();
        form.keepExtensions = options.keepExtensions ? true : false;
        form.uploadDir = options.uploadDir || form.uploadDir;

        form.parse(req, function (err, fields, files) {
            if (err) return (next(new BadRequestError(err.message)));
            req.body = fields;
            req.files = files;
            function mapParams (obj) {
                Object.keys(obj).forEach(function (k) {
                    if (req.params[k] && !override) return (false);
                    req.params[k] = obj[k];
                    return (true);
                });
            }
            if (options.mapParams !== false) {
                mapParams(fields);
                mapParams(files);
            }
            return (next());
        });

        return (false);
    }

    return (parseMultipartBody);
}

module.exports = multipartBodyParser;
