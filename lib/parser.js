/* eslint prefer-destructuring: ["error", {VariableDeclarator: {object: true}}] */

const XRegExp = require('xregexp');
const WritableStream = require('stream').Writable;
const { EventEmitter } = require('events');
const { inherits, inspect } = require('util');
const {
  REX_LISTUNIX,
  REX_LISTMSDOS,
  RE_ENTRY_TOTAL,
  RE_RES_END,
  RE_EOL,
  RE_DASH,
  RE_SEP,
  RE_EQ,
  MONTHS,
} = require('./expressions');

class Parser extends EventEmitter {
  constructor(options) {
    super();
    if (!(this instanceof Parser)) return new Parser(options);

    WritableStream.call(this);

    this.buffer = '';
    this.debug = options.debug;
  }

  static parseFeat(text) {
    const lines = text.split(RE_EOL);
    lines.shift(); // initial response line
    lines.pop(); // final response line

    for (let i = 0, len = lines.length; i < len; ++i) {
      lines[i] = lines[i].trim();
    }

    return lines;
  }

  write(chunk, encoding, cb) {
    let m;
    let code;
    let reRmLeadCode;
    let rest = '';

    this.buffer += chunk.toString('binary');

    while (RE_RES_END.exec(this.buffer) !== null) {
      m = RE_RES_END.exec(this.buffer);
      // support multiple terminating responses in the buffer
      rest = this.buffer.substring(m.index + m[0].length);

      if (rest.length) {
        this.buffer = this.buffer.substring(0, m.index + m[0].length);
      }

      this.debug && this.debug(`[parser] < ${inspect(this.buffer)}`);

      // We have a terminating response line
      code = parseInt(m[1], 10);

      // RFC 959 does not require each line in a multi-line response to begin
      // with '<code>-', but many servers will do this.
      //
      // remove this leading '<code>-' (or '<code> ' from last line) from each
      // line in the response ...
      reRmLeadCode = '(^|\\r?\\n)';
      reRmLeadCode += m[1];
      reRmLeadCode += '(?: |\\-)';
      reRmLeadCode = new RegExp(reRmLeadCode, 'g');

      const text = this.buffer.replace(reRmLeadCode, '$1').trim();
      this.buffer = rest;

      this.debug && this.debug(`[parser] Response: code=${code}, buffer=${inspect(text)}`);
      this.emit('response', code, text);
    }

    if (typeof cb === 'function') {
      cb();
    }
  }

  static parseListEntry(line) {
    let ret = null;
    let info;
    let month;
    let day;
    let year;
    let hour;
    let mins;
    const retUnix = XRegExp.exec(line, REX_LISTUNIX);
    const retMsdos = XRegExp.exec(line, REX_LISTMSDOS);

    if (retUnix) {
      info = {
        type: retUnix.type,
        name: undefined,
        target: undefined,
        sticky: false,
        rights: {
          user: retUnix.permission.substr(0, 3).replace(RE_DASH, ''),
          group: retUnix.permission.substr(3, 3).replace(RE_DASH, ''),
          other: retUnix.permission.substr(6, 3).replace(RE_DASH, ''),
        },
        acl: (retUnix.acl === '+'),
        owner: retUnix.owner,
        group: retUnix.group,
        size: parseInt(retUnix.size, 10),
        date: undefined,
      };

      // Check for sticky bit
      const lastbit = info.rights.other.slice(-1);

      if (lastbit === 't') {
        info.rights.other = `${info.rights.other.slice(0, -1)}x`;
        info.sticky = true;
      } else if (lastbit === 'T') {
        info.rights.other = info.rights.other.slice(0, -1);
        info.sticky = true;
      }

      if (retUnix.month1 !== undefined) {
        month = parseInt(MONTHS[retUnix.month1.toLowerCase()], 10);
        day = parseInt(retUnix.date1, 10);
        year = (new Date()).getFullYear();
        hour = parseInt(retUnix.hour, 10);
        mins = parseInt(retUnix.minute, 10);

        if (month < 10) month = `0${month}`;
        if (day < 10) day = `0${day}`;
        if (hour < 10) hour = `0${hour}`;
        if (mins < 10) mins = `0${mins}`;

        info.date = new Date(`${year}-${month}-${day}T${hour}:${mins}`);

        // If the date is in the past but no more than 6 months old, year
        // isn't displayed and doesn't have to be the current year.
        //
        // If the date is in the future (less than an hour from now), year
        // isn't displayed and doesn't have to be the current year.
        // That second case is much more rare than the first and less annoying.
        // It's impossible to fix without knowing about the server's timezone,
        // so we just don't do anything about it.
        //
        // If we're here with a time that is more than 28 hours into the
        // future (1 hour + maximum timezone offset which is 27 hours),
        // there is a problem -- we should be in the second conditional block
        if (info.date.getTime() - Date.now() > 100800000) {
          info.date = new Date(`${year - 1}-${month}-${day}T${hour}:${mins}`);
        }

        // If we're here with a time that is more than 6 months old, there's
        // a problem as well.
        // Maybe local & remote servers aren't on the same timezone (with remote
        // ahead of local)
        // For instance, remote is in 2014 while local is still in 2013. In
        // this case, a date like 01/01/13 02:23 could be detected instead of
        // 01/01/14 02:23
        // Our trigger point will be 3600*24*31*6 (since we already use 31
        // as an upper bound, no need to add the 27 hours timezone offset)
        if (Date.now() - info.date.getTime() > 16070400000) {
          info.date = new Date(`${year - 1}-${month}-${day}T${hour}:${mins}`);
        }
      } else if (retUnix.month2 !== undefined) {
        month = parseInt(MONTHS[retUnix.month2.toLowerCase()], 10);
        day = parseInt(retUnix.date2, 10);
        year = parseInt(retUnix.year, 10);

        if (month < 10) month = `0${month}`;
        if (day < 10) day = `0${day}`;

        info.date = new Date(`${year}-${month}-${day}`);
      }

      if (retUnix.type === 'l') {
        const pos = retUnix.name.indexOf(' -> ');

        info.name = retUnix.name.substring(0, pos);
        info.target = retUnix.name.substring(pos + 4);
      } else {
        info.name = retUnix.name;
      }

      ret = info;
    } else if (retMsdos) {
      info = {
        name: retMsdos.name,
        type: (retMsdos.isdir ? 'd' : '-'),
        size: (retMsdos.isdir ? 0 : parseInt(retMsdos.size, 10)),
        date: undefined,
      };

      month = parseInt(retMsdos.month, 10);
      day = parseInt(retMsdos.date, 10);
      year = parseInt(retMsdos.year, 10);
      hour = parseInt(retMsdos.hour, 10);
      mins = parseInt(retMsdos.minute, 10);

      year += (year < 70) ? 2000 : 1900;

      if (retMsdos.ampm[0].toLowerCase() === 'p' && hour < 12) {
        hour += 12;
      } else if (retMsdos.ampm[0].toLowerCase() === 'a' && hour === 12) {
        hour = 0;
      }

      info.date = new Date(year, month - 1, day, hour, mins);

      ret = info;
    } else if (!RE_ENTRY_TOTAL.test(line)) {
      // could not parse, so at least give the end user a chance to
      // look at the raw listing themselves
      ret = line;
    }

    return ret;
  }

  static parseMlsdEntry(entry) {
    const kvs = entry.split(RE_SEP);

    const obj = { name: kvs.pop().substring(1) };
    kvs.forEach((kv) => {
      kv = kv.split(RE_EQ);
      obj[kv[0].toLowerCase()] = kv[1];
    });

    obj.size = parseInt(obj.size, 10);

    if (obj.modify) {
      const year = obj.modify.substr(0, 4);
      const month = obj.modify.substr(4, 2);
      const date = obj.modify.substr(6, 2);
      const hour = obj.modify.substr(8, 2);
      const minute = obj.modify.substr(10, 2);
      const second = obj.modify.substr(12, 2);

      obj.date = new Date(`${year}-${month}-${date}T${hour}:${minute}:${second}`);
    }

    return obj;
  }
}

inherits(Parser, WritableStream);

module.exports = Parser;
