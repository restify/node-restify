'use strict';
/* eslint-disable func-names */

if (require.cache[__dirname + '/lib/helper.js']) {
    delete require.cache[__dirname + '/lib/helper.js'];
}
var helper = require('./lib/helper.js');

///--- Globals

var test = helper.test;
var composer = require('../lib/helpers/chainComposer');

test('chainComposer creates a valid chain for a handler array ', function(t) {
    var counter = 0;
    var handlers = [];
    handlers.push(function(req, res, next) {
        counter++;
        next();
    });

    handlers.push(function(req, res, next) {
        counter++;
        next();
    });

    var chain = composer(handlers);
    chain(
        {
            startHandlerTimer: function() {},
            endHandlerTimer: function() {},
            closed: function() {
                return false;
            }
        },
        {},
        function() {
            t.equal(counter, 2);
            t.done();
        }
    );
});

test('chainComposer creates a valid chain for a single handler', function(t) {
    var counter = 0;
    var handlers = function(req, res, next) {
        counter++;
        next();
    };

    var chain = composer(handlers);
    chain(
        {
            startHandlerTimer: function() {},
            endHandlerTimer: function() {},
            closed: function() {
                return false;
            }
        },
        {},
        function() {
            t.equal(counter, 1);
            t.done();
        }
    );
});
