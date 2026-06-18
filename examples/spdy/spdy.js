// MIGRATION NOTICE: This example has been updated to use HTTP/2 instead of SPDY
// SPDY support is deprecated and will be removed in a future version
// Please use the 'http2' option instead of 'spdy' option

var path = require('path');
var fs = require('fs');
var pino = require('pino');
var restify = require('../../lib');

// OLD (DEPRECATED) - using SPDY:
// var srv = restify.createServer({
//     spdy: {
//         cert: fs.readFileSync(path.join(__dirname, './keys/spdy-cert.pem')),
//         key: fs.readFileSync(path.join(__dirname, './keys/spdy-key.pem')),
//         ca: fs.readFileSync(path.join(__dirname, 'keys/spdy-csr.pem'))
//     }
// });

// NEW - using native HTTP/2:
var srv = restify.createServer({
    http2: {
        cert: fs.readFileSync(path.join(__dirname, './keys/spdy-cert.pem')),
        key: fs.readFileSync(path.join(__dirname, './keys/spdy-key.pem')),
        ca: fs.readFileSync(path.join(__dirname, 'keys/spdy-csr.pem')),
        allowHTTP1: true // Allow HTTP/1.1 fallback for compatibility
    }
});

srv.get('/', function(req, res, next) {
    res.send({ hello: 'world' });
    next();
});

srv.on(
    'after',
    restify.plugins.auditLogger({
        event: 'after',
        body: true,
        log: pino({ name: 'audit' })
    })
);

srv.listen(8080, function() {
    console.log('ready on %s', srv.url);
});
