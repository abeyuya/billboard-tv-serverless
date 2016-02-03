/**
 * Lib
 */

module.exports.respond = function(event, cb) {

  var cheerio_httpclient = require('cheerio-httpcli');
  var AWS = require('aws-sdk');
  AWS.config.update({
    'accessKeyId': process.env.AWS_ACCESS_KEY_ID,
    'secretAccessKey': process.env.AWS_SECRET_ACCESS_KEY,
    'region': process.env.AWS_REGION
  });
  
  var Youtube = require('youtube-node');
  var youtube = new Youtube();
  youtube.setKey(process.env.YOUTUBE_API_KEY);
  youtube.addParam('order', 'relevance');
  youtube.addParam('type', 'video');
  
  var search_youtube = function(keyword, callback){
    youtube.search(keyword, 1, function(err, result) {
      if (err) { console.log(err); return; }
      if (result.items.length === 0) {
        console.log('keyword : ' + keyword);
        callback('');
        return;
      }
      var item = result["items"][0];
      var video_id = item["id"]["videoId"];
      // console.log("title : " + title);
      // console.log("video_id : " + id);
  
      callback(video_id);
    });
  };
  
  // タブと改行を取り除くだけ
  var splitter = function(string) {
    return string.replace(/\t/g , '').replace(/\n/g, '').trim();
  };

  var buildS3params = function(json){
    var body = JSON.stringify(json);
    var params = {
      'Bucket': 'billboard-tv.tk', /* required */
      'Key': 'ranking.json', /* required */
      'ACL': 'public-read',
      'Body': body,
      // CacheControl: 'STRING_VALUE',
      // ContentDisposition: 'STRING_VALUE',
      // ContentEncoding: 'STRING_VALUE',
      // ContentLanguage: 'STRING_VALUE',
      // ContentLength: 0,
      // ContentMD5: 'STRING_VALUE',
      ContentType: 'application/json',
      // Expires: new Date || 'Wed Dec 31 1969 16:00:00 GMT-0800 (PST)' || 123456789,
      // GrantFullControl: 'STRING_VALUE',
      // GrantRead: 'STRING_VALUE',
      // GrantReadACP: 'STRING_VALUE',
      // GrantWriteACP: 'STRING_VALUE',
      // Metadata: {
      //   someKey: 'STRING_VALUE',
      //   /* anotherKey: ... */
      // },
      // RequestPayer: 'requester',
      // SSECustomerAlgorithm: 'STRING_VALUE',
      // SSECustomerKey: new Buffer('...') || 'STRING_VALUE',
      // SSECustomerKeyMD5: 'STRING_VALUE',
      // SSEKMSKeyId: 'STRING_VALUE',
      // ServerSideEncryption: 'AES256 | aws:kms',
      // StorageClass: 'STANDARD | REDUCED_REDUNDANCY | STANDARD_IA',
      // WebsiteRedirectLocation: 'STRING_VALUE'
    };
    // console.log('params: ' + params);
    return params;
  };

  var promise = new Promise(function(resolve, reject){
    cheerio_httpclient.fetch('http://www.billboard.com/charts/hot-100', function(err, $, res){
      resolve($);
    });
  });
  
  promise
  .then(function($){
    return new Promise(function(resolve, reject){
      console.log('start parse dom');
      var date = $('.chart-data-header time').text();
      var json = {};
      json['date'] = date;
      var ranking_array = [];
      var ranking_dom = $('.chart-row');
      // console.log('ranking_dom: ' + ranking_dom);
      ranking_dom.each(function(index){
        // console.log($(this));
        var title  = splitter($(this).find('.chart-row__song').text());
        var artist = splitter($(this).find('.chart-row__link').text());
        var rank   = splitter($(this).find('.chart-row__current-week').text());
        // console.log('rank:' + rank);
        // console.log('title:' + title);
        // console.log('artist:' + artist);
        
        search_youtube(artist + ' ' + title, function(video_id){
          // console.log('youtube_id:' + JSON.stringify(video_id));
          var record = {
            'rank': rank,
            'artist': artist,
            'title': title,
            'video_id': video_id
          };
          // console.log(record);
          ranking_array.push(record);
          
          if(ranking_array.length === ranking_dom.length){
            ranking_array.sort(function(a, b){
              if (Number(a['rank']) > Number(b['rank'])) return 1;
              else return -1;
            });
            // console.log('index' + index);
            // console.log('ranking_array' + ranking_array.length);
            // console.log('ranking_dom' + ranking_dom.length);
            // console.log('ループが終わりました。');
            json['ranking'] = ranking_array;
            // console.log(json);
            resolve(json);
          }
        });
      });
      console.log('each after');
    });
  })
  .then(function(json){
    console.log('start uploadToS3');
    var params = buildS3params(json);
    var s3 = new AWS.S3();
    s3.putObject(params, function(err, data){
      console.log('after putObject');
      if (err){
        console.log(err, err.stack); // an error occurred
        cb(null, 'finish with error: ' + JSON.stringify(err));
      } else {
        console.log(data);           // successful response
        cb(null, 'finish success!!');
      }
    });
  })
  // .catch(function(error) {
  //   // 例外をハンドリング
  //   console.error(error);
  // });
};
