function runSPerformanceReportTests_() {
  const result = S_PERFORMANCE_REPORT.render({
    horizons: ['SAME_DAY_CLOSE', 'NEXT_TRADING_DAY_CLOSE']
  });
  if (!result || result.sheet !== 'S_Performans') throw new Error('Rapor sayfası oluşturulamadı.');
  if (result.summaryCount !== 2) throw new Error('Beklenen horizon özeti oluşmadı.');
  if (result.detailCount < 0) throw new Error('Geçersiz detay sayısı.');
  const sh = SpreadsheetApp.getActive().getSheetByName('S_Performans');
  if (!sh) throw new Error('S_Performans sayfası bulunamadı.');
  if (String(sh.getRange('A1').getValue()) !== 'S Performans Raporu') throw new Error('Rapor başlığı yanlış.');
  return result;
}
