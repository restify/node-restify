// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.

var errors = require('./error');

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

  RestCodes: require('./rest_codes'),

  TokenBucket: require('./throttle').TokenBucket,

  httpDate: require('./utils').newHttpDate

};


Object.keys(errors).forEach(function(k) {
  module.exports[k] = errors[k];
});
