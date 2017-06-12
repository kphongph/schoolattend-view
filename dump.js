var request = require('request');
var fs = require('fs');
var JSONStream = require('JSONStream');
var through2 = require('through2');
var config = require('./config');
var _ = require('lodash');
var csvWriter = require('csv-write-stream');

var baseUrl = 'https://maas.nuqlis.com:9000/api'

var count = 0;

request.get({
  url:baseUrl+'/dbs/obec_students?limit=-1',
  json:true,
  headers:{
    Authorization:'JWT '+config.token
  }
})
.pipe(JSONStream.parse('*'))
.pipe(through2.obj(function(chunk,enc,cb) {
  var value = _.pick(chunk.value,[
   "cid",
   "title",
   "name",
   "lastname",
   "class",
   "room",
   "prelation",
   "ptitle",
   "pname",
   "plastname",
   "peducation",
   "pcid",
   "pgr",
   "noparent",
   "WelfareId",
   "hostid",
   "year",
   "semester",
   "updatetime",
   "staffid",
   "platform"]);
  value['pname']=_.replace(value['pname'],/,|'|"/,'');
  value['plastname']=_.replace(value['plastname'],/,|'|"/,'');
  console.log(count++);
  cb(null,value);
}))
.pipe(csvWriter())
.pipe(fs.createWriteStream('out.csv'));

