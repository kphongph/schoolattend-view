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
var netdb = require('./interfaces/netdb');
var config = require('./config');

var db = sublevel(level('./dbs/morningdetail',{'valueEncoding':'json'}));

var streamHandler = function() {
  var first = function() {
    return through2.obj(function(chunk,enc,cb) {
      netdb.getByKey(
        'https://maas.nuqlis.com:9000/api/dbs/morning',
        chunk.value.id
      ).then(function(key) {
        console.log(key);
      }).catch(function(err) {
        console.log(err);
      });

        
      
      console.log(JSON.stringify(chunk,null,2));
    });
  };
  return [first];
};

logview.config({
  'url':'https://maas.nuqlis.com:9000/api/log/morningdetail',
  'jwtToken':config.token,
  'mainDb':db,
  'dbPath':'./dbs/_morningdetail',
  'streamHandler': streamHandler,
});

module.exports.open = function() {
  logview.sync();
  net.createServer(function(con) {
    con.pipe(multilevel.server(db)).pipe(con);
  }).listen(3000);
}
