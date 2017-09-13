var Client = require('../lib/connection');

var c = new Client();
c.on('ready', function() {
  c.list(function(err, list) {
    if (err) throw err;
    console.dir(list);
    c.end();
  });
});

c.connect({
    host: 'ipv6.app',
    //host: '192.168.10.10',
    user: 'icetee',
    //forcePasv: true,
    password: 'password', // ;)
    debug: function(text) {
        console.log(text);
    }
});
