var express = require('express');
var through2 = require('through2');
var logview = require('leveldb-logview');
var bodyParser = require('body-parser');
var bytewise = require('bytewise');
var JSONStream = require('JSONStream');
var multilevel = require('multilevel');
var net = require('net');

var app = express();

app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

var attendDb = multilevel.client();
var con = net.connect(3000);
con.pipe(attendDb.createRpcStream()).pipe(con); 

app.get('/by_room/:year/:semester/:host',function(req,res) {
  console.log(req.params);
  var start = ['by_room',Number(req.params.year),Number(req.params.semester),req.params.host];
  var end = start.slice();
  end.push(undefined);
  
  attendDb.createReadStream({
 //   start:bytewise.encode(start,'hex'),
 //   end:bytewise.encode(end,'hex')
  })
  .pipe(through2.obj(function(chunk,enc,cb) {
    chunk.key = bytewise.decode(new Buffer(chunk.key, 'hex'));
    cb(null,chunk);
  }))
  .pipe(JSONStream.stringify())
  .pipe(res);
});


app.listen(8088, function () {
})
