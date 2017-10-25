const assert = require('assert');

describe('#NodeFTP', () => {
  const { parseListEntry } = require('../lib/parser');
  const entires = require('./assets/entries');

  before(() => {

  });

  beforeEach(() => {

  });


  describe('#Parser', () => {
    it('should no exception while parsing', () => {
      entires.forEach((entry) => {
        const result = parseListEntry(entry.source);

        assert.deepEqual(result, entry.expected);
      });
    });
  });
});
