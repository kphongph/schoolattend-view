var multilevel = require('multilevel');
var net = require('net');

var db = multilevel.client();
var con = net.connect(3000);
con.pipe(db.createRpcStream()).pipe(con); 

db.createReadStream().on('data',function(data) {
  console.log(data);
}).on('end',function() {
  console.log('done');
}).on('close',function() {
  console.log('close');
  con.end();
});
