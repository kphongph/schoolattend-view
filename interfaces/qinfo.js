var request = require('request');

var listStudent = function(year,host,className,room) {
  return new Promise(function(fulfill,reject) {
    var _classStr = className.split(' ');
    var _classInt = 0;
    var strId = null;
    if(_classStr[0] == 'ประถมศึกษาปีที่') _classInt=3;
    if(_classStr[0] == 'มัธยมศึกษาปีที่') _classInt=9;
    _classInt+=Number(_classStr[1]);
    if(_classInt > 0) {
      var _queryUrl = 'https://newtestnew.azurewebsites.net/ServiceControl'+
        '/GetEduService.svc/getFindChild?year='+
        year+'&hostid='+
        host+'&educlass='+
        _classInt+'&room='+
        room+'&text=';
      request.get({
        url:_queryUrl,
        json:true
      },function(err,response,body) {
        var jsonObj = JSON.parse(body);
        fulfill(_.map(jsonObj.persondata,'cid'));
      });
    } else {
        fulfill([]);
    }
  });
}

module.exports.listStudent = listStudent;
