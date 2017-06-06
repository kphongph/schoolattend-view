var through2 = require('through2');
var sublevel = require('level-sublevel');
var levelup = require('levelup');
var bytewise = require('bytewise');
var request = require('request');
var config = require('./config');
var _ = require('lodash');

var viewdb = sublevel(levelup('./myView',{'valueEncoding':'json'}));

var studentdb = viewdb.sublevel('student');

module.exports.db = viewdb;

module.exports.createStreamHandlers = function(config) {
  return function() {
    var dump = function() {
      return through2.obj(function(chunk,enc,cb) {
        console.log(JSON.stringify(chunk,null,2));
      });
    };

    var getInfo = function() {
      return through2.obj(function(chunk,enc,cb) {
        var self = this;
        request.get({
          url:'https://maas.nuqlis.com:9000/api/dbs/morning/'+chunk.value.id,
          json:true,
          headers:{
            Authorization:'JWT '+config.token
          }
        },function(err,response,body) {
          if(body.hostid) {
            chunk['_info']=body;
            self.push(chunk);
          }
          cb();
        });
      });
    };

    var getStudentInfo = function() {
      return through2.obj(function(chunk,enc,cb) {
        var self = this;
        var key = bytewise.encode([chunk._info.year,
          chunk._info.semester,
          chunk._info.hostid,
          chunk._info.educationclassid,
          chunk._info.room],'hex');
        studentdb.get(key,function(err,doc) {
          if(err) {
            request.post({
              url:'https://maas.nuqlis.com:9000/api/query/obec_students/host_class_room',
              json:true,
              headers:{
                Authorization:'JWT '+config.token
              },
              body:{'match':[chunk._info.hostid,chunk._info.educationclassid,chunk._info.room],'limit':-1,'include_doc':true}
            },function(err,response,body) {
              var students = [];
              if(body.length!=0) {
                students = _.filter(body,function(item) {
                   return !(item.value.doc.year == chunk._info.year && 
                     item.value.doc.semester  == chunk._info.semester);
                });
                students = _.map(students,'value.doc.cid');
              } 
              studentdb.put(key,{'students':students},function() {
                chunk['_student']=students;
                self.push(chunk);
                cb();
              });
            });
          } else {
            chunk['_student']=doc.students;
            self.push(chunk);
            cb();
          }
        });
      });
    }
    
    var getHostInfo = function() {
      return through2.obj(function(chunk,enc,cb) {
        var self = this;
        if(chunk._info.hostid && chunk._student.length>0) {
          request.post({
            url:'https://maas.nuqlis.com:9000/api/query/school_db/hostid',
              headers:{
              Authorization:'JWT '+config.token
            },
            json:true,
            body:{'match':[chunk._info.hostid],'include_doc':true,'limit':1}
          },function(err,response,_host) {
            if(_host.length == 1) {
              chunk['_hostinfo']=_host[0].value.doc;
              self.push(chunk);
              cb();
            }
          });
        } else {
          cb();
        }
      });
    };

    var setDocument = function() {
      return through2.obj(function(chunk,enc,cb) {
        var self = this;
        var _by_room = bytewise.encode(['by_room',
          chunk._info.year,
          chunk._info.semester,
          chunk._info.hostid,
          chunk._info.educationclassid,
          chunk._info.room],'hex');
        viewdb.get(_by_room,function(err,doc) {
          if(err) {
            var value = {'recdates':[],'students':chunk._student};
            var tmp = {'date':chunk._info.recdate,'info':[]};
            if(chunk._student.indexOf(chunk.value.cid)!=-1) {
              tmp.info.push({'cid':chunk.value.cid,'desc':chunk.value.desc});
            }
            value.recdates.push(tmp);
            viewdb.put(_by_room,value,function() {
              self.push(chunk);
              cb();
            });
          } else {
            // update
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
            } else {
              if(!_sexists) {
                if(chunk._student.indexOf(chunk.value.cid)!=-1) {
                  recdates.info.push({'cid':chunk.value.cid,'desc':chunk.value.desc});
                }
              }
            }

            console.log(JSON.stringify(doc,null,2));
            viewdb.put(_by_room,doc,function() {
              self.push(chunk);
              cb();
            });
          }
        });
        
      });
    };
    return [dump];

    // return [getInfo,getStudentInfo,getHostInfo,setDocument];
  };
};
