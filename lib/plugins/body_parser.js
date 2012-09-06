// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var jsonParser = require('./json_body_parser');
var formParser = require('./form_body_parser');
var multipartParser = require('./multipart_parser');


function bodyParser(options) {
        var parseForm = formParser(options);
        var parseJson = jsonParser(options);
        var parseMultipart = multipartParser(options);

        function parseBody(req, res, next) {
                if (req.getContentLength() === 0 && !req.isChunked())
                        return (next());

                var parser;
                switch (req.getContentType()) {
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

                if (!parser)
                        return (next());

                return (parser(req, res, next));
        }

        return (parseBody);
}

module.exports = bodyParser;
