// Copyright 2012 Pedro Palazón, Mark Cavage, Inc.  All rights reserved.

// This is just a wrapper around HttpClient, JsonClient or
// StringClient to use node-pooling instead of default http(s) globalAgent.

var pooling = require('pooling'),
    uuid = require('node-uuid'),
    assert = require('assert'),
    args = require('../args'),
    util = require('util');

/// --- The real clients:

var HttpClient = require('./http_client');
var JsonClient = require('./json_client');
var StringClient = require('./string_client');

///--- Globals

var assertObject = args.assertObject;
var assertString = args.assertString;
var assertFunction = args.assertFunction;


function PoolingClient(options) {
        assertObject('options', options);
        assertObject('options.pooling', options.pooling);
        assertObject('options.log', options.log);
        if (options.pooling.check) {
                assertFunction('options.pooling.check', options.pooling.check);
        }
        if (!options.pooling.log) {
                options.pooling.log = options.log;
        }
        if (!options.pooling.name) {
                options.pooling.name = options.name || 'PoolingClient';
        }
        if (!options.pooling.max) {
                options.pooling.max = 1;
        }
        // Explicitly set options.agent to false:
        options.agent = false;
        // callback is of the form function (err, client).
        options.pooling.create = function create(callback) {
                var client;
                try {
                        switch (options.type) {
                        case 'json':
                                client = new JsonClient(options);
                                break;

                        case 'string':
                                client = new StringClient(options);
                                break;

                        case 'http':
                        default:
                                client = new HttpClient(options);
                                break;
                        }
                        // Identify this client with an uuid:
                        client.id = uuid();
                        // Review if this is needed and correct here:
                        if (options.username && options.password) {
                            client.basicAuth(options.username, options.password);
                        }
                        return callback(null, client);
                } catch (e) {
                        return callback(e);
                }
        }

        // discarded, just remove uuid.
        options.pooling.destroy =  function destroy(client) {
            client.was = client.id;
            client.id = -1;
        }

        this.pool = pooling.createPool(options.pooling);
        this.log = options.log;
}

module.exports = PoolingClient;


PoolingClient.prototype.request = function request(method, options, body, callback) {
        var self = this;
        options.agent = false;
        if (typeof (body) === 'function') {
                callback = body;
        }
        self.pool.acquire(function (err, client) {
                if (err) {
                        self.log.error({err: err}, 'Unable to acquire: %s',
                            err.stack);
                        return callback(err);
                } else {
                        if (typeof (body) === 'function') {
                                return client[method](options, callback);
                        } else {
                                return client[method](options, body, callback);
                        }
                }
        });
};


PoolingClient.prototype.del = function del(options, callback) {
        return this.request('del', options, callback);
};


PoolingClient.prototype.get = function get(options, callback) {
        return this.request('get', options, callback);
};


PoolingClient.prototype.head = function head(options, callback) {
        return this.request('head', options, callback);
};


PoolingClient.prototype.post = function post(options, body, callback) {
        return this.request('post', options, body, callback);
};


PoolingClient.prototype.put = function put(options, body, callback) {
        return this.request('put', options, body, callback);
};
