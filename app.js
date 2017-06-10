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

var encode = function(key) {
  return Buffer.prototype.toString.call(bytewise.encode(key), 'hex');
};

var decode = function(key) {
  return bytewise.decode(new Buffer(key, 'hex'));
};
  
app.get('/by_room/:year/:semester/:host',function(req,res) {
  var start = ['by_room',
    Number(req.params.year),
    Number(req.params.semester),
    req.params.host];
  var end = start.slice();
  end.push(undefined);
  attendDb.createReadStream({
    start:encode(start),
    end:encode(end)
  })
  .pipe(through2.obj(function(chunk,enc,cb) {
    chunk.key = decode(chunk.key);
    var val = {'gt15p':0};
    var total = chunk.value['recdate'].length;
    for(var key in chunk.value) {
      if(key != 'recdate') {
        if((chunk.value[key].length/total) > 0.15) {
          val['gt15p']++;
        }
      }
    }
    val['raw']=chunk.value;
    chunk.value = val;
    cb(null,chunk);
  }))
  .pipe(JSONStream.stringify())
  .pipe(res);
});


app.listen(8088, function () {
})
