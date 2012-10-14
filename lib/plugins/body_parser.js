// Copyright 2012 Mark Cavage, Inc.  All rights reserved.
var errors = require('../errors');

var jsonParser = require('./json_body_parser');
var formParser = require('./form_body_parser');
var multipartParser = require('./multipart_parser');



///--- Globals

var UnsupportedMediaTypeError = errors.UnsupportedMediaTypeError;



///--- API

function bodyParser(options) {
        var parseForm = formParser(options);
        var parseJson = jsonParser(options);
        var parseMultipart = multipartParser(options);

        function parseBody(req, res, next) {
                if (req.method === 'GET' || req.method === 'HEAD') {
                        next();
                        return;
                }
                if (req.contentLength() === 0 && !req.isChunked()) {
                        next();
                        return;
                }

                var parser;
                var type = req.contentType();
                switch (type) {
                case 'application/json':
                        parser = parseJson;
                        break;
                case 'application/x-www-form-urlencoded':
                        parser = parseForm;
                        break;
                case 'multipart/form-data':
                        parser = parseMultipart;
                        break;
                default:
                        break;
                }

                if (parser) {
                        parser(req, res, next);
                } else if (options && options.rejectUnknown) {
                        next(new UnsupportedMediaTypeError(type));
                } else {
                        next();
                }
        }

        return (parseBody);
}

module.exports = bodyParser;
