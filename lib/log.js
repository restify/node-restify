/* Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
 *
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
               _pad(d.getUTCMonth()),
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


var Level = {
  Trace: 6,
  Debug: 5,
  Info: 4,
  Warn: 3,
  Error: 2,
  Fatal: 1,
  Off: 0
};



// --- Globals for the file

var _level = Level.Info;
var _writer = process.stderr;
var _stdout = process.stdout;



module.exports = {

  trace: function() {
    if (arguments.length === 0) return _level >= Level.Trace;
    if (_level >= Level.Trace) _writer.write((_format('TRACE', arguments)));
  },


  debug: function() {
    if (arguments.length === 0) return _level >= Level.Debug;
    if (_level >= Level.Debug) _writer.write(_format('DEBUG', arguments));
  },


  info: function() {
    if (arguments.length === 0) return _level >= Level.Info;
    if (_level >= Level.Info) _writer.write(_format('INFO', arguments));
  },


  warn: function() {
    if (arguments.length === 0) return _level >= Level.Warn;
    if (_level >= Level.Warn) _writer.write(_format('WARN', arguments));
  },


  error: function() {
    if (arguments.length === 0) return _level >= Level.Error;
    if (_level >= Level.Error) _writer.write(_format('ERROR', arguments));
  },


  fatal: function() {
    if (arguments.length === 0) return _level >= Level.Fatal;
    if (_level >= Level.Fatal) _writer.write(_format('FATAL', arguments));
  },


  level: function(level) {
    if (level && typeof(level) === typeof(Level.Debug)) {
      _level = level;
    }
    return _level;
  },


  w3cLog: function(req, res, next) {
    // Logs in the W3C Common Log Format, almost.
    // Appended to the end is timing, since it's useful, and other
    // frameworks (i.e. sinatra/rack) do it too.
    var d = new Date();

    _stdout.write(req.connection.remoteAddress + ' - ' +
                  (req.username ? req.username : ' -') + ' [' +
                  _pad(d.getUTCDate()) + '/' +
                  _pad(d.getUTCMonth()) + '/' +
                  d.getUTCFullYear() + ':' +
                  _pad(d.getUTCHours()) + ':' +
                  _pad(d.getUTCMinutes()) + ':' +
                  _pad(d.getUTCSeconds()) + ' GMT] "' +
                  req.method + ' ' +
                  req.url +
                  ' HTTP/' + req.httpVersion + '" ' +
                  res._code + ' ' +
                  res._bytes + ' ' +
                  res._time + '\n'
                 );
    return next();
  },


  writeTo: function(stream) {
    if (stream && typeof(stream) === 'object') {
      if (stream.write && typeof(stream.write) === 'function') {
        _writer = stream;
      } else {
        throw new TypeError('log.writeTo: stream must be a Writable Stream.');
      }
    } else {
      throw new TypeError('log.writeTo: stream must be a Writable Stream.');
    }
  },


  stdoutTo: function(stream) {
    if (stream && typeof(stream) === 'object') {
      if (stream.write && typeof(stream.write) === 'function') {
        _stderr = stream;
      } else {
        throw new TypeError('log.stderrTo: stream must be a Writable Stream.');
      }
    } else {
      throw new TypeError('log.stderrTo: stream must be a Writable Stream.');
    }
  },


  Level: Level

};
