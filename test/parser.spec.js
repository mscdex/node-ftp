const { assert} = require('chai');

describe('#Ftp Parser', () => {
  const { parseListEntry } = require('../lib/parser');
  const entires = require('./assets/entries');

  entires.forEach((entry) => {
    it(entry.what, () => {
      const result = parseListEntry(entry.source);

      assert.deepEqual(result, entry.expected);
    });
  });
});
