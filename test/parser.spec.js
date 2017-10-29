const { assert} = require('chai');

describe('#Parser', () => {
  const { parseListEntry } = require('../lib/parser');

  describe('#Directories', () => {
    it('Normal directory', () => {
      const source = 'drwxr-xr-x  10 root   root    4096 Dec 21  2012 usr';
      const expected = {
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
      };

      assert.deepEqual(parseListEntry(source), expected);
    });

    it('Normal directory #2', () => {
      const source = 'drwxrwxrwx   1 owner   group          0 Aug 31 2012 e-books';
      const expected = {
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
      };

      assert.deepEqual(parseListEntry(source), expected);
    });

    it('Directory with sticky bit and executable for others', () => {
      const source = 'drwxrwxrwt   7 root   root    4096 May 19 2012 tmp';
      const expected = {
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
      };

      assert.deepEqual(parseListEntry(source), expected);
    });

    it('Directory with sticky bit and not executable for others', () => {
      const source = 'drwxrwxrwT   7 root   root    4096 May 19 2012 tmp';
      const expected = {
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
      };

      assert.deepEqual(parseListEntry(source), expected);
    });

    it('Directory with sticky bit and not executable for others #2', () => {
      const source = 'drwxrwx--T   7 root   root    4096 May 19 2012 tmp';
      const expected = {
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
      };

      assert.deepEqual(parseListEntry(source), expected);
    });
  });

  describe('#Files', () => {
    it('Normal file', () => {
      const source = '-rw-rw-rw-   1 owner   group    7045120 Sep 02  2012 music.mp3';
      const expected = {
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
      };

      assert.deepEqual(parseListEntry(source), expected);
    });

    it('File with ACL set', () => {
      const source = '-rw-rw-rw-+   1 owner   group    7045120 Sep 02  2012 music.mp3';
      const expected = {
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
      };

      assert.deepEqual(parseListEntry(source), expected);
    });

    it('File without extension', () => {
      const source = '-rw-rw-rw-   1 owner   group    7045120 Sep 02  2012 extension';
      const expected = {
        type: '-',
        name: 'extension',
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
      };

      assert.deepEqual(parseListEntry(source), expected);
    });

    it('File with UTF-8', () => {
      const source = '-rw-rw-rw-   1 owner   group    7045120 Sep 02  2012 Árvíztűrőfúrógép.js';
      const expected = {
        type: '-',
        name: 'Árvíztűrőfúrógép.js',
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
      };

      assert.deepEqual(parseListEntry(source), expected);
    });

    it('File with Emoji name', () => {
      const source = '-rw-rw-rw-   1 owner   group    7045120 Sep 02  2012 😋';
      const expected = {
        type: '-',
        name: '😋',
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
      };

      assert.deepEqual(parseListEntry(source), expected);
    });

    it('File with backslah name', () => {
      const source = '-rw-rw-rw-   1 owner   group    7045120 Sep 02  2012 \alpha.js';
      const expected = {
        type: '-',
        name: '\alpha.js',
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
      };

      assert.deepEqual(parseListEntry(source), expected);
    });

    // it('File with backslah name - tab', () => {
    //   const source = '-rw-rw-rw-   1 owner   group    7045120 Sep 02  2012 \test.js';
    //   const expected = {
    //     type: '-',
    //     name: '\test.js',
    //     target: undefined,
    //     sticky: false,
    //     rights: {
    //       user: 'rw',
    //       group: 'rw',
    //       other: 'rw',
    //     },
    //     acl: false,
    //     owner: 'owner',
    //     group: 'group',
    //     size: 7045120,
    //     date: new Date('2012-09-02T00:00:00.000Z'),
    //   };
    // 
    //   assert.deepEqual(parseListEntry(source), expected);
    // });
  });

  describe('#No entries', () => {
    it('Ignored line', () => {
      const source = 'total 871';
      const expected = null;

      assert.deepEqual(parseListEntry(source), expected);
    });
  });
});
