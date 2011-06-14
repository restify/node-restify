// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.

var assert = require('assert');




function _pad(val) {
  if (parseInt(val, 10) < 10) {
    val = '0' + val;
  }
  return val;
}



module.exports = {

  pad: _pad,


  newHttpDate: function rfc822(date) {
    if (!date)
      date = new Date();

    var months = ['Jan',
                  'Feb',
                  'Mar',
                  'Apr',
                  'May',
                  'Jun',
                  'Jul',
                  'Aug',
                  'Sep',
                  'Oct',
                  'Nov',
                  'Dec'];
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getUTCDay()] + ', ' +
      _pad(date.getUTCDate()) + ' ' +
      months[date.getUTCMonth()] + ' ' +
      date.getUTCFullYear() + ' ' +
      _pad(date.getUTCHours()) + ':' +
      _pad(date.getUTCMinutes()) + ':' +
      _pad(date.getUTCSeconds()) +
      ' GMT';
  },


  mergeFunctionArguments: function(argv, start, end) {
    assert.ok(argv);
    assert.ok(start);
    assert.ok(end);

    var handlers = [];

    for (var i = start; i < end; i++) {
      if (argv[i] instanceof Array) {
        var arr = argv[i];
        for (var j = 0; j < arr.length; j++) {
          if (!(arr[j] instanceof Function)) {
            throw new TypeError('Invalid argument type: ' + typeof(arr[j]));
          }
          handlers.push(arr[j]);
        }
      } else if (argv[i] instanceof Function) {
        handlers.push(argv[i]);
      } else {
        throw new TypeError('Invalid argument type: ' + typeof(argv[i]));
      }
    }

    return handlers;
  },


  extend: function(from, to) {
    if (!from || typeof(from) !== 'object') return;
    if (!to || typeof(to) !== 'object') return;

    var keys = Object.getOwnPropertyNames(from);
    keys.forEach(function(key) {
      var value = Object.getOwnPropertyDescriptor(from, key);
      Object.defineProperty(to, key, value);
    });
  },


  xor: function() {
    var x = false;
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i] && !x)
        x = true;
      else if (arguments[i] && x)
        return false;
    }
    return x;
  }

};

