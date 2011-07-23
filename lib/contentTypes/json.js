
exports.contentHandler = function() {
  return function(string) {
    return JSON.parse(body);
  };
};

exports.contentWriter = function() {
  return function(body) {
    return JSON.stringify(body);
  };
};
