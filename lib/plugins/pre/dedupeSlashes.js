'use strict';


function createDedupeSlashes() {
    return function dedupeSlashes(req, res, next) {
        req.url = req.url.replace(/(\/)\/+/g, '$1');
        return next();
    };
}


module.exports = createDedupeSlashes;
