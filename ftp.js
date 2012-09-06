var util = require('util'),
    net = require('net'),
    EventEmitter = require('events').EventEmitter,
    XRegExp = require('./xregexp');

var reXListUnix = XRegExp.cache('^(?<type>[\\-ld])(?<permission>([\\-r][\\-w][\\-xs]){3})\\s+(?<inodes>\\d+)\\s+(?<owner>\\w+)\\s+(?<group>\\w+)\\s+(?<size>\\d+)\\s+(?<timestamp>((?<month1>\\w{3})\\s+(?<date1>\\d{1,2})\\s+(?<hour>\\d{1,2}):(?<minute>\\d{2}))|((?<month2>\\w{3})\\s+(?<date2>\\d{1,2})\\s+(?<year>\\d{4})))\\s+(?<name>.+)$'),
    reXListMSDOS = XRegExp.cache('^(?<month>\\d{2})(?:\\-|\\/)(?<date>\\d{2})(?:\\-|\\/)(?<year>\\d{2,4})\\s+(?<hour>\\d{2}):(?<minute>\\d{2})\\s{0,1}(?<ampm>[AaMmPp]{1,2})\\s+(?:(?<size>\\d+)|(?<isdir>\\<DIR\\>))\\s+(?<name>.+)$'),
    reXTimeval = XRegExp.cache('^(?<year>\\d{4})(?<month>\\d{2})(?<date>\\d{2})(?<hour>\\d{2})(?<minute>\\d{2})(?<second>\\d+)$'),
    reKV = /(.+?)=(.+?);/;

var MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12
};

var FTP = module.exports = function(options) {
  this._socket = undefined;
  this._dataSock = undefined;
  this._state = undefined;
  this._pasvPort = undefined;
  this._pasvIP = undefined;
  this._feat = undefined;
  this._queue = [];
  this.debug = false;
  this.options = {
    host: 'localhost',
    port: 21,
    /*secure: false,*/
    connTimeout: 15000, // in ms
    debug: false
  };
  extend(true, this.options, options);
  if (typeof this.options.debug === 'function')
    this.debug = this.options.debug;
};
util.inherits(FTP, EventEmitter);

FTP.prototype.connect = function(port, host) {
  var self = this,
      socket = this._socket,
      curData = '';
  if (typeof port === 'string')
    this.options.host = port;
  else if (typeof port === 'number')
    this.options.port = port;
  if (host !== undefined)
    this.options.host = host;

  host = this.options.host;
  port = this.options.port;

  this._feat = {};

  if (socket)
    socket.end();
  if (this._dataSock)
    this._dataSock.end();

  var connTimeout = setTimeout(function() {
    self._socket.destroy();
    self._socket = undefined;
    self.emit('timeout');
  }, this.options.connTimeout);
  socket = this._socket = new net.Socket();
  socket.setEncoding('binary');
  socket.setTimeout(0);
  socket.on('connect', function() {
    clearTimeout(connTimeout);
    self.debug&&self.debug('Connected');
  });
  socket.on('end', function() {
    self.debug&&self.debug('Disconnected');
    if (self._dataSocket)
      self._dataSocket.end();
    self.emit('end');
  });
  socket.on('close', function(hasError) {
    clearTimeout(connTimeout);
    if (self._dataSocket)
      self._dataSocket.end();
    self.emit('close', hasError);
  });
  socket.on('error', function(err) {
    self.emit('error', err);
  });
  socket.on('data', function(data) {
    curData += data;
    if (/(?:\r\n|\n)$/.test(curData)) {
      var resps = parseResponses(curData.split(/\r\n|\n/)), processNext = false;
      if (resps.length === 0)
        return;
      curData = '';
      if (self.debug) {
        for (var i=0,len=resps.length; i<len; ++i) {
          self.debug('Response: code = ' + resps[i][0]
                     + (resps[i][1] ? '; text = ' + util.inspect(resps[i][1])
                                    : ''));
        }
      }

      for (var i=0,code,text,group,len=resps.length; i<len; ++i) {
        code = resps[i][0];
        text = resps[i][1];
        group = getGroup(code); // second digit

        if (!self._state) {
          if (code === 220) {
            self._state = 'connected';
            self.send('FEAT', function(e, text) {
              if (!e && /\r\n|\n/.test(text)) {
                var feats = text.split(/\r\n|\n/);
                feats.shift(); // "Features:"
                feats.pop(); // "End"
                for (var i=0,sp,len=feats.length; i<len; ++i) {
                  feats[i] = feats[i].trim();
                  if ((sp = feats[i].indexOf(' ')) > -1)
                    self._feat[feats[i].substring(0, sp).toUpperCase()] = feats[i].substring(sp+1);
                  else
                    self._feat[feats[i].toUpperCase()] = true;
                }
                self.debug&&self.debug('Features: ' + util.inspect(self._feat));
              }
              self.emit('connect');
            });
          } else
            self.emit('error', new Error('Did not receive service ready response'));
          return;
        }

        if (code >= 200 && !processNext)
          processNext = true;
        else if (code < 200)
          continue;

        if (group === 0) {
          // all in here are errors except 200
          if (code === 200)
            self._callCb();
          else
            self._callCb(makeError(code, text));
        } else if (group === 1) {
          // informational group
          if (code >= 211 && code <= 215)
            self._callCb(text);
          else
            self._callCb(makeError(code, text));
        } else if (group === 2) {
          // control/data connection-related
          if (code === 226) {
            // closing data connection, file action request successful
            self._callCb();
          } else if (code === 227) {
            // server entering passive mode
            var parsed = text.match(/([\d]+),([\d]+),([\d]+),([\d]+),([-\d]+),([-\d]+)/);
            if (!parsed)
              throw new Error('Could not parse passive mode response: ' + text);
            self._pasvIP = parsed[1] + '.' + parsed[2] + '.' + parsed[3] + '.'
                          + parsed[4];
            self._pasvPort = (parseInt(parsed[5]) * 256) + parseInt(parsed[6]);
            self._pasvConnect();
            return;
          } else
            self._callCb(makeError(code, text));
        } else if (group === 3) {
          // authentication-related
          if (code === 331 || code === 230)
            self._callCb((code === 331));
          else
            self._callCb(makeError(code, text));
        } else if (group === 5) { // group 4 is unused
          // server file system state
          if (code === 250 && self._queue[0][0] === 'MLST')
            self._callCb(text);
          else if (code === 250 || code === 350)
            self._callCb();
          else if (code === 257) {
            var path = text.match(/(?:^|\s)\"(.*)\"(?:$|\s)/);
            if (path)
              path = path[1].replace(/\"\"/g, '"');
            else
              path = text;
            self._callCb(path);
          } else
            self._callCb(makeError(code, text));
        }
      }
      if (processNext)
        self.send();
    }
  });
  socket.connect(port, host);
};

FTP.prototype.end = function() {
  if (this._socket)
    this._socket.end();
  if (this._dataSock)
    this._dataSock.end();

  this._socket = undefined;
  this._dataSock = undefined;
};

/* Standard features */

FTP.prototype.auth = function(user, password, callback) {
  if (this._state !== 'connected')
    return false;
  if (typeof user === 'function') {
    callback = user;
    user = 'anonymous';
    password = 'anonymous@';
  } else if (typeof password === 'function') {
    callback = password;
    password = 'anonymous@';
  }

  var cmds = [['USER', user], ['PASS', password]], cur = 0, self = this,
      cb = function(err, result) {
        if (err) {
          callback(err);
          return;
        }
        if (result === true) {
          if (!self.send(cmds[cur][0], cmds[cur][1], cb))
            return callback(new Error('Connection severed'));
          ++cur;
        } else if (result === false) {
          // logged in
          cur = 0;
          self._state = 'authorized';
          if (!self.send('TYPE', 'I', callback))
            return callback(new Error('Connection severed'));
        }
      };
  cb(undefined, true);
  return true;
};

FTP.prototype.pwd = function(cb) {
  if (this._state !== 'authorized')
    return false;
  return this.send('PWD', cb);
};

FTP.prototype.cwd = function(path, cb) {
  if (this._state !== 'authorized')
    return false;
  return this.send('CWD', path, cb);
};

FTP.prototype.cdup = function(cb) {
  if (this._state !== 'authorized')
    return false;
  return this.send('CDUP', cb);
};

FTP.prototype.get = function(path, cb) {
  if (this._state !== 'authorized')
    return false;

  var self = this;
  return this.send('PASV', function(e, stream) {
    if (e)
      return cb(e);

    stream._decoder = undefined;
    var r = self.send('RETR', path, function(e) {
              if (e)
                return stream.emit('error', e);
              stream.emit('success');
            });
    if (r)
      cb(undefined, stream);
    else
      cb(new Error('Connection severed'));
  });
};

FTP.prototype.put = function(instream, destpath, cb) {
  if (this._state !== 'authorized' || !instream.readable)
    return false;

  instream.pause();

  var self = this;
  return this.send('PASV', function(e, outstream) {
    if (e)
      return cb(e);

    outstream._decoder = undefined;
    var r = self.send('STOR', destpath, cb);
    if (r) {
      instream.pipe(outstream);
      instream.resume();
    } else
      cb(new Error('Connection severed'));
  });
};

FTP.prototype.append = function(instream, destpath, cb) {
  if (this._state !== 'authorized' || !instream.readable)
    return false;

  instream.pause();

  var self = this;
  return this.send('PASV', function(e, outstream) {
    if (e)
      return cb(e);

    var r = self.send('APPE', destpath, cb);
    if (r) {
      instream.resume();
      instream.pipe(outstream);
    }
    else
      cb(new Error('Connection severed'));
  });
};

FTP.prototype.mkdir = function(path, cb) {
  if (this._state !== 'authorized')
    return false;
  return this.send('MKD', path, cb);
};

FTP.prototype.rmdir = function(path, cb) {
  if (this._state !== 'authorized')
    return false;
  return this.send('RMD', path, cb);
};

FTP.prototype.delete = function(path, cb) {
  if (this._state !== 'authorized')
    return false;
  return this.send('DELE', path, cb);
};

FTP.prototype.rename = function(pathFrom, pathTo, cb) {
  if (this._state !== 'authorized')
    return false;

  var self = this;
  return this.send('RNFR', pathFrom, function(e) {
    if (e)
      return cb(e);

    if (!self.send('RNTO', pathTo, cb))
      cb(new Error('Connection severed'));
  });
};

FTP.prototype.system = function(cb) {
  if (this._state !== 'authorized')
    return false;
  return this.send('SYST', cb);
};

FTP.prototype.status = function(cb) {
  if (this._state !== 'authorized')
    return false;
  return this.send('STAT', cb);
};

FTP.prototype.list = function(path, streaming, cb) {
  if (this._state !== 'authorized')
    return false;

  if (typeof path === 'function') {
    cb = path;
    path = undefined;
    streaming = false;
  } else if (typeof path === 'boolean') {
    cb = streaming;
    streaming = path;
    path = undefined;
  }
  if (typeof streaming === 'function') {
    cb = streaming;
    streaming = false;
  }

  var self = this,
      emitter = new EventEmitter();
  this._pasvGetLines(emitter, 'LIST', function(e) {
    if (e)
      return cb(e);
    var cbTemp = function(e) {
          if (e)
            return emitter.emit('error', e);
          emitter.emit('success');
        }, r;
    if (path)
      r = self.send('LIST', path, cbTemp);
    else
      r = self.send('LIST', cbTemp);
    if (r) {
      if (!streaming) {
        var entries = [];
        emitter.on('entry', function(entry) {
          entries.push(entry);
        });
        emitter.on('raw', function(line) {
          entries.push(line);
        });
        emitter.on('success', function() {
          cb(undefined, entries);
        });
        emitter.on('error', function(err) {
          cb(err);
        });
      } else
        cb(undefined, emitter);
    } else
      cb(new Error('Connection severed'));
  });
};

/* Extended features */

FTP.prototype.size = function(path, cb) {
  if (this._state !== 'authorized' || !this._feat['SIZE'])
    return false;
  return this.send('SIZE', path, cb);
};

FTP.prototype.lastMod = function(path, cb) {
  if (this._state !== 'authorized' || !this._feat['MDTM'])
    return false;
  return this.send('MDTM', path, function(e, text) {
    if (e)
      return cb(e);
    var val = reXTimeval.exec(text),
        ret;
    if (!val)
      return cb(new Error('Invalid date/time format from server'));
    // seconds can be a float, we'll just truncate this because Date doesn't
    // support fractions of a second
    var secs = parseInt(val.second, 10);
    ret = new Date(val.year + '-' + val.month + '-' + val.date + 'T' + val.hour
                   + ':' + val.minute + ':' + secs);
    cb(undefined, ret);
  });
};

FTP.prototype.restart = function(offset, cb) {
  if (this._state !== 'authorized' || !this._feat['REST']
      || !(/STREAM/i.test(this._feat['REST'])))
    return false;
  return this.send('REST', offset, cb);
};

/* Internal helper methods */

FTP.prototype.send = function(cmd, params, cb) {
  if (!this._socket || !this._socket.writable)
    return false;

  if (cmd) {
    cmd = (''+cmd).toUpperCase();
    if (typeof params === 'function') {
      cb = params;
      params = undefined;
    }
    if (!params)
      this._queue.push([cmd, cb]);
    else
      this._queue.push([cmd, params, cb]);
  }
  if (this._queue.length) {
    var fullcmd = this._queue[0][0]
                  + (this._queue[0].length === 3 ? ' ' + this._queue[0][1] : '');
    this.debug&&this.debug('> ' + fullcmd);
    this._socket.write(fullcmd + '\r\n');
  }

  return true;
};

FTP.prototype._pasvGetLines = function(emitter, type, cb) {
  var self = this;
  return this.send('PASV', function(e, stream) {
    if (e)
      return cb(e);
    var curData = '', lines;
    stream.setEncoding('binary');
    stream.on('data', function(data) {
      curData += data;
      if (/\r\n|\n/.test(curData)) {
        if (curData[curData.length-1] === '\n') {
          lines = curData.split(/\r\n|\n/);
          curData = '';
        } else {
          var pos = curData.lastIndexOf('\r\n');
          if (pos === -1)
            pos = curData.lastIndexOf('\n');
          lines = curData.substring(0, pos).split(/\r\n|\n/);
          curData = curData.substring(pos+1);
        }
        processDirLines(lines, emitter, type, self.debug);
      }
    });
    stream.on('end', function() {
      emitter.emit('end');
    });
    stream.on('error', function(e) {
      emitter.emit('error', e);
    });
    cb();
  });
};

FTP.prototype._pasvConnect = function() {
  if (!this._pasvPort)
    return false;

  var self = this;

  this.debug&&this.debug('(PASV) About to attempt data connection to: '
                         + this._pasvIP + ':' + this._pasvPort);

    var s = this._dataSock = new net.Socket();
    s.on('connect', function() {
      clearTimeout(s._pasvTimeout);
      self.debug&&self.debug('(PASV) Data connection successful');
      self._callCb(s);
    });
    s.on('end', function() {
      self.debug&&self.debug('(PASV) Data connection closed');
    });
    s.on('close', function(had_err) {
      clearTimeout(self._pasvTimeout);
      self._pasvPort = self._pasvIP = undefined;
      self._dataSock = undefined;
    });
    s.on('error', function(err) {
      self.debug&&self.debug('(PASV) Error: ' + err);
      self._callCb(err);
    });
    s._pasvTimeout = setTimeout(function() {
      var r = self.send('ABOR', function(e) {
        s.destroy();
        if (e)
          return self._callCb(e);
        self._callCb(new Error('(PASV) Data connection timed out while connecting'));
      });
      if (!r)
        self._callCb(new Error('Connection severed'));
    }, this.options.connTimeout);

  s.connect(this._pasvPort, this._pasvIP);

  return true;
};

FTP.prototype._callCb = function(result) {
  if (!this._queue.length)
    return;

  var req = this._queue.shift(), cb = (req.length === 3 ? req[2] : req[1]);
  if (!cb)
    return;

  if (result instanceof Error)
    process.nextTick(function() { cb(result); });
  else if (typeof result !== 'undefined')
    process.nextTick(function() { cb(undefined, result); });
  else
    process.nextTick(cb);
};


/******************************************************************************/
/***************************** Utility functions ******************************/
/******************************************************************************/
function processDirLines(lines, emitter, type, debug) {
  for (var i=0,result,len=lines.length; i<len; ++i) {
    if (lines[i].length) {
      debug&&debug('(PASV) Got ' + type + ' line: ' + lines[i]);
      if (type === 'LIST')
        result = parseList(lines[i]);
      else if (type === 'MLSD')
        result = parseMList(lines[i], numFields);
      emitter.emit((typeof result === 'string' ? 'raw' : 'entry'), result);
    }
  }
}

function parseResponses(lines) {
  var resps = [],
      multiline = '';
  for (var i=0,match,len=lines.length; i<len; ++i) {
    if (match = lines[i].match(/^(\d{3})(?:$|(\s|\-)(.+))/)) {
      if (match[2] === '-') {
        if (match[3])
          multiline += match[3] + '\n';
        continue;
      } else
        match[3] = (match[3] ? multiline + match[3] : multiline);
      if (match[3].length)
        resps.push([parseInt(match[1]), match[3]]);
      else
        resps.push([parseInt(match[1])]);
      multiline = '';
    } else
      multiline += lines[i] + '\n';
  }
  return resps;
}

function parseMList(line) {
  var ret, result = line.trim().split(reKV);
  if (result && result.length > 0) {
    ret = {};
    if (result.length === 1)
      ret.name = result[0].trim();
    else {
      var i = 1;
      for (var k,v,len=result.length; i<len; i+=3) {
        k = result[i];
        v = result[i+1];
        ret[k] = v;
      }
      ret.name = result[result.length-1].trim();
    }
  } else
    ret = line;
  return ret;
}

function parseList(line) {
  var ret,
      info,
      thisYear = (new Date()).getFullYear(),
      month,
      day,
      year,
      hour,
      mins;

  if (ret = reXListUnix.exec(line)) {
    info = {
      type: ret.type,
      rights: {
        user: ret.permission.substring(0, 3).replace('-', ''),
        group: ret.permission.substring(3, 6).replace('-', ''),
        other: ret.permission.substring(6, 9).replace('-', '')
      },
      owner: ret.owner,
      group: ret.group,
      size: ret.size,
      date: undefined
    };
    if (ret.month1 !== undefined) {
      month = parseInt(MONTHS[ret.month1.toLowerCase()], 10);
      day = parseInt(ret.date1, 10);
      year = thisYear;
      hour = parseInt(ret.hour, 10);
      mins = parseInt(ret.minute, 10);
      if (month < 10)
        month = '0' + month;
      if (day < 10)
        day = '0' + day;
      if (hour < 10)
        hour = '0' + hour;
      if (mins < 10)
        mins = '0' + mins;
      info.date = new Date(year + '-' + month + '-' + day + 'T' + hour + ':' + mins);
    } else if (ret.month2 !== undefined) {
      month = parseInt(MONTHS[ret.month2.toLowerCase()], 10);
      day = parseInt(ret.date2, 10);
      year = parseInt(ret.year, 10);
      if (month < 10)
        month = '0' + month;
      if (day < 10)
        day = '0' + day;
      info.date = new Date(year + '-' + month + '-' + day);
    }
    if (ret.type === 'l') {
      var pos = ret.name.indexOf(' -> ');
      info.name = ret.name.substring(0, pos);
      info.target = ret.name.substring(pos+4);
    } else
      info.name = ret.name;
    ret = info;
  } else if (ret = reXListMSDOS.exec(line)) {
    info = {
      name: ret.name,
      type: (ret.isdir ? 'd' : '-'),
      size: (ret.isdir ? '0' : ret.size),
      date: undefined,
    };
    month = parseInt(ret.month, 10),
    day = parseInt(ret.date, 10),
    year = parseInt(ret.year, 10),
    hour = parseInt(ret.hour, 10),
    mins = parseInt(ret.minute, 10);

    if (ret.ampm[0].toLowerCase() === 'p' && hour < 12)
      hour += 12;
    else if (ret.ampm[0].toLowerCase() === 'a' && hour === 12)
      hour = 0;

    if (month < 10)
      month = '0' + month;
    if (day < 10)
      day = '0' + day;
    if (hour < 10)
      hour = '0' + hour;
    if (mins < 10)
      mins = '0' + mins;

    info.date = new Date(year + '-' + month + '-' + day + 'T' + hour + ':' + mins);
    ret = info;
  } else
    ret = line; // could not parse, so at least give the end user a chance to
                // look at the raw listing themselves

  return ret;
}

function makeError(code, text) {
  var err = new Error('Server Error: ' + code + (text ? ' ' + text : ''));
  err.code = code;
  err.text = text;
  return err;
}

function getGroup(code) {
  return parseInt(code / 10) % 10;
}

/**
 * Adopted from jquery's extend method. Under the terms of MIT License.
 *
 * http://code.jquery.com/jquery-1.4.2.js
 *
 * Modified by Brian White to use Array.isArray instead of the custom isArray method
 */
function extend() {
  // copy reference to target object
  var target = arguments[0] || {}, i = 1, length = arguments.length, deep = false, options, name, src, copy;
  // Handle a deep copy situation
  if (typeof target === "boolean") {
    deep = target;
    target = arguments[1] || {};
    // skip the boolean and the target
    i = 2;
  }
  // Handle case when target is a string or something (possible in deep copy)
  if (typeof target !== "object" && !typeof target === 'function')
    target = {};
  var isPlainObject = function(obj) {
    // Must be an Object.
    // Because of IE, we also have to check the presence of the constructor property.
    // Make sure that DOM nodes and window objects don't pass through, as well
    if (!obj || toString.call(obj) !== "[object Object]" || obj.nodeType || obj.setInterval)
      return false;
    var has_own_constructor = hasOwnProperty.call(obj, "constructor");
    var has_is_property_of_method = hasOwnProperty.call(obj.constructor.prototype, "isPrototypeOf");
    // Not own constructor property must be Object
    if (obj.constructor && !has_own_constructor && !has_is_property_of_method)
      return false;
    // Own properties are enumerated firstly, so to speed up,
    // if last one is own, then all properties are own.
    var last_key;
    for (key in obj)
      last_key = key;
    return typeof last_key === "undefined" || hasOwnProperty.call(obj, last_key);
  };
  for (; i < length; i++) {
    // Only deal with non-null/undefined values
    if ((options = arguments[i]) !== null) {
      // Extend the base object
      for (name in options) {
        src = target[name];
        copy = options[name];
        // Prevent never-ending loop
        if (target === copy)
            continue;
        // Recurse if we're merging object literal values or arrays
        if (deep && copy && (isPlainObject(copy) || Array.isArray(copy))) {
          var clone = src && (isPlainObject(src) || Array.isArray(src)) ? src : Array.isArray(copy) ? [] : {};
          // Never move original objects, clone them
          target[name] = extend(deep, clone, copy);
        // Don't bring in undefined values
        } else if (typeof copy !== "undefined")
          target[name] = copy;
      }
    }
  }
  // Return the modified object
  return target;
}
