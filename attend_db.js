var multilevel = require('multilevel');
var net = require('net');
var request = require('request');
var level = require('level');
var bytewise = require('bytewise');
var sublevel = require('level-sublevel');
var through2 = require('through2');
var JSONStream = require('JSONStream');
var diff = require('changeset');
var logview = require('leveldb-logview');
var _ = require('lodash');

var config = require('./config');

var db = sublevel(level('./dbs/morningdetail',{'valueEncoding':'json'}));

var setDocument = function(chunk) {
  return through2.obj(function(chunk,enc,cb) {
    if(!chunk._morning || !chunk._hostinfo) {
      cb(null,chunk);
      return;
    }
    var _by_room = bytewise.encode(['by_room',
      chunk._morning.year,
      chunk._morning.semester,
      chunk._morning.hostid,
      chunk._morning.educationclassid,
      chunk._morning.room],'hex');
    db.get(_by_room,function(err,_doc) {
      var doc = {}; 
      if(err) {
         doc = {'recdate':[]};
      } else {
         doc = _doc;
      }
      doc['recdate'] = _.union(doc['recdate'],[chunk._morning.recdate]);
      
      if(chunk._value) {
        if(chunk._student.indexOf(chunk._value.cid)!=-1) {
          if(doc[chunk._value.cid]) {
            doc[chunk._value.cid] = _.difference(doc[chunk._value.cid],
              [chunk._morning.recdate]);
          }
        }
      }

      if(chunk._student.indexOf(chunk.value.cid)!=-1) {
        if(!doc[chunk.value.cid]) {
          doc[chunk.value.cid] = [];
        }
        doc[chunk.value.cid] = _.union(doc[chunk.value.cid],
          [chunk._morning.recdate]);
      }
      
      db.put(_by_room,doc,function() {
        cb(null,chunk);
      });
    });
  });
}

var getQinfoStudentList = function(chunk) {
  return through2.obj(function(chunk,enc,cb) {
    if(!chunk._morning) {
      cb(null,chunk);
      return;
    }
    var _classStr = chunk._morning.educationclassid.split(' ');
    var _classInt = 0;
    var strId = null;
    if(_classStr[0] == 'ประถมศึกษาปีที่') _classInt=3;
    if(_classStr[0] == 'มัธยมศึกษาปีที่') _classInt=9;
    _classInt+=Number(_classStr[1]);
    if(_classInt > 0) {
      var _queryUrl = 'https://newtestnew.azurewebsites.net/ServiceControl'+
        '/GetEduService.svc/getFindChild?year='+
        chunk._morning.year+'&hostid='+
        chunk._morning.hostid+'&educlass='+
        _classInt+'&room='+
        chunk._morning.room+'&text=';
      console.log(_queryUrl);
      request.get({
        url:_queryUrl,
        json:true
      },function(err,response,body) {
        var jsonObj = JSON.parse(body);
        chunk['_student']= _.union(_.map(jsonObj.persondata,'cid'));
        cb(null,chunk);
      });
    } else {
      chunk['_student']= [];
      cb(null,chunk);
    }
  });
}

var getHostInfo = function(chunk) {
  return through2.obj(function(chunk,enc,cb) {
    if(!chunk._morning) {
      cb(null,chunk);
      return;
    }

    request.post({
      url:'https://maas.nuqlis.com:9000/api/query/school_db/hostid',
      headers:{
        Authorization:'JWT '+config.token
      },
      json:true,
      body:{'match':[chunk._morning.hostid],'include_doc':true,'limit':1}
    },function(err,response,_host) {
      if(err) { 
        cb(null,chunk);
      } else {
        if(_host.length == 1) {
          chunk['_hostinfo']=_host[0].value.doc;
          cb(null,chunk);
        } else {
          cb(null,chunk);
        } 
      } 
    }); 
  });
};


var getMorning = function() {
  return through2.obj(function(chunk,enc,cb) {
    request.get({
      url:'https://maas.nuqlis.com:9000/api/dbs/morning/'+chunk.value.id,
      json:true,
      headers:{
        Authorization:'JWT '+config.token
      }
    },function(err,response,body) {
      if(err) {
        cb(null,chunk);
      } else {
        if(body.ok == false) {
          cb(null,chunk);
        } else {
          if(body.educationclassid.length==0) {
            cb(null,chunk);
          } else {
            chunk['_morning']=body;
            cb(null,chunk);
          }
        }
      }
    });
  });
};


var streamHandler = function() {
  var dump = function() {
    return through2.obj(function(chunk,enc,cb) {
      cb(null,chunk);
    });
  };
  return [getMorning,getHostInfo,getQinfoStudentList,setDocument,dump];
};

logview.config({
  'url':'https://maas.nuqlis.com:9000/api/log/morningdetail',
  'jwtToken':config.token,
  'mainDb':db,
  'dbPath':'./dbs/_morningdetail',
  'streamHandler': streamHandler,
});

module.exports.sync = function() {
  logview.sync(function() {
    console.log('sync');
  });
};

net.createServer(function(con) {
  setInterval(function() {
    logview.sync(function() {
      console.log('sync');
    });
  },30000);
  con.pipe(multilevel.server(db)).pipe(con);
}).listen(3000);
