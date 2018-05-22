const XRegExp = require('xregexp');

const REX_LISTUNIX = XRegExp(`
  ^(?<type>[\\-ld])
  (?<permission>([\\-r][\\-w][\\-xstT]){3})
  (?<acl>(\\+))?\\s+
  (?<inodes>\\d+)\\s+
  (?<owner>\\d+|\\w+\\s+\\w+|\\w+|\\S+)\\s+
  (?<group>\\d+|\\w+\\s+\\w+|\\w+|\\S+)\\s+
  (?<size>\\d+)\\s+
  (?<timestamp>((?<month1>\\w{3})\\s+
  (?<date1>\\d{1,2})\\s+
  (?<hour>\\d{1,2}):(?<minute>\\d{2}))|
  ((?<month2>\\w{3})\\s+
  (?<date2>\\d{1,2})\\s+
  (?<year>\\d{4})))\\s+
  (?<name>.+)$
`, 'x');

const REX_LISTMSDOS = XRegExp(`
  ^(?<month>\\d{2})(?:\\-|\\/)
  (?<date>\\d{2})(?:\\-|\\/)
  (?<year>\\d{2,4})\\s+
  (?<hour>\\d{2}):(?<minute>\\d{2})\\s{0,1}(?<ampm>[AaMmPp]{1,2})\\s+
  (?:(?<size>\\d+)|(?<isdir>\\<DIR\\>))\\s+
  (?<name>.+)$
`, 'x');

const REX_TIMEVAL = XRegExp(`
  ^(?<year>\\d{4})
  (?<month>\\d{2})
  (?<date>\\d{2})
  (?<hour>\\d{2})
  (?<minute>\\d{2})
  (?<second>\\d+)
  (?:.\\d+)?$
`, 'x');

const RE_PASV = /([\d]+),([\d]+),([\d]+),([\d]+),([-\d]+),([-\d]+)/;
const RE_EPSV = /([\d]+)/;
const RE_WD = /"(.+)"(?: |$)/;
const RE_SYST = /^([^ ]+)(?: |$)/;

const RE_ENTRY_TOTAL = /^total/;
const RE_RES_END = /(?:^|\r?\n)(\d{3}) [^\r\n]*\r?\n/;
const RE_EOL = /\r?\n/g;
const RE_DASH = /-/g;
const RE_SEP = /;/g;
const RE_EQ = /=/;

const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const RETVAL = {
  PRELIM: 1,
  OK: 2,
  WAITING: 3,
  ERR_TEMP: 4,
  ERR_PERM: 5,
};

const bytesNOOP = new Buffer('NOOP\r\n');

module.exports = {
  REX_LISTUNIX,
  REX_LISTMSDOS,
  REX_TIMEVAL,
  RE_PASV,
  RE_EPSV,
  RE_WD,
  RE_SYST,
  RE_ENTRY_TOTAL,
  RE_RES_END,
  RE_EOL,
  RE_DASH,
  RE_SEP,
  RE_EQ,
  MONTHS,
  RETVAL,
  bytesNOOP,
};
