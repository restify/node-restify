// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.

module.exports = {

  createClient: function(options) {
    var client = require('./client');
    return new client(options);
  },

  createServer: function(options) {
    var server = require('./server');
    return server.createServer(options);
  },

  createThrottle: require('./throttle').createThrottle,

  HttpCodes: require('./http_codes'),

  log: require('./log'),

  LogLevel: require('./log').Level,

  newError: require('./error').newError,

  RestCodes: require('./rest_codes')


};
