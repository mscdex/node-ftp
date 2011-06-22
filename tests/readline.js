
var utils = require("util")
var events = require("events")
var FTP = require('../ftp');


_lineReader = FTP.prototype._lineReader

function StringStream() {
    events.EventEmitter.call(this);
}
StringStream.super_ = events.EventEmitter;
StringStream.prototype = Object.create(events.EventEmitter.prototype, {
    constructor: {
        value: StringStream,
        enumerable: false
    }
});

var stringStream = new StringStream();
//console.log(utils.inspect(stringStream));

var out = []
_lineReader(stringStream, function(str) {
//  console.log('-'+str+'-');
  out.push(str);
})

var ref = ['meno', 'abels', 'martina', 'doof']
var Tester = function() {
  var ok = true
  for(var i in ref) {
    if (out[i] != ref[i]) {
      console.log("FAILED:"+i+":"+out[i]+"=="+ref[i]);
      ok = false
    }
  }
  ok && console.log("OK")
//  console.log("+++++++++++++");
}

stringStream.emit('data', "meno\r\nabels\rmartina\ndoof");
stringStream.emit('end');
Tester();



out = []
var stringStream = new StringStream();

_lineReader(stringStream, function(str) {
  out.push(str);
})

stringStream.emit('data', "meno");
stringStream.emit('data', "\r");
stringStream.emit('data', "\n");
stringStream.emit('data', "abels");
stringStream.emit('data', "\r");
stringStream.emit('data', "martina");
stringStream.emit('data', "\n");
stringStream.emit('data', "doof");
stringStream.emit('end');

Tester();
