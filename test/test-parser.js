const path = require('path');
const assert = require('assert');
const { inspect } = require('util');
const { parseListEntry } = require('../lib/parser');

const group = `${path.basename(__filename, '.js')}/`;

[{
  source: 'drwxr-xr-x  10 root   root    4096 Dec 21  2012 usr',
  expected: {
    type: 'd',
    name: 'usr',
    target: undefined,
    sticky: false,
    rights: {
      user: 'rwx',
      group: 'rx',
      other: 'rx',
    },
    acl: false,
    owner: 'root',
    group: 'root',
    size: 4096,
    date: new Date('2012-12-21T00:00:00.000Z'),
  },
  what: 'Normal directory',
},
{
  source: 'drwxrwxrwx   1 owner   group          0 Aug 31 2012 e-books',
  expected: {
    type: 'd',
    name: 'e-books',
    target: undefined,
    sticky: false,
    rights: {
      user: 'rwx',
      group: 'rwx',
      other: 'rwx',
    },
    acl: false,
    owner: 'owner',
    group: 'group',
    size: 0,
    date: new Date('2012-08-31T00:00:00.000Z'),
  },
  what: 'Normal directory #2',
},
{
  source: '-rw-rw-rw-   1 owner   group    7045120 Sep 02  2012 music.mp3',
  expected: {
    type: '-',
    name: 'music.mp3',
    target: undefined,
    sticky: false,
    rights: {
      user: 'rw',
      group: 'rw',
      other: 'rw',
    },
    acl: false,
    owner: 'owner',
    group: 'group',
    size: 7045120,
    date: new Date('2012-09-02T00:00:00.000Z'),
  },
  what: 'Normal file',
},
{
  source: '-rw-rw-rw-+   1 owner   group    7045120 Sep 02  2012 music.mp3',
  expected: {
    type: '-',
    name: 'music.mp3',
    target: undefined,
    sticky: false,
    rights: {
      user: 'rw',
      group: 'rw',
      other: 'rw',
    },
    acl: true,
    owner: 'owner',
    group: 'group',
    size: 7045120,
    date: new Date('2012-09-02T00:00:00.000Z'),
  },
  what: 'File with ACL set',
},
{
  source: 'drwxrwxrwt   7 root   root    4096 May 19 2012 tmp',
  expected: {
    type: 'd',
    name: 'tmp',
    target: undefined,
    sticky: true,
    rights: {
      user: 'rwx',
      group: 'rwx',
      other: 'rwx',
    },
    acl: false,
    owner: 'root',
    group: 'root',
    size: 4096,
    date: new Date('2012-05-19T00:00:00.000Z'),
  },
  what: 'Directory with sticky bit and executable for others',
},
{
  source: 'drwxrwx--t   7 root   root    4096 May 19 2012 tmp',
  expected: {
    type: 'd',
    name: 'tmp',
    target: undefined,
    sticky: true,
    rights: {
      user: 'rwx',
      group: 'rwx',
      other: 'x',
    },
    acl: false,
    owner: 'root',
    group: 'root',
    size: 4096,
    date: new Date('2012-05-19T00:00:00.000Z'),
  },
  what: 'Directory with sticky bit and executable for others #2',
},
{
  source: 'drwxrwxrwT   7 root   root    4096 May 19 2012 tmp',
  expected: {
    type: 'd',
    name: 'tmp',
    target: undefined,
    sticky: true,
    rights: {
      user: 'rwx',
      group: 'rwx',
      other: 'rw',
    },
    acl: false,
    owner: 'root',
    group: 'root',
    size: 4096,
    date: new Date('2012-05-19T00:00:00.000Z'),
  },
  what: 'Directory with sticky bit and not executable for others',
},
{
  source: 'drwxrwx--T   7 root   root    4096 May 19 2012 tmp',
  expected: {
    type: 'd',
    name: 'tmp',
    target: undefined,
    sticky: true,
    rights: {
      user: 'rwx',
      group: 'rwx',
      other: '',
    },
    acl: false,
    owner: 'root',
    group: 'root',
    size: 4096,
    date: new Date('2012-05-19T00:00:00.000Z'),
  },
  what: 'Directory with sticky bit and not executable for others #2',
},
{
  source: 'total 871',
  expected: null,
  what: 'Ignored line',
},
].forEach((line) => {
  const result = parseListEntry(line.source);
  const msg = `[${group}${line.what}]: parsed output mismatch\nSaw: ${inspect(result)}\nExpected: ${inspect(line.expected)}`;

  assert.deepEqual(result, line.expected, msg);
});
