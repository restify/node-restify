Content Writer modules go in here, named foo.js, where the content type is application/foo.

See the existing types for examples

## contentHandler
```javascript
function(string, req, res){
  //take a string and return an object
}
```

## contentWriter
```javascript
function(body, req, res){
  //take an object and return a string.
  //additionally, set any res.headers or res.code e.g. (see jsonp.js)
  res.code = 200;
}
