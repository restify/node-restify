'use strict';

var NS_PER_SEC = 1e9;
var MS_PER_NS = 1e6;

/**
* Get duration in milliseconds from two process.hrtime()

* @function hrTimeDurationInMs
* @param {Array} startTime - [seconds, nanoseconds]
* @param {Array} endTime - [seconds, nanoseconds]
* @returns {Number|null} durationInMs
*/
function hrTimeDurationInMs(startTime, endTime) {
    if (!Array.isArray(startTime) || !Array.isArray(endTime)) {
        return null;
    }

    var secondDiff = endTime[0] - startTime[0];
    var nanoSecondDiff = endTime[1] - startTime[1];
    var diffInNanoSecond = secondDiff * NS_PER_SEC + nanoSecondDiff;

    return Math.round(diffInNanoSecond / MS_PER_NS);
}

module.exports = hrTimeDurationInMs;
