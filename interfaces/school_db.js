var request = require('request');
var config = require('../config');

var getInfo = function(id) {
  return new Promise(function(fulfill,reject) {
    request.post({
      url:'https://maas.nuqlis.com:9000/api/query/school_db/hostid',
      headers:{
        Authorization:'JWT '+config.token
      },
      json:true,
      body:{'match':[id],'include_doc':true,'limit':1}
    },function(err,response,_host) {
      if(err) {
        reject(err);
      } else {
        if(_host.length == 1) {
          fulfill({
            'key':_host[0].value.key,
            'value':_host[0].value.doc
          });
        } else {
          reject("no hostinfo");
        }
      }
    });
  });
};

module.exports.getInfo = getInfo;
