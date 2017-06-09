var express = require('express');
var logview = require('leveldb-logview');
var bodyParser = require('body-parser');
var bytewise = require('bytewise');

var config = require('./config');
var stream = require('./stream');

var app = express();

app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

logview.config({
  url:'https://maas.nuqlis.com:9000/api/log/morningdetail',
  jwtToken:config.token,
  mainDb:stream.db,
  streamHandler:stream.createStreamHandlers(config)
});

app.use(logview.handle_match);

app.get('/by_room/:year/:semester/:host',function(req,res) {
  console.log('yo..yo');
  console.log(req.params);
  var start = ['by_room',Number(req.params.year),Number(req.params.semester),req.params.host];
  var end = start.slice();
  end.push(undefined);
  
  stream.db.createReadStream({
    start:bytewise.encode(start,'hex'),
    end:bytewise.encode(end,'hex')
  }).on('data',function(data) {
     console.log(data);
  });
  console.log('yo..yo1');
});

// app.use(logview.monitor);

// app.get('/view',logview.serve);
// app.post('/view',logview.serve);

app.listen(config.port, function () {
  console.log('Example app listening on port !',config.port)
})
