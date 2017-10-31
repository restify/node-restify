'use strict';
/* eslint-disable func-names */

var assert = require('chai').assert;
var hrTimeDurationInMs = require('../../lib/plugins/utils/hrTimeDurationInMs');

describe('utils #hrTimeDurationInMs', function() {
    it('should return with duration', function() {
        var startTime = [0, 0];
        var endTime = [1, 1e6];

        var duration = hrTimeDurationInMs(startTime, endTime);

        assert.equal(duration, 1001);
    });
});
