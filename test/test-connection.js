var Client = require('../lib/connection');

var c = new Client();
c.on('ready', function() {
  c.list(function(err, list) {
    if (err) throw err;
    console.dir(list);
    //c.end();
  });

  c.on('error', function(err) {
    console.error('ERROR: ', err);
  });

  c.on('close', function(err) {
    console.error('CLOSE: ', err);
  });
});

c.connect({
    //host: 'ipv6.app',
    host: 'localhost',
    //user: 'icetee',
    //password: 'password',
    //forcePasv: true,
    debug: function(text) {
        console.log(text);
    }
});
