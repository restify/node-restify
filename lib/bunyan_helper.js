// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var Stream = require('stream').Stream;
var util = require('util');

var assert = require('assert-plus');
var bunyan = require('bunyan');
var LRU = require('lru-cache');
var uuid = require('node-uuid');



///--- Globals

var sprintf = util.format;
var DEFAULT_REQ_ID = uuid.v4();
var STR_FMT = '[object %s<level=%d, limit=%d, maxRequestIds=%d>]';



///--- API

function RequestCaptureStream(opts) {
        assert.object(opts, 'options');
        assert.object(opts.stream, 'options.stream');
        assert.optionalNumber(opts.level, 'options.level');
        assert.optionalNumber(opts.maxRecords, 'options.maxRecords');
        assert.optionalNumber(opts.maxRequestIds, 'options.maxRequestIds');

        var self = this;
        Stream.call(this);

        this.level = opts.level || bunyan.WARN;
        this.limit = opts.maxRecords || 100;
        this.maxRequestIds = opts.maxRequestIds || 1000;
        this.requestMap = LRU({
                max: self.maxRequestIds
        });


        this._offset = -1;
        this._rings = [];
        for (var i = 0; i < this.maxRequestIds; i++) {
                this._rings.push(new bunyan.RingBuffer({
                        limit: self.limit
                }));
        }

        this.stream = opts.stream;
}
util.inherits(RequestCaptureStream, Stream);


RequestCaptureStream.prototype.write = function write(record) {
        var req_id = record.req_id || DEFAULT_REQ_ID;
        var ring;
        var self = this;

        if (!(ring = this.requestMap.get(req_id))) {
                if (++this._offset > this._rings.length)
                        this._offset = 0;
                ring = this._rings[this._offset];
                ring.records.length = 0;
                this.requestMap.set(req_id, ring);
        }

        assert.ok(ring, 'no ring found');

        if (record.level >= this.level) {
                ring.records.forEach(function (r) {
                        var s = JSON.stringify(r, bunyan.safeCycles()) + '\n';
                        self.stream.write(s);
                });
        } else {
                ring.write(record);
        }
};


RequestCaptureStream.prototype.toString = function toString() {
        return (sprintf(STR_FMT,
                        this.constructor.name,
                        this.level,
                        this.limit,
                        this.maxRequestIds));
};



///--- Serializers

function clientReq(req) {
        var host;

        try {
                host = req.host.split(':')[0];
        } catch (e) {
                host = false;
        }

        return ({
                method: req ? req.method : false,
                url: req ? req.path : false,
                address: host,
                port: req ? req.port : false,
                headers: req ? req.headers : false
        });
}


function clientRes(res) {
        if (!res || !res.statusCode)
                return (res);

        return ({
                statusCode: res.statusCode,
                headers: res.headers
        });
}



///--- Exports

module.exports = {
        RequestCaptureStream: RequestCaptureStream,
        serializers: {
                err: bunyan.stdSerializers.err,
                req: bunyan.stdSerializers.req,
                res: bunyan.stdSerializers.res,
                client_req: clientReq,
                client_res: clientRes
        },

        createLogger: function createLogger(name) {
                return (bunyan.createLogger({
                        name: name,
                        serializers: module.exports.serializers,
                        streams: [ {
                                level: 'warn',
                                stream: process.stderr
                        }, {
                                level: 'debug',
                                type: 'raw',
                                stream: new RequestCaptureStream({
                                        stream: process.stderr
                                })
                        } ]
                }));
        }
};
