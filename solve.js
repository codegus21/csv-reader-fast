// csv-reader-fast v3 — same answers as csv-reader 1.0.0, faster.
// v2 changes: (1) no line slice for quoted records — the quote check is a
// plain indexOf('"', pos) against the line end; (2) readUnquoted/readQuoted
// write their result into shared variables instead of allocating a return
// object per field; (3) charCodeAt instead of string indexing in hot checks;
// (4) a quoted field's newlines are counted only when its closing quote is
// past the line end (otherwise the content cannot hold one).
// No dependencies, no state kept between calls.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input {text, header}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  let recordLine = 1;
  let recordRow = null;
  // Index of the '\n' ending the line `pos` is on (-1: none), kept current
  // so unquoted fields need no newline search of their own.
  let lineEnd = -1;
  // Shared result slots for the field readers (no per-field object).
  let fValue = '';
  let fEnded = 0;
  let fAdded = 0;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // An unquoted field from `start`, with `value` already in it.
  // Sets fValue/fEnded/fAdded; added counts the characters kept here.
  function readUnquoted(start, value) {
    const comma = text.indexOf(',', start);
    let end, ended;
    if (comma !== -1 && (lineEnd === -1 || comma < lineEnd)) {
      end = comma;
      ended = COMMA;
    } else if (lineEnd !== -1) {
      end = lineEnd;
      ended = LINE_BREAK;
    } else {
      end = n;
      ended = END;
    }
    let f = text.slice(start, end);
    const r = f.indexOf('\r');
    let added = 0;
    if (r === -1) {
      if (f.length) {
        value += f;
        added = f.length;
      }
    } else if (ended === LINE_BREAK && r === f.length - 1) {
      // The only CR is the CRLF's: drop it.
      f = f.slice(0, -1);
      if (f.length) {
        value += f;
        added = f.length;
      }
    } else {
      // Stray CRs inside: strip them, one error each (the trailing CRLF one excepted).
      const cleaned = f.replaceAll('\r', '');
      if (cleaned.length) {
        value += cleaned;
        added = cleaned.length;
      }
      let cnt = 0;
      let j = f.indexOf('\r');
      while (j !== -1) {
        cnt++;
        j = f.indexOf('\r', j + 1);
      }
      let stray = cnt;
      if (ended === LINE_BREAK && f.charCodeAt(f.length - 1) === 13) stray--;
      for (let k = 0; k < stray; k++) error('stray_cr');
    }
    if (ended === LINE_BREAK) {
      line++;
      pos = end + 1;
    } else {
      pos = end + (ended === COMMA ? 1 : 0);
    }
    fValue = value;
    fEnded = ended;
    fAdded = added;
  }

  // A quoted field whose opening quote is at pos. Sets fValue/fEnded/fAdded.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    // The closing quote: the first '"' not followed by '"'.
    let q = text.indexOf('"', pos + 1);
    let doubled = false;
    while (q !== -1 && text.charCodeAt(q + 1) === 34) {
      doubled = true;
      q = text.indexOf('"', q + 2);
    }
    if (q === -1) {
      // The quote never closes: it is a literal character, and the text after
      // it is read again as unquoted.
      pos = open + 1;
      line = openLine;
      error('unterminated_quote');
      readUnquoted(open + 1, '"');
      return;
    }
    const content = text.slice(pos + 1, q);
    let value;
    const cr = content.indexOf('\r');
    if (cr === -1) {
      // No CR in the content: doubled quotes un-double, newlines count lines.
      value = doubled ? content.replaceAll('""', '"') : content;
      // The content holds a newline only when the closing quote is past the
      // line end; otherwise skip the count entirely.
      if (lineEnd !== -1 && q > lineEnd) {
        let c = 0;
        let k = content.indexOf('\n');
        while (k !== -1) {
          c++;
          k = content.indexOf('\n', k + 1);
        }
        line += c;
      }
    } else {
      // CRs inside quotes: each CRLF / lone CR becomes one LF and one line.
      // Rare: build it by scanning the content once.
      const parts = [];
      let i = 0;
      let seg = 0;
      while (i < content.length) {
        const ch = content[i];
        if (ch === '"') {
          parts.push(content.slice(seg, i), '"');
          i += 2;
          seg = i;
        } else if (ch === '\r') {
          parts.push(content.slice(seg, i), '\n');
          line++;
          i += content[i + 1] === '\n' ? 2 : 1;
          seg = i;
        } else if (ch === '\n') {
          parts.push(content.slice(seg, i), '\n');
          line++;
          i++;
          seg = i;
        } else {
          i++;
        }
      }
      parts.push(content.slice(seg));
      value = parts.join('');
    }
    // The content may have spanned lines: the line end after the closing
    // quote is not the record's first line end any more.
    if (line !== openLine) lineEnd = text.indexOf('\n', q + 1);
    if (q + 1 >= n) {
      pos = n;
      fValue = value;
      fEnded = END;
      fAdded = 0;
      return;
    }
    const c = text.charCodeAt(q + 1);
    if (c === 44) {
      pos = q + 2;
      fValue = value;
      fEnded = COMMA;
      fAdded = 0;
      return;
    }
    if (c === 10) {
      line++;
      pos = q + 2;
      fValue = value;
      fEnded = LINE_BREAK;
      fAdded = 0;
      return;
    }
    if (c === 13 && text.charCodeAt(q + 2) === 10) {
      line++;
      pos = q + 3;
      fValue = value;
      fEnded = LINE_BREAK;
      fAdded = 0;
      return;
    }
    // What follows the closing quote is appended as it stands.
    readUnquoted(q + 1, value);
    if (fAdded > 0) error('quote_junk');
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos++;
        line++;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line++;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    // Fast path: a record whose line holds no quote is one line; split it at once.
    const nl = text.indexOf('\n', pos);
    lineEnd = nl;
    const q0 = text.indexOf('"', pos);
    let fields;
    if (q0 === -1 || (nl !== -1 && q0 > nl)) {
      const atEof = nl === -1;
      const lineEndAt = atEof ? n : nl;
      let lineStr = text.slice(pos, lineEndAt);
      const r = lineStr.indexOf('\r');
      if (r !== -1) {
        if (r === lineStr.length - 1 && !atEof) {
          // Only the CRLF's CR.
          lineStr = lineStr.slice(0, -1);
        } else {
          // Stray CRs: strip them, one error each (the trailing CRLF one excepted).
          const cleaned = lineStr.replaceAll('\r', '');
          let cnt = 0;
          let j = lineStr.indexOf('\r');
          while (j !== -1) {
            cnt++;
            j = lineStr.indexOf('\r', j + 1);
          }
          let stray = cnt;
          if (!atEof && lineStr.charCodeAt(lineStr.length - 1) === 13) stray--;
          for (let k = 0; k < stray; k++) error('stray_cr');
          lineStr = cleaned;
        }
      }
      fields = lineStr.split(',');
      pos = atEof ? n : nl + 1;
      line++;
      // A line that held only stray CRs is left with no characters: no record
      // (its stray_cr errors stay).
      if (fields.length === 1 && fields[0] === '') continue;
    } else {
      fields = [];
      let quoted;
      do {
        quoted = text.charCodeAt(pos) === 34;
        if (quoted) readQuoted();
        else readUnquoted(pos, '');
        fields.push(fValue);
      } while (fEnded === COMMA);
      if (fields.length === 1 && fields[0] === '' && !quoted) continue;
    }

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
