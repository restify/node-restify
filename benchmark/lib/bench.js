#!/usr/bin/env node
'use strict';

var fork = require('child_process').fork;
var ora = require('ora');
var path = require('path');
var autocannon = require('./autocannon');
var pipeline = require('vasync').pipeline;

function runBenchmark(opts, handler, version, cb) {
    if (opts.track) {
        console.log(version.toUpperCase() + ':');
    }

    var spinner = ora('Started ' + version + '/' + handler).start();
    var modulePath = path.join(__dirname, '../benchmarks', handler);
    var url = require(modulePath).url;
    var forked = fork(modulePath, ['version=' + version]);

    pipeline(
        {
            funcs: [
                function warm(_, callback) {
                    spinner.color = 'magenta';
                    spinner.text =
                        'Warming ' + version + '/' + handler + ' for 5s';

                    var fireOpts = Object.assign({}, opts, {
                        duration: 5,
                        url: url
                    });
                    autocannon.fire(
                        fireOpts,
                        handler,
                        version,
                        false,
                        callback
                    );
                },

                function benchmark(_, callback) {
                    if (opts.track) {
                        spinner.stop();
                    } else {
                        spinner.color = 'yellow';
                        spinner.text =
                            'Benchmarking ' +
                            version +
                            '/' +
                            handler +
                            ' for ' +
                            opts.duration +
                            's';
                    }

                    var fireOpts = Object.assign({}, opts, { url: url });
                    autocannon.fire(fireOpts, handler, version, true, callback);
                }
            ]
        },
        function onPipelineFinished(err) {
            forked.kill('SIGINT');

            if (err) {
                spinner.fail();
                cb(err);
                return;
            }

            spinner.text = 'Results saved for ' + version + '/' + handler;
            spinner.succeed();

            cb();
        }
    );
}

function start(opts, list, index) {
    index = index || 0;

    // No more item
    if (list.length === index) {
        return;
    }

    var handler = list[index];
    console.log('---- ' + handler + ' ----');

    pipeline(
        {
            funcs: [
                function head(_, callback) {
                    runBenchmark(opts, handler, 'head', callback);
                },
                function stable(_, callback) {
                    if (!opts.compare) {
                        callback();
                        return;
                    }
                    runBenchmark(opts, handler, 'stable', callback);
                }
            ]
        },
        function onPipelineFinished(err) {
            if (err) {
                console.log(err);
                return;
            }

            // Compare versions
            if (opts.compare) {
                var result = autocannon.compare(handler);

                console.log(handler + ' throughput:');
                console.log(JSON.stringify(result.throughput, null, 4) + '\n');
            }

            // Benchmark next handler
            start(opts, list, ++index);
        }
    );
}

module.exports = start;
