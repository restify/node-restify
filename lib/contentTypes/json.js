
exports.contentHandler = function(){
  function(string){
    return JSON.parse(body);
  }
}

exports.contentWriter = function(){
  function(body){
    return JSON.stringify(body);
  }
}
