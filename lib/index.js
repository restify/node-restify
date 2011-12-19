// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var errors = require('./errors');
var Server = require('./server');



///--- Exported API

module.exports = {

  createServer: function createServer(options) {
    return new Server(options || {});
  }

};



