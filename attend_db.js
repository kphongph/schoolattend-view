var multilevel = require('multilevel');
var net = require('net');
var request = require('request');
var level = require('level');
var sublevel = require('level-sublevel');
var through2 = require('through2');
var JSONStream = require('JSONStream');
var diff = require('changeset');
var logview = require('leveldb-logview');

var qinfo = require('./interfaces/qinfo');
var schoolDb = require('./interfaces/school_db');
var netdb = require('./interfaces/netdb');
var config = require('./config');

var db = sublevel(level('./dbs/morningdetail',{'valueEncoding':'json'}));


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
      console.log(JSON.stringify(chunk,null,2));
    });
  };
  return [getMorning,dump];
};

logview.config({
  'url':'https://maas.nuqlis.com:9000/api/log/morningdetail',
  'jwtToken':config.token,
  'mainDb':db,
  'dbPath':'./dbs/_morningdetail',
  'streamHandler': streamHandler,
});

module.exports.open = function() {
  logview.sync(function() {
    console.log('sync');
  });
  net.createServer(function(con) {
    con.pipe(multilevel.server(db)).pipe(con);
  }).listen(3000);
}
