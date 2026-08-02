function runSequentialProviderChainTests_() {
  const order = SEQUENTIAL_PROVIDER_CHAIN.order;
  assertSequentialProviderTest_(JSON.stringify(order) === JSON.stringify([
    'ISYATIRIM','ISYATIRIM_LIVE','YAHOO','YAHOO_QUOTE','BIGPARA','STOOQ'
  ]), 'Kaynak sırası değiştirilemez');

  const merged = SEQUENTIAL_PROVIDER_CHAIN.mergeBundles('TEST', [
    {
      provider:'STOOQ',
      bars:[{date:'2026-08-01',open:10,high:12,low:9,close:11,volume:1000}],
      fundamentals:{}, live:null, actions:[]
    },
    {
      provider:'YAHOO',
      bars:[{date:'2026-08-01',open:10.2,high:12.2,low:9.2,close:11.2,adjustedClose:11.1,volume:1200}],
      fundamentals:{marketCap:200}, live:{price:11.3,provider:'YAHOO'}, actions:[]
    },
    {
      provider:'ISYATIRIM',
      bars:[{date:'2026-08-01',high:12.5,low:9.5,close:11.5,volume:1500}],
      fundamentals:{marketCap:250}, live:null, actions:[]
    },
    {
      provider:'ISYATIRIM_LIVE',
      bars:[], fundamentals:{}, live:{price:11.8,provider:'ISYATIRIM_LIVE'}, actions:[]
    }
  ], []);

  assertSequentialProviderTest_(merged.ok === true, 'Birleşik sonuç geçerli olmalı');
  assertSequentialProviderTest_(merged.rows.length === 1, 'Tek gün oluşmalı');
  assertSequentialProviderTest_(merged.rows[0].HGDG_KAPANIS === 11.5, 'Kapanışta İş Yatırım önceliği korunmalı');
  assertSequentialProviderTest_(merged.rows[0].HGDG_ACILIS === 10.2, 'İş Yatırım açılış vermiyorsa Yahoo tamamlamalı');
  assertSequentialProviderTest_(merged.rows[0].HGDG_DUZELTILMIS_KAPANIS === 11.1, 'Düzeltilmiş kapanış Yahoo’dan tamamlanmalı');
  assertSequentialProviderTest_(merged.fundamentals.marketCap === 250, 'Temel veride yüksek öncelik korunmalı');
  assertSequentialProviderTest_(merged.live.price === 11.8, 'Canlı fiyat İş Yatırım Live’dan gelmeli');
  assertSequentialProviderTest_(merged.lineage.bars['2026-08-01'].close === 'ISYATIRIM', 'Alan kaynağı izlenmeli');
  assertSequentialProviderTest_(merged.lineage.bars['2026-08-01'].open === 'YAHOO', 'Tamamlanan alan kaynağı izlenmeli');

  const csv = SEQUENTIAL_PROVIDER_CHAIN.parseCsv('Date,Open,High,Low,Close,Volume\n2026-08-01,1,2,0.5,1.5,100');
  assertSequentialProviderTest_(csv.length === 1 && csv[0].Close === '1.5', 'Stooq CSV ayrıştırılmalı');

  Logger.log('SequentialProviderChainTest: PASS');
  return true;
}

function assertSequentialProviderTest_(condition, message) {
  if (!condition) throw new Error('SequentialProviderChainTest başarısız: ' + message);
}
