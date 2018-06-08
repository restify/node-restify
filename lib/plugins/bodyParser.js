// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var assert = require('assert-plus');
var errors = require('restify-errors');

var bodyReader = require('./bodyReader');
var jsonParser = require('./jsonBodyParser');
var formParser = require('./formBodyParser');
var multipartParser = require('./multipartBodyParser');
var fieldedTextParser = require('./fieldedTextBodyParser.js');
var regex = require('./utils/regex');

///--- Globals

var UnsupportedMediaTypeError = errors.UnsupportedMediaTypeError;

///--- API

/**
 * Blocks your chain on reading and parsing the HTTP request body.  Switches on
 * `Content-Type` and does the appropriate logic.  `application/json`,
 * `application/x-www-form-urlencoded` and `multipart/form-data` are currently
 * supported.
 *
 * Parses `POST` bodies to `req.body`. automatically uses one of the following
 * parsers based on content type:
 * - `urlEncodedBodyParser(options)` - parses url encoded form bodies
 * - `jsonBodyParser(options)` - parses JSON POST bodies
 * - `multipartBodyParser(options)` - parses multipart form bodies
 *
 * All bodyParsers support the following options:
 * - `options.mapParams` - default false. copies parsed post body values onto
 * req.params
 * - `options.overrideParams` - default false. only applies when if
 * mapParams true. when true, will stomp on req.params value when
 * existing value is found.
 *
 * @public
 * @function bodyParser
 * @throws   {UnsupportedMediaTypeError}
 * @param {Object} [options] - an option object
 * @param {Number} [options.maxBodySize] - The maximum size in bytes allowed in
 * the HTTP body. Useful for limiting clients from hogging server memory.
 * @param {Boolean} [options.mapParams] - if `req.params` should be filled with
 * parsed parameters from HTTP body.
 * @param {Boolean} [options.mapFiles] - if `req.params` should be filled with
 * the contents of files sent through a multipart request.
 * [formidable](https://github.com/felixge/node-formidable) is used internally
 * for parsing, and a file is denoted as a multipart part with the `filename`
 * option set in its `Content-Disposition`. This will only be performed if
 * `mapParams` is true.
 * @param {Boolean} [options.overrideParams] - if an entry in `req.params`
 * should be overwritten by the value in the body if the names are the same.
 * For instance, if you have the route `/:someval`,
 * and someone posts an `x-www-form-urlencoded`
 * Content-Type with the body `someval=happy` to `/sad`, the value will be
 * `happy` if `overrideParams` is `true`, `sad` otherwise.
 * @param {Function} [options.multipartHandler] - a callback to handle any
 * multipart part which is not a file.
 * If this is omitted, the default handler is invoked which may
 * or may not map the parts into `req.params`, depending on
 * the `mapParams`-option.
 * @param {Function} [options.multipartFileHandler] - a callback to handle any
 * multipart file.
 * It will be a file if the part has a `Content-Disposition` with the
 * `filename` parameter set. This typically happens when a browser sends a
 * form and there is a parameter similar to `<input type="file" />`.
 * If this is not provided, the default behaviour is to map the contents
 * into `req.params`.
 * @param {Boolean} [options.keepExtensions] - if you want the uploaded
 * files to include the extensions of the original files
 * (multipart uploads only).
 * Does nothing if `multipartFileHandler` is defined.
 * @param {String} [options.uploadDir] - Where uploaded files are
 * intermediately stored during transfer before the contents is mapped
 * into `req.params`.
 * Does nothing if `multipartFileHandler` is defined.
 * @param {Boolean} [options.multiples] - if you want to support html5 multiple
 * attribute in upload fields.
 * @param {String} [options.hash] - If you want checksums calculated for
 * incoming files, set this to either `sha1` or `md5`.
 * @param {Boolean} [options.rejectUnknown] - Set to `true` if you want to end
 * the request with a `UnsupportedMediaTypeError` when none of
 * the supported content types was given.
 * @param {Boolean} [options.requestBodyOnGet=false] -  Parse body of a GET
 * request.
 * @param {Function} [options.reviver] - `jsonParser` only. If a function,
 * this prescribes how the value originally produced by parsing is transformed,
 * before being returned. For more information check out
 * `JSON.parse(text[, reviver])`.
 * @param {Number} [options.maxFieldsSize=2 * 1024 * 1024] - `multipartParser`
 * only.
 * Limits the amount of memory all fields together (except files)
 * can allocate in bytes.
 * The default size is `2 * 1024 * 1024` bytes *(2MB)*.
 * @returns  {Function} Handler
 * @example
 * server.use(restify.plugins.bodyParser({
 *     maxBodySize: 0,
 *     mapParams: true,
 *     mapFiles: false,
 *     overrideParams: false,
 *     multipartHandler: function(part) {
 *         part.on('data', function(data) {
 *           // do something with the multipart data
 *         });
 *     },
 *    multipartFileHandler: function(part) {
 *         part.on('data', function(data) {
 *           // do something with the multipart file data
 *         });
 *     },
 *     keepExtensions: false,
 *     uploadDir: os.tmpdir(),
 *     multiples: true,
 *     hash: 'sha1',
 *     rejectUnknown: true,
 *     requestBodyOnGet: false,
 *     reviver: undefined,
 *     maxFieldsSize: 2 * 1024 * 1024
 *  }));
 */
function bodyParser(options) {
    assert.optionalObject(options, 'options');
    var opts = options || {};
    opts.bodyReader = true;

    var read = bodyReader(opts);
    var parseForm = formParser(opts);
    var parseJson = jsonParser(opts);
    var parseMultipart = multipartParser(opts);
    var parseFieldedText = fieldedTextParser(opts);

    function parseBody(req, res, next) {
        // #100 don't parse the body again if we've read it once
        if (req._parsedBody) {
            next();
            return;
        } else {
            req._parsedBody = true;
        }
        // Allow use of 'requestBodyOnGet' flag to allow for merging of
        // the request body of a GET request into req.params
        if (req.method === 'HEAD') {
            next();
            return;
        }

        if (req.method === 'GET') {
            if (!opts.requestBodyOnGet) {
                next();
                return;
            }
        }

        if (req.contentLength() === 0 && !req.isChunked()) {
            next();
            return;
        }

        var parser;
        var type = req.contentType().toLowerCase();

        switch (type) {
            case 'application/json':
                parser = parseJson[0];
                break;
            case 'application/x-www-form-urlencoded':
                parser = parseForm[0];
                break;
            case 'multipart/form-data':
                parser = parseMultipart;
                break;
            case 'text/tsv':
                parser = parseFieldedText;
                break;
            case 'text/tab-separated-values':
                parser = parseFieldedText;
                break;
            case 'text/csv':
                parser = parseFieldedText;
                break;

            default:
                break;
        }

        // if we find no matches from the direct string comparisons, perform
        // more expensive regex matches. map any +json to application/json.
        // theoretically these could be mapped to application/json prior to the
        // switch statement, but putting it here allows us to skip the regex
        // entirely unless absolutely necessary. additional types could be
        // added later at some point.
        if (!parser) {
            if (regex.jsonContentType.test(type)) {
                parser = parseJson[0];
            }
        }

        if (parser) {
            parser(req, res, next);
        } else if (opts && opts.rejectUnknown) {
            next(new UnsupportedMediaTypeError(type));
        } else {
            next();
        }
    }

    return [read, parseBody];
}

module.exports = bodyParser;
