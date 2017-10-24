var server = require('../../lib').createServer();
//var server = require('express')();

server.get('/echo/:name', function(req, res, next) {
    res.setHeader('content-type', 'text/plain');
    res.send(200, req.params.name);
});

server.listen(8080, function() {
    console.log('ready');
});
