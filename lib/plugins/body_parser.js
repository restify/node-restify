// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var jsonParser = require('./json_body_parser');
var formParser = require('./form_body_parser');
var multipartParser = require('./multipart_parser');


function bodyParser(options) {

        var parseForm = formParser(options);
        var parseJson = jsonParser(options);
        var parseMultipart = multipartParser(options);

        return function parseBody(req, res, next) {
                if (req.contentLength === 0 && !req.chunked)
                        return (next());

                var parser;
                switch (req.contentType) {
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
                if (req.contentType === 'application/json') {
                        return parseJson(req, res, next);
                } else if (req.contentType === 'application/x-www-form-urlencoded') {
                        return parseForm(req, res, next);
                } else if (req.contentType === 'multipart/form-data') {
                        return parseMultipart(req, res, next);
                }

                return (parser ? parser(req, res, next) : next());
        };
}

module.exports = bodyParser;
