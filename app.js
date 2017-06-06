var express = require('express');
var logview = require('leveldb-logview');
var bodyParser = require('body-parser');

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
app.use(logview.monitor);

app.get('/view',logview.serve);
app.post('/view',logview.serve);

app.listen(config.port, function () {
  console.log('Example app listening on port !',config.port)
})
