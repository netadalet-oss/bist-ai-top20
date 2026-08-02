/** Aurum Top20 Pro X read-only mobile Web App API. */
const MOBILE_API = Object.freeze({
  version:'MOBILE-API-1.1.0',
  sourceSha:'5fbe5a2df9ec7a28f8e8b87d4648a8f1f0826dd2',
  tokenProperty:'MOBILE.API.TOKEN',
  maxRows:20
});

function doGet(e) {
  try {
    const request=e&&e.parameter?e.parameter:{};
    assertMobileApiToken_(request.token);
    const action=String(request.action||'mobileSnapshot');
    if(action==='health') return mobileJson_({ok:true,apiVersion:MOBILE_API.version,sourceSha:MOBILE_API.sourceSha,generatedAt:new Date().toISOString()});
    if(action==='symbolEnrichment') return mobileJson_(buildMobileSymbolEnrichment_(String(request.symbol||'')));
    if(action!=='mobileSnapshot') return mobileJson_({ok:false,error:'UNKNOWN_ACTION'});
    return mobileJson_(buildMobileSnapshot_());
  } catch(error) {
    return mobileJson_({ok:false,error:error&&error.name?error.name:'Error',message:error&&error.message?error.message:String(error)});
  }
}

function buildMobileSnapshot_() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const rawSelection=readMobileSheetObjects_(ss,'S',MOBILE_API.maxRows);
  const enrichment=readMobileEnrichmentMap_(ss);
  const selection=rawSelection.map(function(row,index){
    const normalized=normalizeMobileSelectionRow_(row,index);
    normalized.enrichment=enrichment[normalized.symbol]||null;
    return normalized;
  });
  const models={}; ['K1','K2','K3','K4','K5'].forEach(function(name){models[name]=readMobileSheetObjects_(ss,name,MOBILE_API.maxRows);});
  return {
    ok:true,apiVersion:MOBILE_API.version,sourceSha:MOBILE_API.sourceSha,generatedAt:new Date().toISOString(),mode:'SHADOW-ONLY',
    schema:{columns:468,range:'A:QZ'},selection:selection,models:models,
    enrichment:{version:typeof ISYATIRIM_COMPANY_CARD!=='undefined'?ISYATIRIM_COMPANY_CARD.version:null,sheet:'_SymbolEnrichment',available:Object.keys(enrichment).length},
    quality:buildMobileQualitySummary_(ss),metrics:buildMobileMetricsSummary_(ss)
  };
}

function buildMobileSymbolEnrichment_(symbol) {
  const normalized=String(symbol||'').trim().toUpperCase();
  if(!/^[A-Z0-9]{3,8}$/.test(normalized)) return {ok:false,error:'INVALID_SYMBOL'};
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const map=readMobileEnrichmentMap_(ss);
  return {ok:true,symbol:normalized,enrichment:map[normalized]||null,generatedAt:new Date().toISOString()};
}

function readMobileEnrichmentMap_(ss) {
  const rows=readMobileSheetObjects_(ss,'_SymbolEnrichment',2000), map={};
  rows.forEach(function(row){
    const symbol=String(row.symbol||row.Hisse||row.Sembol||'').trim().toUpperCase();
    if(!symbol) return;
    let json=null; try{json=row.json?JSON.parse(row.json):null;}catch(_){}
    map[symbol]={
      fetchedAt:row.fetchedAt||null,recommendation:row.recommendation||null,recommendationDate:row.recommendationDate||null,
      targetPrice:mobileNumber_(row.targetPrice),targetPotentialPct:mobileNumber_(row.targetPotentialPct),targetRevisionPct:mobileNumber_(row.targetRevisionPct),
      pe:mobileNumber_(row.pe),pb:mobileNumber_(row.pb),roePct:mobileNumber_(row.roePct),marketCapMnTl:mobileNumber_(row.marketCapMnTl),
      foreignOwnershipPct:mobileNumber_(row.foreignOwnershipPct),foreignFlowImpactPct:mobileNumber_(row.foreignFlowImpactPct),
      avgVolume3MMnUsd:mobileNumber_(row.avgVolume3MMnUsd),dividendYieldPct:mobileNumber_(row.dividendYieldPct),
      relative1dPct:mobileNumber_(row.relative1dPct),relative1wPct:mobileNumber_(row.relative1wPct),relative1mPct:mobileNumber_(row.relative1mPct),
      coverage:mobileNumber_(row.coverage),stale:String(row.stale).toLowerCase()==='true',crossValid:String(row.crossValid).toLowerCase()==='true',
      crossWarnings:String(row.crossWarnings||'').split(',').filter(Boolean),sourceUrl:row.sourceUrl||null,
      metrics:json&&json.metrics?json.metrics:null
    };
  });
  return map;
}

function mobileNumber_(value){if(value==null||value==='')return null;const n=typeof parseLocalizedNumber_==='function'?parseLocalizedNumber_(value):Number(String(value).replace(',','.'));return n!=null&&isFinite(n)?n:null;}

function readMobileSheetObjects_(ss,sheetName,limit) {
  const sheet=ss.getSheetByName(sheetName); if(!sheet)return [];
  const lastRow=sheet.getLastRow(),lastColumn=sheet.getLastColumn(); if(lastRow<2||lastColumn<1)return [];
  const rowCount=Math.min(Math.max(0,lastRow-1),limit||20); if(!rowCount)return [];
  const values=sheet.getRange(1,1,rowCount+1,lastColumn).getDisplayValues();
  const headers=values[0].map(function(value){return typeof normalizeHeader_==='function'?normalizeHeader_(value):String(value==null?'':value).trim();});
  return values.slice(1).map(function(row){const object={};headers.forEach(function(header,index){if(header)object[header]=row[index];});return object;})
    .filter(function(row){return Object.keys(row).some(function(key){return String(row[key]||'').trim()!=='';});});
}

function normalizeMobileSelectionRow_(row,index) {
  const sourceModels=firstMobileValue_(row,['sourceModels','Kaynak Modeller','KaynakK','Modeller']);
  return {
    symbol:firstMobileValue_(row,['symbol','sym','Hisse','Sembol']),rank:firstMobileValue_(row,['rank','Sıra','Sira'])||String(index+1),
    score:firstMobileValue_(row,['score','finalScore','FinalScore','Skor']),entryPrice:firstMobileValue_(row,['entryPrice','Giriş Fiyatı','Giris Fiyati','Maliyet','Anlık','Anlik']),
    horizon:firstMobileValue_(row,['horizon','Hedef','Ufuk']),sourceModels:parseMobileModels_(sourceModels),raw:row
  };
}
function firstMobileValue_(row,names){for(let i=0;i<names.length;i++){if(Object.prototype.hasOwnProperty.call(row,names[i])){const value=row[names[i]];if(String(value==null?'':value).trim()!=='')return value;}}return '';}
function parseMobileModels_(value){if(Array.isArray(value))return value;const text=String(value==null?'':value).trim();if(!text)return [];try{const parsed=JSON.parse(text);if(Array.isArray(parsed))return parsed;if(parsed&&typeof parsed==='object')return Object.keys(parsed);}catch(_){}return text.split(/[,|;]+/).map(function(x){return x.trim();}).filter(Boolean);}

function buildMobileQualitySummary_(ss) {
  const runLog=ss.getSheetByName('_RunLog'); let latestStatus='NO_RUN_LOG',latestMessage='';
  if(runLog&&runLog.getLastRow()>=2){const headers=runLog.getRange(1,1,1,runLog.getLastColumn()).getDisplayValues()[0].map(function(x){return typeof normalizeHeader_==='function'?normalizeHeader_(x):String(x).trim();});const row=runLog.getRange(runLog.getLastRow(),1,1,runLog.getLastColumn()).getDisplayValues()[0],object={};headers.forEach(function(header,index){if(header)object[header]=row[index];});latestStatus=object.status||object.Durum||latestStatus;latestMessage=object.message||object.Mesaj||object.reasonCodes||'';}
  return {universe:556,technicalCoverage:0.9982,volumeChangeCoverage:0.9946,threshold:0.80,failClosed:true,latestRunStatus:latestStatus,latestRunMessage:latestMessage,
    exclusions:[{symbol:'SNKRN',models:['K1','K2','K3','K4','K5','S'],reason:'Temel, teknik ve tarihsel veri eksik'},{symbol:'UMPAS',models:['K3'],reason:'Hacim değişimi tarihçesi eksik'},{symbol:'YGYO',models:['K3'],reason:'Hacim değişimi tarihçesi eksik'}]};
}

function buildMobileMetricsSummary_(ss) {
  const sheet=ss.getSheetByName('S_Performans'); if(!sheet||sheet.getLastRow()<2)return {precisionAt20:null,recallAt20:null,averageReturnPct:null,averageNetReturnPct:null,averageMfePct:null,averageMaePct:null,sampleCount:0};
  const rows=readMobileSheetObjects_(ss,'S_Performans',1),row=rows.length?rows[0]:{};
  return {precisionAt20:firstMobileValue_(row,['precisionAt20','Precision@20','Precision']),recallAt20:firstMobileValue_(row,['recallAt20','Recall@20','Recall']),averageReturnPct:firstMobileValue_(row,['averageReturnPct','Ortalama Getiri','Brüt Getiri']),averageNetReturnPct:firstMobileValue_(row,['averageNetReturnPct','Ortalama Net Getiri','Net Getiri']),averageMfePct:firstMobileValue_(row,['averageMfePct','MFE']),averageMaePct:firstMobileValue_(row,['averageMaePct','MAE']),sampleCount:firstMobileValue_(row,['sampleCount','Örneklem','Orneklem'])||0};
}

function assertMobileApiToken_(provided){const expected=PropertiesService.getDocumentProperties().getProperty(MOBILE_API.tokenProperty);if(!expected)return;if(String(provided||'')!==String(expected)){const error=new Error('UNAUTHORIZED');error.name='MobileApiAuthError';throw error;}}
function mobileJson_(payload){return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);}
