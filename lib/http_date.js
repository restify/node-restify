// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var sprintf = require('util').format;



///--- Globals

var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

var MONTHS = [
        'Jan',
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
        'Dec'
];

// Tue, 01 Dec 2009 08:48:25 GMT
var RFC_822_FMT = '%s, %s %s %s %s:%s:%s GMT';



///--- API

function pad(val) {
        if (parseInt(val, 10) < 10)
                val = '0' + val;

        return (val);
}

function httpDate(now) {
        if (!now)
                now = new Date();

        var str = sprintf(RFC_822_FMT,
                          DAYS[now.getUTCDay()],
                          pad(now.getUTCDate()),
                          MONTHS[now.getUTCMonth()],
                          now.getUTCFullYear(),
                          pad(now.getUTCHours()),
                          pad(now.getUTCMinutes()),
                          pad(now.getUTCSeconds()));

        return (str);
}



///--- Exports

module.exports = httpDate;
