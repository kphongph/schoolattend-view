var express = require('express');
var through2 = require('through2');
var logview = require('leveldb-logview');
var bodyParser = require('body-parser');
var bytewise = require('bytewise');
var JSONStream = require('JSONStream');
var multilevel = require('multilevel');

var net = require('net');

var app = express();

app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

var encode = function(key) {
  return Buffer.prototype.toString.call(bytewise.encode(key), 'hex');
};

var decode = function(key) {
  return bytewise.decode(new Buffer(key, 'hex'));
};
  
app.get('/absent/:year?/:semester?/:host?',function(req,res) {
  var db = multilevel.client();
  var con = net.connect(3000);
  con.pipe(db.createRpcStream()).pipe(con); 
  var start = ['by_room'];
  if(req.params.year) {
    start.push(Number(req.params.year));
    if(req.params.semester) {
      start.push(Number(req.params.semester));
      if(req.params.host) {
        start.push(req.params.host);
      }
    }
  }
  var end = start.slice();
  end.push(undefined);
  var result = {};
  db.createReadStream({
    start:encode(start),
    end:encode(end)
  })
  .on('close',function() {
    con.end();
  })
  .pipe(through2.obj(function(chunk,enc,cb) {
    chunk.key = decode(chunk.key);
    console.log(chunk.key.slice(1,-1));
    var key = encode(chunk.key.slice(1,-1));
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
  });
});


app.listen(8088, function () {
})
