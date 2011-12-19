// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');



module.exports = {

  argsToChain: function argsToChain() {
    assert.ok(arguments.length);

    var args = arguments[0];
    if (args.length < 0)
      throw new TypeError('handler (Function) required');

    var chain = [];

    function process(handlers) {
      handlers.forEach(function(h) {
        if (Array.isArray(h))
          return process(h);
        if (!typeof(h) === 'function')
          throw new TypeError('handlers must be Functions');

        return chain.push(h);
      });
    }
    process(Array.prototype.slice.call(args, 0));

    return chain;
  }

};
