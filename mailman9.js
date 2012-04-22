var events = require('events');
var util = require('util');

function Mailman9 () {
  events.EventEmitter.call(this);
}

util.inherits(Mailman9, events.EventEmitter);

var mailman9 = module.exports = new Mailman9();

mailman9.on('data', function (data) {
  console.log(data);
});
