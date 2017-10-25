const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const Client = require('../lib/connection');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = {
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASS,
  remote: process.env.REMOTE,
  debug: (text) => {
    console.log(text);
  },
};

const client = new Client();
const emitter = new EventEmitter();
const watchPath = './__folder/';
const uploadList = [];

const ready = () => client.cwd('/keymaps/', () => emitter.emit('connected'));

client.on('error', (err) => {
  console.error('ERROR: ', err);
});

client.on('close', (err) => {
  console.error('CLOSE: ', err);
});

const connected = () => {
  const upload = (filename, key) => {
    client.put(watchPath + filename, filename, (err) => {
      if (err) throw err;

      console.log('Uploaded: ', filename);
      uploadList[key].splice(key, 1);

      client.list((errClient, list) => {
        if (errClient) throw errClient;
        console.log(list);
      });
    });
  };

  uploadList.forEach(upload);
  client.end();
};

fs.watch(watchPath, { encoding: 'utf8' }, (eventType, filename) => {
  if (eventType === 'change') {
    uploadList.push(filename);
    emitter.emit('upload');
  }
});

client.on('ready', ready);
emitter.on('upload', () => client.connect(config));
emitter.on('connected', connected);
