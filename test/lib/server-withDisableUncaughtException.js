// A simple node process that will start a restify server with the
// uncaughtException handler disabled. Responds to a 'serverPortRequest' message
// and sends back the server's bound port number.

'use strict';
/* eslint-disable func-names */

var restify = require('../../lib');

function main() {
    var port = process.env.UNIT_TEST_PORT || 0;
    var server = restify.createServer({ handleUncaughtExceptions: false });
    server.get('/', function(req, res, next) {
        throw new Error('Catch me!');
    });
    server.listen(0, function() {
        port = server.address().port;
        console.log('port: ', port);

        process.on('message', function(msg) {
            if (msg.task !== 'serverPortRequest') {
                process.send({ error: 'Unexpected message: ' + msg });
                return;
            }
            process.send({ task: 'serverPortResponse', port: port });
        });
    });
}

if (require.main === module) {
    main();
}
