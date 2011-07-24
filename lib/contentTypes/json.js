
exports.contentHandler = function() {
  return function(string) {
    return JSON.parse(string);
  };
};

exports.contentWriter = function() {
  return function(body) {
    return JSON.stringify(body);
  };
};
