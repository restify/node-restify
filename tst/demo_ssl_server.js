var fs = require('fs');
var restify = require('../lib/restify');

var server = restify.createServer({
  cert: fs.readFileSync(__dirname + '/test_cert.pem', 'ascii'),
  key: fs.readFileSync(__dirname + '/test_key.pem', 'ascii')
});

server.get('/', function(req, res, next) {
  console.log('GET / received');
  res.send(200, {
    hello: 'world'
  });
  return next();
});


server.listen(8443, function() {
  console.log('Running');
});
