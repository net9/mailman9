#!/usr/bin/env node

var http = require('http');
var https = require('https');
var url = require('url');
var querystring = require('querystring');
var config = require('./config');
var mailman9 = require('./mailman9');

var interfaceUrl = url.parse(config.url);
if (!interfaceUrl.port) {
  if (interfaceUrl.protocol == 'http:') {
    interfaceUrl.port = 80;
  } else {
    interfaceUrl.port = 443;
  }
}
if (interfaceUrl.protocol == 'https:') {
  http = https;
}

var contents = querystring.stringify({
  interfaceSecret: config.interfaceSecret,
});

var options = {
  host: interfaceUrl.hostname,
  port: interfaceUrl.port,
  path: interfaceUrl.path,
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length' : contents.length
  }
};

var req = http.request(options, function (res) {
  var buffer = '';
  res.setEncoding('utf8');
  res.on('data', function (data) {
    buffer += data;
  });
  res.on('end', function () {
    var data = JSON.parse(buffer);
    mailman9.emit('data', data);
  });
});

req.write(contents);
req.end();
