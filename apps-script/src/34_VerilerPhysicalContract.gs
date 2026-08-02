/*
 * Veriler physical-grid contract audit.
 *
 * Live workbook finding (2026-08-02):
 *   physical grid: 1458 rows x 1731 columns
 *   used contract: 557 rows x 468 columns (A:QZ)
 *
 * This module is read-only. It can produce a trim plan, but it never deletes
 * rows or columns. Any destructive maintenance must re-read the overflow
 * ranges and require an explicit confirmation token in a separate command.
 */
var VERILER_PHYSICAL_CONTRACT = (function () {
  'use strict';

  const VERSION = 'VERILER-PHYSICAL-1.0.0';
  const SHEET_NAME = 'Veriler';
  const CANONICAL_COLUMNS = 468;
  const CANONICAL_LAST_COLUMN = 'QZ';

  function finiteInt_(value, name) {
    const n = Number(value);
    if (!isFinite(n) || n < 0 || Math.floor(n) !== n) {
      throw new Error((name || 'değer') + ' negatif olmayan tam sayı olmalıdır.');
    }
    return n;
  }

  function columnToNumber(column) {
    const text = String(column || '').trim().toUpperCase();
    if (!/^[A-Z]+$/.test(text)) throw new Error('Geçersiz sütun harfi: ' + column);
    let total = 0;
    for (let i = 0; i < text.length; i++) total = total * 26 + text.charCodeAt(i) - 64;
    return total;
  }

  function numberToColumn(number) {
    let n = finiteInt_(number, 'Sütun numarası');
    if (n < 1) throw new Error('Sütun numarası en az 1 olmalıdır.');
    let out = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      out = String.fromCharCode(65 + rem) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out;
  }

  function cellHasContent_(cell) {
    if (cell == null) return false;
    if (typeof cell === 'object') {
      if (cell.formula != null && String(cell.formula) !== '') return true;
      if (cell.userEnteredValue != null) return true;
      if (cell.effectiveValue != null) return true;
      if (cell.formattedValue != null && String(cell.formattedValue).trim() !== '') return true;
      return false;
    }
    return String(cell).trim() !== '';
  }

  function matrixHasContent(matrix) {
    return (matrix || []).some(function (row) {
      return (row || []).some(cellHasContent_);
    });
  }

  function audit(input) {
    input = input || {};
    const physicalRows = finiteInt_(input.physicalRows, 'physicalRows');
    const physicalColumns = finiteInt_(input.physicalColumns, 'physicalColumns');
    const usedRows = finiteInt_(input.usedRows, 'usedRows');
    const usedColumns = finiteInt_(input.usedColumns, 'usedColumns');
    const expectedColumns = finiteInt_(
      input.expectedColumns == null ? CANONICAL_COLUMNS : input.expectedColumns,
      'expectedColumns'
    );

    const rightOverflowHasContent = input.rightOverflowHasContent === true;
    const bottomOverflowHasContent = input.bottomOverflowHasContent === true;
    const canonicalWidthMatches = usedColumns === expectedColumns;
    const usedInsidePhysical = usedRows <= physicalRows && usedColumns <= physicalColumns;
    const overflowBlank = !rightOverflowHasContent && !bottomOverflowHasContent;
    const safeToPlanTrim = canonicalWidthMatches && usedInsidePhysical && overflowBlank;

    return {
      version: VERSION,
      sheetName: SHEET_NAME,
      canonical: {
        expectedColumns: expectedColumns,
        expectedLastColumn: numberToColumn(expectedColumns),
        widthMatches: canonicalWidthMatches
      },
      physical: { rows: physicalRows, columns: physicalColumns },
      used: { rows: usedRows, columns: usedColumns },
      excess: {
        rows: Math.max(0, physicalRows - usedRows),
        columns: Math.max(0, physicalColumns - usedColumns)
      },
      overflow: {
        rightHasContent: rightOverflowHasContent,
        bottomHasContent: bottomOverflowHasContent,
        blank: overflowBlank
      },
      safeToPlanTrim: safeToPlanTrim,
      blockers: [
        canonicalWidthMatches ? null : 'CANONICAL_WIDTH_MISMATCH',
        usedInsidePhysical ? null : 'USED_RANGE_OUTSIDE_PHYSICAL_GRID',
        rightOverflowHasContent ? 'RIGHT_OVERFLOW_NOT_EMPTY' : null,
        bottomOverflowHasContent ? 'BOTTOM_OVERFLOW_NOT_EMPTY' : null
      ].filter(Boolean)
    };
  }

  function planTrim(input) {
    const report = audit(input);
    if (!report.safeToPlanTrim) {
      return { allowed: false, report: report, requests: [], confirmationToken: null };
    }

    const requests = [];
    if (report.excess.columns > 0) {
      requests.push({
        deleteDimension: {
          range: {
            sheetId: input.sheetId,
            dimension: 'COLUMNS',
            startIndex: report.used.columns,
            endIndex: report.physical.columns
          }
        }
      });
    }
    if (report.excess.rows > 0) {
      requests.push({
        deleteDimension: {
          range: {
            sheetId: input.sheetId,
            dimension: 'ROWS',
            startIndex: report.used.rows,
            endIndex: report.physical.rows
          }
        }
      });
    }

    return {
      allowed: true,
      report: report,
      requests: requests,
      confirmationToken: 'TRIM_VERILER_TO_' + report.used.rows + 'x' + report.used.columns,
      warning: 'Plan üretildi; otomatik uygulanmaz. Uygulama öncesi overflow aralıkları yeniden okunmalıdır.'
    };
  }

  return Object.freeze({
    version: VERSION,
    sheetName: SHEET_NAME,
    canonicalColumns: CANONICAL_COLUMNS,
    canonicalLastColumn: CANONICAL_LAST_COLUMN,
    columnToNumber: columnToNumber,
    numberToColumn: numberToColumn,
    matrixHasContent: matrixHasContent,
    audit: audit,
    planTrim: planTrim
  });
})();

function auditVerilerPhysicalContract_(input) {
  return VERILER_PHYSICAL_CONTRACT.audit(input || {});
}

function planVerilerGridTrim_(input) {
  return VERILER_PHYSICAL_CONTRACT.planTrim(input || {});
}
