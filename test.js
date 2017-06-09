var attendDb = require('./attend_db');
var multilevel = require('multilevel');
var net = require('net');

attendDb.open();

var db = multilevel.client();
var con = net.connect(3000);
con.pipe(db.createRpcStream()).pipe(con); 


db.createReadStream().on('data',function(data) {
  console.log(data);
});
