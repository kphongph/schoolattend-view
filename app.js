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

var encode = function(key) {
  return Buffer.prototype.toString.call(bytewise.encode(key), 'hex');
};

var decode = function(key) {
  return bytewise.decode(new Buffer(key, 'hex'));
};
  
app.get('/by_room/:year/:semester/:host',function(req,res) {
  var db = multilevel.client();
  var con = net.connect(3000);
  con.pipe(db.createRpcStream()).pipe(con); 

  var start = ['by_room',
    Number(req.params.year),
    Number(req.params.semester),
    req.params.host];
  var end = start.slice();
  end.push(undefined);
  var result = {};
  db.createReadStream({
    start:encode(start),
    end:encode(end)
  })
  .pipe(through2.obj(function(chunk,enc,cb) {
    chunk.key = decode(chunk.key);
    var key = encode(chunk.key.slice(0,-1));
    if(!result[key]) {
      result[key]={'gt15p':0};
    }
    var total = chunk.value['recdate'].length;
    result[key]['total']=total;
    for(var _key in chunk.value) {
      if(_key != 'recdate') {
        if((chunk.value[_key].length/total) > 0.15) {
          result[key]['gt15p']++;
        }
      }
    }
    cb();
  }))
  .on('finish',function() {
    var content = [];
    for(var key in result) {
      var tmp = {};
      tmp['key'] = decode(key);
      tmp['value'] = result[key];
      content.push(tmp);
    }
    res.json(content);
  })
});


app.listen(8088, function () {
})
