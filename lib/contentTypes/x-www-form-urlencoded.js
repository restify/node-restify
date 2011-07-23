var querystring = require('querystring');

exports.contentHandler = function(){
  return function(string){
    return querystring.parse(string) || {};
  }
}

exports.contentWriter = function()
  return function(body){
    data = querystring.stringify(_opts.body);
    data = data + '\n';
    return data;
  }
}
