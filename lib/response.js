// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');



///--- Prototype extensions

/**
 * You can cll
 */
http.ServerResponse.prototype.send = function send() {

};



///--- Exported extend API

module.exports = {

  extend: function extend(res, options) {
    assert.ok(res);
    assert.ok(options);
    assert.ok(options.log4js);
    assert.ok(options.requestId);

    res.log4js = options.log4js;
    res.log = res.log4js.getLogger('Response');

    res.__defineSetter__('contentType', function(type) {
      if (typeof(type) !== 'string')
        throw new TypeError('contentType must be String');

      res.setHeader('Content-Type', type);
    });

    res.__defineGetter__('requestId', function() {
      return options.requestId;
    });

    return res;
  }

};
