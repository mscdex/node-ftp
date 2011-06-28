var fs = require('fs');
var crypto = require('crypto');

var FTPClient = require('../ftp'), util = require('util'), conn;
function formatDate(d) {
  return (d.year < 10 ? '0' : '') + d.year + '-' + (d.month < 10 ? '0' : '')
         + d.month + '-' + (d.date < 10 ? '0' : '') + d.date;
}

localName = "doof"
remoteName = "/images/ams/doof"
try {
  config = JSON.parse(fs.readFileSync("config")); 
} catch (e) {
  console.log("DEFAULT-CONFIG"+e)
  config = {
              hostName: "127.0.0.1",
              user: "anonymous",
              password: 'anonymous@'
           }
}
console.log("CONFIG"+util.inspect(config));

getSha1Stream = function(stream, cb) {
  var shasum = crypto.createHash('sha1');
  stream.on('data', function(d) {
    shasum.update(d);
  });

  stream.on('end', function() {
    sha1 = shasum.digest('hex');
    //console.log("IN:"+sha1);
    cb(sha1);
  });
}

getSha1 = function(fname, cb) {
 getSha1Stream(fs.ReadStream(fname), cb);
}

list = function(conn, size, cb) {
  conn.list(remoteName, function(e, iter) {
    if (e) {
      console.log("list:ERROR:"+e);
      return;
    }
    cb(iter);
    var begin = false;
    iter.on('entry', function(entry) {
      if (!begin) {
        begin = true;
        //console.log('<start of directory list>');
      }
      if (entry.type === 'l')
        entry.type = 'LINK';
      else if (entry.type === '-')
        entry.type = 'FILE';
      else if (entry.type === 'd')
        entry.type = 'DIR.';
      if (entry.type == 'FILE' && entry.size != size) {
        console.log("FAILED:entry.size:"+size+"<>"+entry.size);
      }
      //console.log(' ' + entry.type + ' ' + entry.size + ' '
      //              + formatDate(entry.date) + ' ' + entry.name);
    });
    iter.on('raw', function(s) {
      console.log('<raw entry>: ' + s);
    });
    iter.on('end', function() {
      //console.log('<end of directory list>');
    });
    iter.on('error', function(e) {
      console.log('ERROR during list(): ' + util.inspect(e));
      conn.end();
    });
  })
}

test = function(conn, size, cb) {
  conn.delete(remoteName, function() {
    console.log("DONE-DELETE");     
    getSha1(localName, function(sha1) {
      conn.putStream(remoteName, function(error, wStream) {
        if (error) {
          console.log("putStream:ERROR:"+error);
          return;
        }
        if (!error && !wStream) {
          console.log("putStream:DONE");
          return;
        }
        var rStream = fs.ReadStream(localName);
        rStream.pipe(wStream);
        wStream.on('success', function() {
          console.log("putStream:SUCCESS"); 
          list(conn, size, function(iter) {
            iter.on('success', function() {
              conn.get(remoteName, function(e, s) {
                getSha1Stream(s, function(sum) {
                  if (sha1 != sum) {
                    console.log("ERROR:SHA1:"+sum+"<>"+sha1);
                  } else {
                    console.log("GET:FINE");
                  }
                })
                s.on('success', function() {
                  cb()
                })
              })
            })
          })
        })
      })
    })
  })
}

conn = new FTPClient({ host: config.hostName });
conn.on('connect', function() {
  conn.auth(config.user, config.password, function(e) {
    if (e)
      throw e;

    var count = 10;
    var size = 500;
    var upload = function() {
      console.log("RUNNING:"+count);
      size = size * 2
      random = fs.ReadStream("/dev/urandom");
      doof = fs.WriteStream(localName);
      var written = 0;
      random.on("data", function(data) {
        if (written < size) { 
          if (data.length <= (size-written)) {
            doof.write(data);
            written += data.length;
          } else {
            doof.write(data.slice(0, size-written));
            written += size - written;
          }
        } else {
          random.destroy();
          doof.end();
          test(conn, size, function() {
            if (!--count) { conn.end() }
            else { upload() }
          })
        }
      })
    }
    upload();
  })
});
conn.connect();

