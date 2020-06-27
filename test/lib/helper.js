// Copyright 2012 Mark Cavage.  All rights reserved.
//
// Just a simple wrapper over nodeunit's exports syntax. Also exposes
// a common logger for all tests.
//

'use strict';
/* eslint-disable func-names */

var domain = require('domain');

var bunyan = require('bunyan');
var once = require('once');

var restify = require('../../lib');

///--- Exports

module.exports = {
    after: function after(teardown) {
        module.parent.exports.tearDown = function _teardown(callback) {
            var d = domain.create();
            var self = this;

            d.once('error', function(err) {
                console.error('after: uncaught error\n', err.stack);
                process.exit(1);
            });

            d.run(function() {
                teardown.call(self, once(callback));
            });
        };
    },

    before: function before(setup) {
        module.parent.exports.setUp = function _setup(callback) {
            var d = domain.create();
            var self = this;

            d.once('error', function(err) {
                console.error('before: uncaught error\n' + err.stack);
                process.exit(1);
            });

            d.run(function() {
                setup.call(self, once(callback));
            });
        };
    },

    test: function test(name, tester) {
        module.parent.exports[name] = function _(t) {
            var d = domain.create();
            var self = this;

            d.once('error', function(err) {
                t.ifError(err);
                t.end();
            });

            d.add(t);
            d.run(function() {
                t.end = once(function() {
                    t.done();
                });
                t.notOk = function notOk(ok, message) {
                    return t.ok(!ok, message);
                };

                tester.call(self, t);
            });
        };
    },

    getLog: function(name, streams, level) {
        return bunyan.createLogger({
            level: process.env.LOG_LEVEL || level || 'fatal',
            name: name || process.argv[1],
            streams: streams || [{ stream: process.stdout }],
            src: true,
            serializers: restify.bunyan.serializers
        });
    },

    get dtrace() {
        return true;
    },

    sleep: function sleep(timeInMs) {
        return new Promise(function sleepPromise(resolve) {
            setTimeout(function timeout() {
                resolve();
            }, timeInMs);
        });
    }
};
