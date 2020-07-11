'use strict';

const stream = require('stream');

class StreamRecorder extends stream.Writable {
    constructor(options) {
        options = options || {};
        super(options);
        this.flushRecords();
    }

    _write(chunk, encoding, callback) {
        const record = JSON.parse(chunk.toString());
        this.records.push(record);
        callback();
    }

    flushRecords() {
        this.records = [];
    }
}

module.exports = StreamRecorder;
