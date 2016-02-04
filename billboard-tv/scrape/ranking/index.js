/**
 * Lib
 */

module.exports.respond = function(event, cb) {

  var s3_client = (function(){
    var AWS = require('aws-sdk');
    AWS.config.update({
      'accessKeyId': process.env.AWS_ACCESS_KEY_ID,
      'secretAccessKey': process.env.AWS_SECRET_ACCESS_KEY,
      'region': process.env.AWS_REGION
    });
    return new AWS.S3();
  })();
  
  var youtube_client = (function(){
    var Youtube = require('youtube-node');
    var youtube_client = new Youtube();
    youtube_client.setKey(process.env.YOUTUBE_API_KEY);
    youtube_client.addParam('order', 'relevance');
    youtube_client.addParam('type', 'video');
    return youtube_client;
  })();
  
  var search_youtube_video_id = function(keyword, callback){
    youtube_client.search(keyword, 1, function(error, result){
      if (error) { throw new Error(error); return; }
      if (result.items.length === 0) { callback(''); return; }
      
      var item = result["items"][0];
      var video_id = item["id"]["videoId"];
      callback(video_id);
    });
  };
  
  var splitter = function(string) {
    return string.replace(/\t/g , '').replace(/\n/g, '').trim();
  };

  var build_s3_param = function(json){
    var body = JSON.stringify(json);
    var params = {
      'Bucket': 'billboard-tv.tk',
      'Key': 'ranking.json',
      'ACL': 'public-read',
      'Body': body,
      ContentType: 'application/json',
    };
    return params;
  };

  var fetch_html = new Promise(function(resolve, reject){
    var cheerio_httpclient = require('cheerio-httpcli');
    cheerio_httpclient.fetch('http://www.billboard.com/charts/hot-100', function(error, $, res){
      if (error) { throw new Error(error); return; }
      resolve($);
    });
  });
  
  fetch_html.then(function($){
    return new Promise(function(resolve, reject){
      var date = $('.chart-data-header time').text();
      var json = {};
      json['date'] = date;
      var ranking_array = [];
      var ranking_dom = $('.chart-row');
      ranking_dom.each(function(index){
        var title  = splitter($(this).find('.chart-row__song').text());
        var artist = splitter($(this).find('.chart-row__link').text());
        var rank   = splitter($(this).find('.chart-row__current-week').text());
        // console.log('rank:' + rank);
        // console.log('title:' + title);
        // console.log('artist:' + artist);
        
        search_youtube_video_id(artist + ' ' + title, function(video_id){
          var record = {
            'rank': rank,
            'artist': artist,
            'title': title,
            'video_id': video_id
          };
          ranking_array.push(record);
          
          if (ranking_array.length === ranking_dom.length) {
            ranking_array.sort(function(a, b){
              if (Number(a['rank']) > Number(b['rank'])) return 1;
              else return -1;
            });
            json['ranking'] = ranking_array;
            resolve(json);
          }
        });
      });
    });
  })
  .then(function(json){
    s3_client.putObject(build_s3_param(json), function(error, data){
      if (error) { throw new Error(error); return; }
      cb(null, 'finish success!!');
    });
  })
  .catch(function(error) {
    // TODO: notify to slack
    console.error(error);
    cb(null, 'finish with error: ' + JSON.stringify(error));
  });
};
