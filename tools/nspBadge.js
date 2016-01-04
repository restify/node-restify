#!/usr/bin/env node

'use strict';

var fs = require('fs');
var path = require('path');

var README_PATH = path.join(__dirname, '../README.md');
/* jscs:disable maximumLineLength */
var FAIL_BADGE = 'vulnerabilities%20found-red';
var SUCCESS_BADGE = 'no%20vulnerabilities-green';
var NSP_LINE_ID = '[NSP Status]';
/* jscs:enable maximumLineLength */

process.stdin.on('data', function (exitCodeBuf) {

    var nspExitCode = parseInt(exitCodeBuf.toString(), 10);

    if (isNaN(nspExitCode)) {
        // output any success message
        console.warn(exitCodeBuf.toString());
        nspExitCode = 0;
    }

    var readmeStr = fs.readFileSync(README_PATH).toString();

    var out = processLines(nspExitCode, readmeStr);

    // now write it back out
    fs.writeFileSync(README_PATH, out);
});

function processLines(exitCode, readmeStr) {
    var lines = readmeStr.toString().split('\n');
    var outLines = '';

    lines.forEach(function (line) {
        if (line.indexOf(NSP_LINE_ID) > -1) {
            if (exitCode === 0) {
                outLines += line.replace(FAIL_BADGE, SUCCESS_BADGE) + '\n';
            } else {
                outLines += line.replace(SUCCESS_BADGE, FAIL_BADGE) + '\n';
            }
        } else {
            outLines += line + '\n';
        }
    });

    // chop off last newline
    return outLines.slice(0, -1);
}
