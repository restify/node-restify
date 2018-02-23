'use strict';

var autocannon = require('autocannon');
var fs = require('fs');
var autocannonCompare = require('autocannon-compare');
var path = require('path');

var resultsDirectory = path.join(__dirname, '../results');

function writeResult(handler, version, result) {
    try {
        fs.accessSync(resultsDirectory);
    } catch (e) {
        fs.mkdirSync(resultsDirectory);
    }

    result.server = handler;

    var dest = path.join(resultsDirectory, handler + '-' + version + '.json');
    return fs.writeFileSync(dest, JSON.stringify(result, null, 4));
}

function fire(opts, handler, version, save, cb) {
    opts = opts || {};
    opts.url = opts.url || 'http://localhost:3000';

    var instance = autocannon(opts, function onResult(err, result) {
        if (err) {
            cb(err);
            return;
        }

        if (save) {
            writeResult(handler, version, result);
        }

        cb();
    });

    if (opts.track && save) {
        autocannon.track(instance);
    }
}

function compare(handler) {
    var resStable = require(resultsDirectory + '/' + handler + '-stable.json');
    var resHead = require(resultsDirectory + '/' + handler + '-head.json');
    var comp = autocannonCompare(resStable, resHead);
    var result = {
        throughput: {
            significant: comp.throughput.significant
        }
    };

    if (comp.equal) {
        result.throughput.equal = true;
    } else if (comp.aWins) {
        result.throughput.equal = false;
        result.throughput.wins = 'stable';
        result.throughput.diff = comp.throughput.difference;
    } else {
        result.throughput.equal = false;
        result.throughput.wins = 'head';
        result.throughput.diff = autocannonCompare(
            resHead,
            resStable
        ).throughput.difference;
    }

    return result;
}

module.exports = {
    fire: fire,
    compare: compare
};
