var request = require('request');
var config = require('../config');

var getByKey = function(url,key) {
  return new Promise(function(fulfill,reject) {
    request.get({
      url:url+'/'+key,
      json:true,
      headers:{
        Authorization:'JWT '+config.token
      }
    },function(err,response,body) {
      if(err) {
        reject(err); 
      } else {
        if(body.ok == false) { 
          reject('Document not found'); 
        } else {
          fulfill(body);
        }
      }
    });
  });
};

module.exports.getByKey = getByKey;
