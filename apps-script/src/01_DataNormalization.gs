/**
 * Dış kaynak ve tablo değerlerinin tek biçimde okunması.
 * Türkçe/İngilizce sayı biçimleri, görünmez karakterler ve tarih ayrıştırması.
 */
function normalizeHeader_(value) {
  return String(value == null ? '' : value)
    .replace(/[\u2060\u200B\u200C\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\r\n]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSymbol_(value) {
  return String(value == null ? '' : value)
    .replace(/[\u2060\u200B\uFEFF]/g, '')
    .trim()
    .toUpperCase();
}

function parseNumber_(value) {
  if (value === '' || value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  let text = String(value)
    .replace(/\u00A0/g, ' ')
    .replace(/%/g, '')
    .replace(/\s+/g, '')
    .trim();

  if (!text) return null;

  const hasComma = text.includes(',');
  const hasDot = text.includes('.');

  if (hasComma && hasDot) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (hasComma) {
    text = text.replace(',', '.');
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/* Compatibility entry point used by integrity and legacy-reader contracts. */
function parseLocalizedNumber_(value) {
  return parseNumber_(value);
}

function parseEpochDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  const text = String(value == null ? '' : value).trim();
  if (!text) return null;

  if (/^\d{13}$/.test(text)) {
    const date = new Date(Number(text));
    return isNaN(date.getTime()) ? null : date;
  }

  const iso = new Date(text);
  if (!isNaN(iso.getTime())) return iso;

  const tr = /^(\d{2})[.\/-](\d{2})[.\/-](\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
  if (!tr) return null;

  const date = new Date(
    Number(tr[3]),
    Number(tr[2]) - 1,
    Number(tr[1]),
    Number(tr[4] || 0),
    Number(tr[5] || 0),
    Number(tr[6] || 0),
    0
  );
  return isNaN(date.getTime()) ? null : date;
}

function requireFiniteNumber_(value, fieldName) {
  const parsed = parseNumber_(value);
  if (parsed == null) {
    throw new Error('Geçersiz sayısal alan: ' + fieldName + ' = ' + value);
  }
  return parsed;
}
