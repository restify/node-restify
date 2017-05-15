// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var assert = require('assert-plus');
var errors = require('restify-errors');

var bodyReader = require('./bodyReader');
var jsonParser = require('./jsonBodyParser');
var formParser = require('./formBodyParser');
var multipartParser = require('./multipartBodyParser');
var fieldedTextParser = require('./fieldedTextBodyParser.js');


///--- Globals

var UnsupportedMediaTypeError = errors.UnsupportedMediaTypeError;


///--- API

/**
 * parse the body of an incoming request.
 * @public
 * @function bodyParser
 * @throws   {UnsupportedMediaTypeError}
 * @param    {Object} options an option object
 * @returns  {Array}
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

        if (parser) {
            parser(req, res, next);
        } else if (opts && opts.rejectUnknown) {
            next(new UnsupportedMediaTypeError(type));
        } else {
            next();
        }
    }

    return ([read, parseBody]);
}

module.exports = bodyParser;
