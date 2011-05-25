// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.

function _pad(val) {
  if (parseInt(val, 10) < 10) {
    val = '0' + val;
  }
  return val;
}


function _rfc822(date) {
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
}


function _mergeFnArgs(argv, offset) {
  var _handlers = [];

  for (var i = offset; i < argv.length; i++) {
    if (argv[i] instanceof Array) {
      var arr = argv[i];
      for (var j = 0; j < arr.length; j++) {
        if (!(arr[j] instanceof Function)) {
          throw new TypeError('Invalid argument type: ' + typeof(arr[j]));
        }
        _handlers.push(arr[j]);
      }
    } else if (argv[i] instanceof Function) {
      _handlers.push(argv[i]);
    } else {
      throw new TypeError('Invalid argument type: ' + typeof(argv[i]));
    }
  }

  return _handlers;
}



Object.defineProperty(Object.prototype, "_restify_extend", {
  enumerable: false,
  value: function(from) {
    if (!from || typeof(from) !== 'object') return this;
    var keys = Object.getOwnPropertyNames(from);
    var self = this;
    keys.forEach(function(key) {
      var value = Object.getOwnPropertyDescriptor(from, key);
      Object.defineProperty(self, key, value);
    });
    return this;
  }
});



module.exports = {

  pad: _pad,

  newHttpDate: _rfc822,

  mergeFunctionArguments: _mergeFnArgs

};

