var through2 = require('through2');
var sublevel = require('level-sublevel');
var levelup = require('levelup');
var bytewise = require('bytewise');
var request = require('request');
var config = require('./config');
var _ = require('lodash');

var viewdb = sublevel(levelup('./myView',{'valueEncoding':'json'}));

var studentdb = viewdb.sublevel('student');

var baseUrl = 'https://maas.nuqlis.com:9000';

module.exports.db = viewdb;

var getQinfoStudentList = function(chunk,students) {
  return new Promise(function(fulfill,reject) {
    var _classStr = chunk._info.educationclassid.split(' ');
    var _classInt = 0;
    var strId = null;
    if(_classStr[0] == 'ประถมศึกษาปีที่') _classInt=3;
    if(_classStr[0] == 'มัธยมศึกษาปีที่') _classInt=9;
    _classInt+=Number(_classStr[1]);
    if(_classInt > 0) {
      var _queryUrl = 'https://newtestnew.azurewebsites.net/ServiceControl'+
        '/GetEduService.svc/getFindChild?year='+
        chunk._info.year+'&hostid='+
        chunk._info.hostid+'&educlass='+
        _classInt+'&room='+
        chunk._info.room+'&text=';
      console.log(_queryUrl);
      request.get({
        url:_queryUrl,
        json:true
      },function(err,response,body) {
        var jsonObj = JSON.parse(body);
        fulfill(_.union(students,_.map(jsonObj.persondata,'cid')));
      });
    } else {
        fulfill([]);
    }
  });
}

var getObecStudentList = function(chunk) {
  return new Promise(function(fulfill,reject) {
    request.post({
      url:baseUrl+'/api/query/obec_students/host_class_room',
      json:true,
      headers:{
        Authorization:'JWT '+config.token
      },
      body:{'match':[chunk._info.hostid,
        chunk._info.educationclassid,
        chunk._info.room],'limit':-1,'include_doc':true}
      },function(err,response,body) {
        var students = [];
        if(body.length!=0) {
          students = _.filter(body,function(item) {
            return !(item.value.doc.year == chunk._info.year && 
              item.value.doc.semester  == chunk._info.semester);
          });
          students = _.map(students,'value.doc.cid');
        } 
        console.log('obec_student',students.length);
        fulfill(chunk,students);
      });
    });
}

var getStudentInfo = function(chunk) {
  return new Promise(function(fulfill,reject) {
    var key = bytewise.encode([chunk._info.year,
       chunk._info.semester,
       chunk._info.hostid,
       chunk._info.educationclassid,
       chunk._info.room],'hex');
    studentdb.get(key,function(err,doc) {
      if(err) {
        getObecStudentList(chunk).then(getQinfoStudentList)
        .then(function(students) {
          console.log('students',students.length);
          studentdb.put(key,{'students':students},function() {
            chunk['_student']=students;
            fulfill(chunk);
          });
        },function() {
          console.log('eee');
        });
      } else {
        console.log('found student',doc.students.length);
        chunk['_student']=doc.students;
        fulfill(chunk);
      }
    });
  });  
};


var getHostInfo = function(chunk) {
  return new Promise(function(fulfill,reject) {
    request.post({
      url:baseUrl+'/api/query/school_db/hostid',
      headers:{
        Authorization:'JWT '+config.token
      },
      json:true,
      body:{'match':[chunk._info.hostid],'include_doc':true,'limit':1}
    },function(err,response,_host) {
      if(err) { 
        reject(err); 
      } else {
        if(_host.length == 1) {
          chunk['_hostinfo']=_host[0].value.doc;
          fulfill(chunk);
        } else {
          reject("no hostinfo"); 
        }
      }
    });
  });
};

var getMorningInfo = function(chunk) {
  return new Promise(function(fulfill,reject) {
    request.get({
      url:baseUrl+'/api/dbs/morning/'+chunk.value.id,
      json:true,
      headers:{
        Authorization:'JWT '+config.token
      }
    },function(err,response,body) {
      if(err) {
        reject(err); 
      } else {
        if(body.hostid) {
          chunk['_info'] = body;
          if(body.educationclassid.length == 0) {
            reject("no educationclassid"); 
          } else {
            fulfill(chunk);
          } 
        } else {
          reject("no morninginfo"); 
        }
      }
    });
  });
};

var setDocument = function(chunk) {
  return new Promise(function(fulfill,reject) {
    var _by_room = bytewise.encode(['by_room',
      chunk._info.year,
      chunk._info.semester,
      chunk._info.hostid,
      chunk._info.educationclassid,
      chunk._info.room],'hex');
    viewdb.get(_by_room,function(err,doc) {
      if(err) {
        var value = {'total':chunk._student.length};
        if(chunk._student.indexOf(chunk.value.cid)!=-1) {
           value[chunk.value.desc] = 1;
        }
        var doc = {};
        doc['date_'+chunk._info.recdate] = value;
        viewdb.put(_by_room,doc,function() {
          fulfill(chunk);
        });
      } else {
        // update
        fulfill(chunk);
        /*
        var recdates = null;
        var _sexists = false;
        for(var i=0;i<doc.recdates.length;i++) {
          if(doc.recdates[i].date == chunk._info.recdate) {
            recdates = doc.recdates[i];
            break;
          }
        }
        if(recdates != null) {
          for(var i=0;i<recdates.info.length;i++) {
            if(recdates.info[i].cid == chunk.value.cid) {
              recdates.info[i].desc = chunk.value.desc;
              _sexists = true;
              break;
            }
          }
        }

        if(recdates == null) {
          var tmp = {'date':chunk._info.recdate,'info':[]};
          if(chunk._student.indexOf(chunk.value.cid)!=-1) {
            tmp.info.push({'cid':chunk.value.cid,'desc':chunk.value.desc});
          }
          doc.recdates.push(tmp);
        };
        */
      }    
    });
  });
}

module.exports.createStreamHandlers = function(config) {
  return function() {
    var dump = function() {
      return through2.obj(function(chunk,enc,cb) {
        console.log(JSON.stringify(chunk,null,2));
      });
    };

    var getInfo = function() {
      return through2.obj(function(chunk,enc,cb) {
        console.log('getInfo',chunk._rev);
        var self = this;
        getMorningInfo(chunk)
        .then(getHostInfo)
        .then(getStudentInfo)
        .then(setDocument)
        .then(function(_chunk) {
          console.log('success');
          console.log(_chunk);
          cb(null,_chunk);
        })
        .catch(function(err) {
          console.log('error',err);
          cb(null,chunk);
        });
      });
    };

    return [getInfo];
  };
};
