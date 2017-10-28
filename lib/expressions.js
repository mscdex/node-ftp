const XRegExp = require('xregexp');

const REX_LISTUNIX = XRegExp('^(?<type>[\\-ld])(?<permission>([\\-r][\\-w][\\-xstT]){3})(?<acl>(\\+))?\\s+(?<inodes>\\d+)\\s+(?<owner>\\S+)\\s+(?<group>\\S+)\\s+(?<size>\\d+)\\s+(?<timestamp>((?<month1>\\w{3})\\s+(?<date1>\\d{1,2})\\s+(?<hour>\\d{1,2}):(?<minute>\\d{2}))|((?<month2>\\w{3})\\s+(?<date2>\\d{1,2})\\s+(?<year>\\d{4})))\\s+(?<name>.+)$');

const REX_LISTMSDOS = XRegExp('^(?<month>\\d{2})(?:\\-|\\/)(?<date>\\d{2})(?:\\-|\\/)(?<year>\\d{2,4})\\s+(?<hour>\\d{2}):(?<minute>\\d{2})\\s{0,1}(?<ampm>[AaMmPp]{1,2})\\s+(?:(?<size>\\d+)|(?<isdir>\\<DIR\\>))\\s+(?<name>.+)$');

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

module.exports = {
  REX_LISTUNIX,
  REX_LISTMSDOS,
  RE_ENTRY_TOTAL,
  RE_RES_END,
  RE_EOL,
  RE_DASH,
  RE_SEP,
  RE_EQ,
  MONTHS,
};
