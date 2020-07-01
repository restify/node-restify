var path = require('path');
var fs = require('fs');
var pino = require('pino');
var restify = require('../../lib');

var srv = restify.createServer({
    http2: {
        cert: fs.readFileSync(path.join(__dirname, './keys/http2-cert.pem')),
        key: fs.readFileSync(path.join(__dirname, './keys/http2-key.pem')),
        ca: fs.readFileSync(path.join(__dirname, 'keys/http2-csr.pem'))
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
        log: pino(
            { name: 'audit' },
            process.stdout
        )
    })
);

srv.listen(8080, function() {
    console.log('ready on %s', srv.url);
});
