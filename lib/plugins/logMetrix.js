'use strict';

var bunyan = require('bunyan');

function LogMetrix(options) {
    var DEFAULTBUFSIZE = 500;
    this.logBuffer = new bunyan.RingBuffer({
        limit: options.bufSize || DEFAULTBUFSIZE
    });
}

LogMetrix.prototype.pushLog = function (data) {
    //need to map the object to remove circular dependency on req, res
    var logData = {
        remoteAddress: data.remoteAddress,
        remotePort: data.remotePort,
        req_id: data.req_id,
        req_headers: data.req.headers,
        req_route: data.req.route,
        err: data.err,
        latency: data.latency,
        secure: data.secure,
        _audit: data._audit,
        timestamp: data.timestamp
    };
    this.logBuffer.write(logData);
};

LogMetrix.prototype.getLog = function () {
    return this.logBuffer;
};

module.exports = LogMetrix;
