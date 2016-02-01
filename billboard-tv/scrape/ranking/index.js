/**
 * Lib
 */

module.exports.respond = function(event, cb) {

  var response = {
    message: "scrape/ranking/index.js"
  };

  return cb(null, response);
};
