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
  
  var oauth = new Promise(function(resolve, reject){
    console.log('oauth');
    oauth2Client.refreshAccessToken(function(error, tokesn){
      oauth2Client.setCredentials(tokesn);
      if (error) { throw new Error(error); return; }
      resolve();
    });
  });
  
  var fetch_ranking_json = new Promise(function(resolve, reject){
    console.log('fetch_ranking_json');
    var http_client = require('superagent');
    http_client.get('http://billboard-tv.tk/ranking.json')
    .end(function(error, res){
      if (error) { throw new Error(error); return; }
      resolve(JSON.parse(res.text));
    });
  });
  
  var ranking_json = {};
  var playlist_title = '';
  
  oauth.then(function(){
    return fetch_ranking_json;
  }).then(function(ranking_json_res){
    console.log('get playlist');
    return new Promise(function(resolve, reject){
      ranking_json = ranking_json_res;
      playlist_title = 'Billboard Chart Hot 100 - ' + ranking_json['date'];
      
      youtube_client.playlists.list({
        auth: oauth2Client,
        part: 'snippet',
        channelId: 'UCm8HacZNgIMAv2zg3OxexGQ',
        maxResults: 50, // TODO: pagenation loop
        fields: 'items(id,snippet)'
      }, function(error, playlists_res){
        if (error) { console.log('youtube playlist request error: ' + JSON.stringify(error)); return; }
        if (playlists_res['items'].length === 0) { resolve(); return; }
        
        var loop_count = 0;
        playlists_res['items'].forEach(function(obj, i, arr){
          loop_count += 1;
          if (obj['snippet']['title'] === playlist_title) {
            // finish
            // cb(null, 'Nothing todo. Playlist has already created.');
            // return true;
            resolve(obj['id']);
          }
          if (arr.length === loop_count) {
            resolve();
          }
        });
      });
    });
  })
  .then(function(debug_playlist_id){
    console.log('create playlist');
    return new Promise(function(resolve, reject){
      if (debug_playlist_id) { resolve(debug_playlist_id); return; }
      
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
        resolve(res['id']);
      });
    });
  })
  .then(function(playlist_id){
    console.log('insert playlist items');
    return new Promise(function(resolve, reject){
      var loop_count = 0;
      ranking_json['ranking'].forEach(function(obj, i, arr){
      // for (var i=0; i<=ranking_json['ranking'].length; i++) {
        youtube_client.playlistItems.insert({
          auth: oauth2Client,
          part: 'snippet',
          resource: {
            snippet: {
              playlistId: playlist_id,
              resourceId: {
                videoId: obj['video_id'],
                // videoId: ranking_json['ranking'][i]['video_id'],
                kind: 'youtube#video'
              }
            }
          }
        }, function(error, res){
          loop_count += 1;
          if (error) { console.log('playlistItem insert error: ' + JSON.stringify(error)); return; }
          console.log('loop_count: ' + loop_count + ', title: ' + res['snippet']['title']);
          
          if (ranking_json['ranking'].length === loop_count) {
            resolve();
          }
        });
      });
    });
  })
  .then(function(){
    console.log('finish');
    cb(null, 'create playlist');
  });
  
};
