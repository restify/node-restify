// Copyright 2011 Mark Cavage, Inc.  All rights reserved.



///--- Globals

var FMT_STR = '%d-%s-%s %s:%s:%sZ %s - %s: ';

var _i = 0;
var LEVELS = {
  Trace: _i++,
  Debug: _i++,
  Info: _i++,
  Warn: _i++,
  Error: _i++,
  Fatal: _i++
};

var level = 'Info';



// --- Helpers

function pad(val) {
  if (parseInt(val, 10) < 10) {
    val = '0' + val;
  }
  return val;
}


function format(level, name, args) {
  var d = new Date();
  var fmtStr = args.shift();
  var fmtArgs = [
    d.getUTCFullYear(),
    pad(d.getUTCMonth() + 1),
    pad(d.getUTCDate()),
    pad(d.getUTCHours()),
    pad(d.getUTCMinutes()),
    pad(d.getUTCSeconds()),
    level,
    name
  ];

  args = fmtArgs.concat(args);

  var output = (FMT_STR + fmtStr).replace(/%[sdj]/g, function(match) {
    switch (match) {
    case '%s': return new String(args.shift());
    case '%d': return new Number(args.shift());
    case '%j': return JSON.stringify(args.shift());
    default:
      return match;
    }
  });

  return output;
}



///--- API

function Log(name) {
  this.name = name;
}

Log.prototype._write = function(level, args) {
  var data = format(level, this.name, args);
  console.error(data);
};

Log.prototype.isTraceEnabled = function() {
  return (LEVELS.Trace >= LEVELS[level]);
};

Log.prototype.trace = function() {
  if (this.isTraceEnabled())
    this._write('TRACE', Array.prototype.slice.call(arguments));
};

Log.prototype.isDebugEnabled = function() {
  return (LEVELS.Debug >= LEVELS[level]);
};

Log.prototype.debug = function() {
  if (this.isDebugEnabled())
    this._write('DEBUG', Array.prototype.slice.call(arguments));
};

Log.prototype.isInfoEnabled = function() {
  return (LEVELS.Info >= LEVELS[level]);
};

Log.prototype.info = function() {
  if (this.isInfoEnabled())
    this._write('INFO', Array.prototype.slice.call(arguments));
};

Log.prototype.isWarnEnabled = function() {
  return (LEVELS.Warn >= LEVELS[level]);
};

Log.prototype.warn = function() {
  if (this.isWarnEnabled())
    this._write('WARN', Array.prototype.slice.call(arguments));
};

Log.prototype.isErrorEnabled = function() {
  return (LEVELS.Error >= LEVELS[level]);
};

Log.prototype.error = function() {
  if (this.isErrorEnabled())
    this._write('ERROR', Array.prototype.slice.call(arguments));
};

Log.prototype.isFatalEnabled = function() {
  return (LEVELS.Fatal >= LEVELS[level]);
};

Log.prototype.fatal = function() {
  if (this.isFatalEnabled())
    this._write('FATAL', Array.prototype.slice.call(arguments));
};


module.exports = {

  setLevel: function(l) {
    l = l.charAt(0).toUpperCase() + l.slice(1).toLowerCase();
    if (LEVELS[l] !== undefined)
      level = l;

    return level;
  },

  getLogger: function(name) {
    if (!name || typeof(name) !== 'string')
      throw new TypeError('name (string) required');

    return new Log(name);
  },

  setGlobalLogLevel: function(l) {
    l = l.charAt(0).toUpperCase() + l.slice(1).toLowerCase();
    if (LEVELS[l] !== undefined)
      level = l;

    return level;
  }

};
