/**
 * Lib
 */

module.exports.post = function(message) {
  var slack_client = (function(){
    var Slack = require('slack-node');
    slack_client = new Slack();
    slack_client.setWebhook(process.env.SLACK_WEBHOOK_URL);
    return slack_client;
  })();
  
  var text = "billboard-tv-serverless からのポストだよ\n---\n" + message;
  
  slack_client.webhook({
    text: text
  }, function(err, response) {
    console.log(response);
  });
};
