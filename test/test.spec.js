const { assert} = require('chai');

describe('#NodeFTP', () => {
  const { parseListEntry } = require('../lib/parser');
  const entires = require('./assets/entries');

  describe('#Parser', () => {
    it('should no exception while parsing', () => {
      entires.forEach((entry) => {
        const result = parseListEntry(entry.source);

        assert.deepEqual(result, entry.expected);
      });
    });
  });
});
