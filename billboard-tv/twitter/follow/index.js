/**
 * Lib
 */

module.exports.respond = function(event, cb) {

  var response = {
    message: "twitter/follow/index.js"
  };

  return cb(null, response);
};
