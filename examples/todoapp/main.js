// Copyright (c) 2012 Mark Cavage. All rights reserved.

var fs = require('fs');
var path = require('path');

var pino = require('pino');
var getopt = require('posix-getopt');
var restify = require('restify');

var todo = require('./lib');

///--- Globals

var NAME = 'todoapp';

var LOG = pino({ name: NAME });

///--- Helpers

/**
 * Standard POSIX getopt-style options parser.
 *
 * Some options, like directory/user/port are pretty cut and dry, but note
 * the 'verbose' or '-v' option afflicts the log level, repeatedly. So you
 * can run something like:
 *
 * node main.js -p 80 -vv 2>&1 | npx pino-pretty
 *
 * And the log level will be set to TRACE.
 */
function parseOptions() {
    var option;
    var opts = {};
    var parser = new getopt.BasicParser('hvd:p:u:z:', process.argv);

    while ((option = parser.getopt()) !== undefined) {
        switch (option.option) {
            case 'd':
                opts.directory = path.normalize(option.optarg);
                break;

            case 'h':
                usage();
                break;

            case 'p':
                opts.port = parseInt(option.optarg, 10);
                break;

            case 'u':
                opts.user = option.optarg;
                break;

            case 'v':
                // Allows us to set -vvv -> this little hackery
                // just ensures that we're never < TRACE
                LOG.level(Math.max(pino.levels.values.trace, LOG.level - 10));

                if (LOG.level <= pino.levels.values.debug) {
                    LOG = LOG.child({ src: true });
                }
                break;

            case 'z':
                opts.password = option.optarg;
                break;

            default:
                usage('invalid option: ' + option.option);
                break;
        }
    }

    return opts;
}

function usage(msg) {
    if (msg) {
        console.error(msg);
    }

    var str =
        'usage: ' + NAME + ' [-v] [-d dir] [-p port] [-u user] [-z password]';
    console.error(str);
    process.exit(msg ? 1 : 0);
}

///--- Mainline

(function main() {
    var options = parseOptions();

    LOG.debug(options, 'command line arguments parsed');

    // First setup our 'database'
    var dir = path.normalize((options.directory || '/tmp') + '/todos');

    try {
        fs.mkdirSync(dir);
    } catch (e) {
        if (e.code !== 'EEXIST') {
            LOG.fatal(e, 'unable to create "database" %s', dir);
            process.exit(1);
        }
    }

    var server = todo.createServer({
        directory: dir,
        log: LOG
    });

    // At last, let's rock and roll
    server.listen(options.port || 8080, function onListening() {
        LOG.info('listening at %s', server.url);
    });
})();
