// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.

/*
 * A (very) minimal log4j-like knockoff.
 *
 * Usage:
 *    var log = require('restify').log
 *    log.debug("some debug info: %o", myobj)   // sprintf string interpolation
 *    log.warn("I can't let you do that, %s.", dave)
 *
 * Output goes to stderr. Looks like this:
 *    2011-03-25 20:28:21Z DEBUG: some debug info: {'foo': 'bar'}
 *    2011-03-25 20:30:21Z WARN: I can't let you do that, Dave.
 *
 * Log levels are:
 *    trace     // access via `log.Level.Trace`
 *    debug
 *    info      // the default
 *    warn
 *    error
 *    fatal
 * Set the log level via:
 *    log.level(log.Level.Warn)
 *
 * The `log.debug()`, `log.info()`, et al functions double as the log4j
 * `isEnableFor`, `isDebugEnabled` functions when called without arguments.
 * So you can skip expensive computation that is only needed if at a
 * given log level:
 *    if (log.debug()) {
 *      // some expensive calculations to get
 *      some_debug_data = ...
 *      log.debug("debug data is: %o", some_debug_data)
 *    }
 *
 * Also, there is a `w3c()` function that will build you a restify interceptor,
 * suitable for being used as a `post` handler. It logs to stdout.
 *
 * To redirect stdout (w3c) or stderr (debug(), et al.), use the `stdout` and
 * `stderr` functions, respectively.  Both take a writeable stream.
 */

var assert = require('assert');
var util = require('util');

var sprintf = require('./sprintf').sprintf;



// --- Helpers

function _pad(val) {
  if (parseInt(val, 10) < 10) {
    val = '0' + val;
  }
  return val;
}


function _format(level, args) {
  var d = new Date();
  var _args = [null,
               d.getUTCFullYear(),
               _pad(d.getUTCMonth() + 1),
               _pad(d.getUTCDate()),
               _pad(d.getUTCHours()),
               _pad(d.getUTCMinutes()),
               _pad(d.getUTCSeconds()),
               level
              ];

  var _fmt = '%d-%s-%s %s:%s:%sZ %s: ';
  if (args.length > 1) {
    _args[0] = _fmt + args[0];
    for (var i = 1; i < args.length; i++) {
      _args.push(args[i]);
    }
  } else {
    _args[0] = _fmt + '%s';
    _args.push(args[0]);
  }

  return sprintf.apply(null, _args) + '\n';
}


function w3cLog(req, res, next) {
  // Logs in the W3C Common Log Format, almost.
  // Appended to the end is timing, since it's useful, and other
  // frameworks (i.e. sinatra/rack) do it too.
  var d = new Date();

  // HTTP and HTTPS are different -> joyent/node GH #1005
  var addr = req.connection.remoteAddress;
  if (!addr) {
    if (req.connection.socket) {
      addr = req.connection.socket.remoteAddress;
    } else {
      addr = 'unknown';
    }
  }

  _stdout.write(addr + ' - ' +
                (req.username ? req.username : ' -') + ' [' +
                _pad(d.getUTCDate()) + '/' +
                _pad(d.getUTCMonth() + 1) + '/' +
                d.getUTCFullYear() + ':' +
                _pad(d.getUTCHours()) + ':' +
                _pad(d.getUTCMinutes()) + ':' +
                _pad(d.getUTCSeconds()) + ' GMT] "' +
                req.method + ' ' +
                req.url +
                ' HTTP/' + req.httpVersion + '" ' +
                res.code + ' ' +
                res._bytes + ' ' +
                res._time + '\n'
               );
  return next();
}


function setStream(stream, writer) {
  if (!stream ||
      typeof(stream) !== 'object' ||
      !stream.write ||
      typeof(stream.write) !== 'function')
    throw new TypeError('stream must be a Writable Stream.');

  writer = stream;
}



//--- Globals for the file

var Level = {
  Trace: 6,
  Debug: 5,
  Info: 4,
  Warn: 3,
  Error: 2,
  Fatal: 1,
  Off: 0
};


var _level = Level.Info;
var _stderr = process.stderr;
var _stdout = process.stdout;



///--- Exported API

module.exports = {

  trace: function() {
    if (arguments.length === 0) return _level >= Level.Trace;
    if (_level >= Level.Trace) _stderr.write((_format('TRACE', arguments)));
  },


  debug: function() {
    if (arguments.length === 0) return _level >= Level.Debug;
    if (_level >= Level.Debug) _stderr.write(_format('DEBUG', arguments));
  },


  info: function() {
    if (arguments.length === 0) return _level >= Level.Info;
    if (_level >= Level.Info) _stderr.write(_format('INFO', arguments));
  },


  warn: function() {
    if (arguments.length === 0) return _level >= Level.Warn;
    if (_level >= Level.Warn) _stderr.write(_format('WARN', arguments));
  },


  error: function() {
    if (arguments.length === 0) return _level >= Level.Error;
    if (_level >= Level.Error) _stderr.write(_format('ERROR', arguments));
  },


  fatal: function() {
    if (arguments.length === 0) return _level >= Level.Fatal;
    if (_level >= Level.Fatal) _stderr.write(_format('FATAL', arguments));
  },


  level: function(level) {
    if (level) {
      if (typeof(level) === typeof(Level.Debug)) {
        _level = level;
      } else if (typeof(level) === 'string') {

        var upper = level.replace(/\b(.)(.*)/, function(m, first, rest) {
          return first.toUpperCase() + rest.toLowerCase();
        });

        var l = Level[upper];

        if (!l) {
          throw new TypeError('Unknown log level. Try one of these ' +
                              JSON.stringify(Level, null, 2));
        }

        _level = l;
      }
    }

    return _level;
  },


  // Legacy stream redirects
  writeTo: function(stream) {
    setStream(stream, _stderr);
  },
  stderrTo: function(stream) {
    setStream(stream, _stderr);
  },
  stdoutTo: function(stream) {
    setStream(stream, _stdout);
  },
  // End legacy stream redirects
  stderr: function(stream) {
    setStream(stream, _stderr);
  },
  stdout: function(stream) {
    setStream(stream, _stderr);
  },


  w3cLog: w3cLog,
  w3c: w3cLog,

  Level: Level

};
