var Parser = require('../lib/parser'),
    parseListEntry = Parser.parseListEntry;

var path = require('path'),
    assert = require('assert'),
    inspect = require('util').inspect;

var group = path.basename(__filename, '.js') + '/';

[
  { source: 'drwxr-xr-x  10 root   root    4096 Dec 21  2012 usr',
    expected: {
      type: 'd',
      name: 'usr',
      target: undefined,
      sticky: false,
      rights: { user: 'rwx', group: 'rx', other: 'rx' },
      owner: 'root',
      group: 'root',
      size: 4096,
      date: new Date('2012-12-21T00:00')
    },
    what: 'Normal directory'
  },
  { source: 'drwxrwxrwt   7 root   root    4096 May 19 22:17 tmp',
    expected: {
      type: 'd',
      name: 'tmp',
      target: undefined,
      sticky: true,
      rights: { user: 'rwx', group: 'rwx', other: 'rwx' },
      owner: 'root',
      group: 'root',
      size: 4096,
      date: new Date('2012-05-19T00:00')
    },
    what: 'Directory with sticky bit and executable for others'
  },
  { source: 'drwxrwx--t   7 root   root    4096 May 19 2012 tmp',
    expected: {
      type: 'd',
      name: 'tmp',
      target: undefined,
      sticky: true,
      rights: { user: 'rwx', group: 'rwx', other: 'x' },
      owner: 'root',
      group: 'root',
      size: 4096,
      date: new Date('2012-05-19T00:00')
    },
    what: 'Directory with sticky bit and executable for others #2'
  },
  { source: 'drwxrwxrwT   7 root   root    4096 May 19 2012 tmp',
    expected: {
      type: 'd',
      name: 'tmp',
      target: undefined,
      sticky: true,
      rights: { user: 'rwx', group: 'rwx', other: 'rw' },
      owner: 'root',
      group: 'root',
      size: 4096,
      date: new Date('2012-05-19T00:00')
    },
    what: 'Directory with sticky bit and not executable for others'
  },
  { source: 'drwxrwx--T   7 root   root    4096 May 19 2012 tmp',
    expected: {
      type: 'd',
      name: 'tmp',
      target: undefined,
      sticky: true,
      rights: { user: 'rwx', group: 'rwx', other: '' },
      owner: 'root',
      group: 'root',
      size: 4096,
      date: new Date('2012-05-19T00:00')
    },
    what: 'Directory with sticky bit and not executable for others #2'
  },
].forEach(function(v) {
  var result = parseListEntry(v.source),
      msg = '[' + group + v.what + ']: parsed output mismatch.\n'
            + 'Saw: ' + inspect(result) + '\n'
            + 'Expected: ' + inspect(v.expected);
  assert.deepEqual(result, v.expected, msg);
});
