module.exports.respond = function(event, cb) {
  
  var Promise = require("bluebird");
  var Google = require('googleapis');
  var youtube_client = Google.youtube('v3');
  var slack_client = require('../../lib/slack.js');
  
  var oauth2Client = (function(){
    var OAuth2 = Google.auth.OAuth2;
    var oauth2Client = new OAuth2(
      process.env.GOOGLE_API_CLIENT_ID,
      process.env.GOOGLE_API_CLIENT_SECRET,
      process.env.GOOGLE_API_REDIRECT_URL
    );
    oauth2Client.setCredentials({
      access_token: process.env.GOOGLE_API_ACCESS_TOKEN,
      refresh_token: process.env.GOOGLE_API_REFRESH_TOKEN,
    });
    return oauth2Client;
  })();
  
  var fetch_ranking_json = new Promise(function(resolve, reject){
    var http_client = require('superagent');
    http_client.get('http://billboard-tv.tk/ranking.json')
    .end(function(error, res){
      if (error) { throw new Error(error); return; }
      resolve(JSON.parse(res.text));
    });
  });
  
  var ranking_json = {};
  var playlist_title = '';
  
  fetch_ranking_json.then(function(ranking_json_res){
    return new Promise(function(resolve, reject){
      ranking_json = ranking_json_res;
      playlist_title = 'Billboard Chart Hot 100 - ' + ranking_json['date'];
      
      var request = youtube_client.playlists.list({
        auth: oauth2Client,
        part: 'snippet',
        channelId: 'UCm8HacZNgIMAv2zg3OxexGQ',
        maxResults: 50,
        fields: 'items(id,snippet)'
      }, function(error, playlists_res){
        if (error) { console.log('youtube playlist request error: ' + JSON.stringify(error)); return; }
        playlists_res['items'].forEach(function(obj, i, arr){
          if (obj['title'] === playlist_title) {
            // finish
            cb(null, 'Nothing todo. Playlist has already created.');
            return;
          }
          if (arr.length === i + 1) {
            resolve(playlists_res);
          }
        });
      });
    });
  })
  .then(function(playlists_res){
    return new Promise(function(resolve, reject){
      youtube_client.playlists.insert({
        auth: oauth2Client,
        part: 'snippet, status',
        resource: {
          snippet: {
            title: playlist_title,
            description: 'description here',
          },
          status: {
            privacyStatus: 'public'
          }
        }
      }, function(error, res){
        if (error) { console.log('playlist insert error: ' + JSON.stringify(error)); return; }
        resolve(res);
      });
    });
  })
  .then(function(res){
    console.log('res: ' + JSON.stringify(res));
    cb(null, 'create playlist');
  });
  
};
