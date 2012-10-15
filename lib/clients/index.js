// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var HttpClient = require('./http_client');
var JsonClient = require('./json_client');
var StringClient = require('./string_client');


///--- Exports

module.exports = {
        HttpClient: HttpClient,
        JsonClient: JsonClient,
        StringClient: StringClient
};
