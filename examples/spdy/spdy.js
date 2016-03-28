var fs = require('fs');
var bunyan = require('bunyan');
var restify = require('../../lib');
var restifyPlugins = require('restify-plugins');

var srv = restify.createServer({
    spdy: {
        cert: fs.readFileSync('./keys/spdy-cert.pem'),
        key: fs.readFileSync('./keys/spdy-key.pem'),
        ca: fs.readFileSync('keys/spdy-csr.pem')
    }
});

srv.get('/', function (req, res, next) {
    res.send({hello: 'world'});
    next();
});

srv.on('after', restifyPlugins.auditLogger({
    body: true,
    log: bunyan.createLogger({
        name: 'audit',
        stream: process.stdout
    })
}));

srv.listen(8080, function () {
    console.log('ready on %s', srv.url);
});
