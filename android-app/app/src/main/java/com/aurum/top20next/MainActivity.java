package com.aurum.top20next;

import android.app.Activity;
import android.os.Bundle;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.widget.*;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.*;

public final class MainActivity extends Activity {
  private static final int NAVY=Color.rgb(2,8,20), CARD=Color.rgb(8,25,48), GOLD=Color.rgb(212,175,55), TEXT=Color.rgb(239,244,252), MUTED=Color.rgb(157,174,196), RED=Color.rgb(240,96,96), GREEN=Color.rgb(89,204,144);
  private static final String SHA="5fbe5a2df9ec7a28f8e8b87d4648a8f1f0826dd2";
  private static final String ENDPOINT="endpoint", TOKEN="token", CACHE="cache", CACHE_TS="cacheTs";
  private final ExecutorService pool=Executors.newSingleThreadExecutor();
  private LinearLayout content;
  private TextView title,status;
  private SharedPreferences prefs;
  private JSONObject data;
  private String current="Genel";

  @Override public void onCreate(Bundle b){super.onCreate(b);prefs=getSharedPreferences("aurum",MODE_PRIVATE);loadCache();build();showOverview();String e=prefs.getString(ENDPOINT,"");if(e.startsWith("https://"))refresh(e,false);}
  private int dp(int v){return Math.round(v*getResources().getDisplayMetrics().density);}
  private TextView tv(String s,int sp,int color){TextView v=new TextView(this);v.setText(s);v.setTextSize(sp);v.setTextColor(color);v.setPadding(0,dp(4),0,dp(4));return v;}
  private TextView heading(String s){TextView v=tv(s,18,TEXT);v.setTypeface(Typeface.DEFAULT_BOLD);return v;}
  private Button goldButton(String s){Button b=new Button(this);b.setText(s);b.setAllCaps(false);b.setTextColor(NAVY);b.setBackgroundColor(GOLD);return b;}

  private void build(){
    LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(NAVY);
    LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);top.setPadding(dp(16),dp(14),dp(16),dp(10));
    ImageView logo=new ImageView(this);logo.setImageResource(R.drawable.ic_launcher);top.addView(logo,new LinearLayout.LayoutParams(dp(48),dp(48)));
    LinearLayout names=new LinearLayout(this);names.setOrientation(LinearLayout.VERTICAL);names.setPadding(dp(12),0,0,0);TextView brand=heading("AURUM TOP20 PRO X");brand.setTextColor(GOLD);names.addView(brand);title=tv("Genel Bakış",25,TEXT);title.setTypeface(Typeface.DEFAULT_BOLD);names.addView(title);top.addView(names,new LinearLayout.LayoutParams(0,-2,1));
    status=tv(data==null?"VERİ YOK":"ÖNBELLEK",12,data==null?GOLD:MUTED);status.setTypeface(Typeface.DEFAULT_BOLD);top.addView(status);root.addView(top);
    ScrollView scroll=new ScrollView(this);content=new LinearLayout(this);content.setOrientation(LinearLayout.VERTICAL);content.setPadding(dp(14),dp(4),dp(14),dp(90));scroll.addView(content);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
    LinearLayout nav=new LinearLayout(this);nav.setPadding(dp(4),dp(8),dp(4),dp(10));for(String n:new String[]{"Genel","S","K1–K5","Kalite","Başarı","Kaynak","Ayar"}){Button x=new Button(this);x.setText(n);x.setTextSize(10);x.setTextColor(TEXT);x.setBackgroundColor(CARD);x.setAllCaps(false);x.setOnClickListener(v->go(n));nav.addView(x,new LinearLayout.LayoutParams(0,dp(54),1));}root.addView(nav);setContentView(root);
  }

  private void go(String n){current=n;if(n.equals("Genel"))showOverview();else if(n.equals("S"))showSelection();else if(n.equals("K1–K5"))showModels();else if(n.equals("Kalite"))showQuality();else if(n.equals("Başarı"))showPerformance();else if(n.equals("Kaynak"))showSource();else showSettings();}
  private void redraw(){go(current);}
  private void page(String s){title.setText(s);content.removeAllViews();}
  private LinearLayout card(String h){LinearLayout c=new LinearLayout(this);c.setOrientation(LinearLayout.VERTICAL);c.setPadding(dp(16),dp(14),dp(16),dp(14));c.setBackgroundColor(CARD);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.setMargins(0,0,0,dp(12));c.setLayoutParams(p);c.addView(heading(h));content.addView(c);return c;}
  private void row(LinearLayout c,String a,String b){LinearLayout r=new LinearLayout(this);r.setPadding(0,dp(7),0,dp(7));TextView l=tv(a,14,MUTED),v=tv(b,14,TEXT);v.setGravity(Gravity.END);v.setTypeface(Typeface.DEFAULT_BOLD);r.addView(l,new LinearLayout.LayoutParams(0,-2,1));r.addView(v,new LinearLayout.LayoutParams(0,-2,1));c.addView(r);}
  private JSONObject obj(String k){return data==null?null:data.optJSONObject(k);}
  private JSONArray arr(String k){return data==null?null:data.optJSONArray(k);}
  private String val(Object x,String fallback){if(x==null||x==JSONObject.NULL)return fallback;String s=String.valueOf(x).trim();return s.isEmpty()||s.equals("null")?fallback:s;}
  private String nested(String path,String fallback){try{Object x=data;for(String k:path.split("\\."))x=((JSONObject)x).get(k);return val(x,fallback);}catch(Exception e){return fallback;}}
  private String pct(Object x){String s=val(x,"—");if(s.equals("—"))return s;try{double d=Double.parseDouble(s.replace(",","."));if(Math.abs(d)<=1)d*=100;return String.format(Locale.US,"%.2f%%",d);}catch(Exception e){return s.contains("%")?s:s+"%";}}
  private String first(JSONObject o,String... keys){for(String k:keys){if(o.has(k)&&o.opt(k)!=JSONObject.NULL&&!String.valueOf(o.opt(k)).trim().isEmpty())return String.valueOf(o.opt(k));}return "";}
  private String join(JSONArray a){if(a==null)return "—";StringBuilder b=new StringBuilder();for(int i=0;i<a.length();i++){if(i>0)b.append(", ");b.append(val(a.opt(i),""));}return b.length()==0?"—":b.toString();}

  private void showOverview(){page("Genel Bakış");LinearLayout c=card("Çalışma Durumu");row(c,"Yayın modu",nested("mode","SHADOW-ONLY"));String source=nested("sourceSha",SHA);row(c,"Kaynak SHA",source.substring(0,Math.min(12,source.length()))+"…");row(c,"Veri şeması",nested("schema.columns","468")+" sütun / "+nested("schema.range","A:QZ"));JSONArray s=arr("selection");row(c,"S adayı",s==null?"—":String.valueOf(s.length()));row(c,"Son sunucu zamanı",nested("generatedAt","—"));long ts=prefs.getLong(CACHE_TS,0);row(c,"Son cihaz senkronu",ts==0?"—":new SimpleDateFormat("dd.MM.yyyy HH:mm:ss",Locale.getDefault()).format(new Date(ts)));Button sync=goldButton("Şimdi Yenile");sync.setOnClickListener(v->{String e=prefs.getString(ENDPOINT,"");if(e.isEmpty())showSettings();else refresh(e,true);});c.addView(sync);JSONObject q=obj("quality");LinearLayout qc=card("Hızlı Kalite Özeti");row(qc,"Son çalışma",q==null?"—":q.optString("latestRunStatus","—"));row(qc,"Teknik kapsam",q==null?"%99,82":pct(q.opt("technicalCoverage")));row(qc,"Kalite kapısı",q!=null&&q.optBoolean("failClosed",true)?"FAIL-CLOSED":"UYARI");LinearLayout i=card("Güvenlik İlkeleri");i.addView(tv("• Tahmin sonrası veri özelliklerde kullanılamaz.\n• Snapshot ve giriş fiyatı değiştirilemez.\n• Eksik veri sıfır skor sayılmaz.\n• Tek-model K5 konsensüs değildir.\n• Kalite veya bütünlük hatasında üretim durur.",14,TEXT));}

  private void showSelection(){page("S Listesi");JSONArray a=arr("selection");if(a==null||a.length()==0){card("SAME_DAY / NEXT_DAY").addView(tv("Doğrulanmış snapshot yok. Ayarlar bölümünden Apps Script Web App endpoint'ini tanımlayın. Uygulama veri uydurmaz.",15,MUTED));return;}for(int i=0;i<a.length();i++){JSONObject o=a.optJSONObject(i);if(o==null)continue;String symbol=o.optString("symbol",o.optString("sym","?"));LinearLayout c=card(val(o.opt("rank"),String.valueOf(i+1))+" · "+symbol);row(c,"Skor",val(o.opt("score"),val(o.opt("finalScore"),"—")));row(c,"Giriş",val(o.opt("entryPrice"),"—"));row(c,"Hedef",val(o.opt("horizon"),"—"));row(c,"Modeller",join(o.optJSONArray("sourceModels")));}}

  private void showModels(){page("K1–K5 Modelleri");JSONObject models=obj("models");String[][] d={{"K1","Kısa vade momentum, hacim, volatilite ve Bollinger."},{"K2","EMA20/50/200, MACD, RSI ve Momentum10."},{"K3","Adaptif dipten toparlanma ve hacim teyidi."},{"K4","1/3/6 aylık liderlik ve pozitif-getiri risk oranı."},{"K5","En az iki model desteğine dayalı konsensüs."}};for(String[] x:d){JSONArray rows=models==null?null:models.optJSONArray(x[0]);LinearLayout c=card(x[0]+" · "+x[1]);c.addView(tv(rows==null||rows.length()==0?"VERİ YOK":"İLK "+Math.min(rows.length(),5)+" ADAY",12,rows==null||rows.length()==0?MUTED:GOLD));if(rows!=null)for(int i=0;i<Math.min(rows.length(),5);i++){JSONObject r=rows.optJSONObject(i);if(r!=null)row(c,(i+1)+" · "+val(first(r,"symbol","sym","Hisse","Sembol"),"?"),val(first(r,"score","Skor","FinalScore","Puan"),"—"));}}}

  private void showQuality(){page("Veri Kalitesi");JSONObject q=obj("quality");LinearLayout c=card("Canlı Doğrulama");row(c,"Evren",q==null?"556":val(q.opt("universe"),"556"));row(c,"Temel teknik kapsam",q==null?"%99,82":pct(q.opt("technicalCoverage")));row(c,"Hacim değişimi",q==null?"%99,46":pct(q.opt("volumeChangeCoverage")));row(c,"Kalite eşiği",q==null?"%80 · FAIL-CLOSED":pct(q.opt("threshold"))+" · "+(q.optBoolean("failClosed",true)?"FAIL-CLOSED":"UYARI"));row(c,"Son çalışma",q==null?"—":q.optString("latestRunStatus","—"));LinearLayout d=card("Zorunlu Dışlamalar");JSONArray ex=q==null?null:q.optJSONArray("exclusions");if(ex==null)d.addView(tv("SNKRN — Tüm modellerden dışlanır.\n\nUMPAS — K3 dışı.\n\nYGYO — K3 dışı.",14,TEXT));else for(int i=0;i<ex.length();i++){JSONObject x=ex.optJSONObject(i);if(x!=null)d.addView(tv("• "+x.optString("symbol","?")+" — "+x.optString("reason",""),14,TEXT));}}

  private void showPerformance(){page("Performans");JSONObject m=obj("metrics");LinearLayout c=card("Ölçüm Sonuçları");row(c,"Precision@20",m==null?"—":pct(m.opt("precisionAt20")));row(c,"Recall@20",m==null?"—":pct(m.opt("recallAt20")));row(c,"Ortalama brüt getiri",m==null?"—":pct(m.opt("averageReturnPct")));row(c,"Ortalama net getiri",m==null?"—":pct(m.opt("averageNetReturnPct")));row(c,"MFE",m==null?"—":pct(m.opt("averageMfePct")));row(c,"MAE",m==null?"—":pct(m.opt("averageMaePct")));row(c,"Örneklem",m==null?"0":val(m.opt("sampleCount"),"0"));card("Deney Durumu").addView(tv("Gerçek out-of-sample üstünlük yeterli snapshot ve outcome birikmeden ilan edilmez.",14,MUTED));}

  private void showSource(){page("Kaynak ve Sürüm");LinearLayout c=card("Kilitli Kaynak");row(c,"Repository","netadalet-oss/bist-ai-top20");row(c,"Arşiv dalı","archive/apps-script-foundation-2026-08-02");row(c,"Mobil API",nested("apiVersion","—"));c.addView(tv(nested("sourceSha",SHA),12,GOLD));card("Modüler Motor").addView(tv("00_Config.gs – 43_MobileApi.gs\n\nVeriler → kalite kapısı → K1–K4 → K5 → S → snapshot → outcome → performans → mobil API",14,TEXT));}

  private void showSettings(){page("Bağlantı Ayarları");LinearLayout c=card("Apps Script Web App");EditText endpoint=new EditText(this);endpoint.setText(prefs.getString(ENDPOINT,""));endpoint.setHint("https://script.google.com/macros/s/.../exec");endpoint.setTextColor(TEXT);endpoint.setHintTextColor(MUTED);c.addView(endpoint);EditText token=new EditText(this);token.setText(prefs.getString(TOKEN,""));token.setHint("Opsiyonel MOBILE.API.TOKEN");token.setTextColor(TEXT);token.setHintTextColor(MUTED);c.addView(token);Button save=goldButton("Kaydet ve Test Et");save.setOnClickListener(v->{String e=endpoint.getText().toString().trim(),t=token.getText().toString().trim();prefs.edit().putString(ENDPOINT,e).putString(TOKEN,t).apply();refresh(e,true);});c.addView(save);Button clear=new Button(this);clear.setText("Önbelleği Temizle");clear.setAllCaps(false);clear.setOnClickListener(v->{prefs.edit().remove(CACHE).remove(CACHE_TS).apply();data=null;status.setText("VERİ YOK");redraw();});c.addView(clear);c.addView(tv("Apps Script projesine 43_MobileApi.gs eklenip Web App olarak dağıtılmalıdır. Yalnız HTTPS kabul edilir.",13,MUTED));}

  private void loadCache(){try{String raw=prefs.getString(CACHE,"");if(!raw.isEmpty())data=new JSONObject(raw);}catch(Exception e){data=null;}}
  private void saveCache(JSONObject j){prefs.edit().putString(CACHE,j.toString()).putLong(CACHE_TS,System.currentTimeMillis()).apply();}
  private void refresh(String endpoint,boolean notify){if(endpoint==null||!endpoint.startsWith("https://")){toast("Geçerli HTTPS endpoint girin");return;}status.setText("BAĞLANIYOR");status.setTextColor(GOLD);pool.submit(()->{HttpURLConnection h=null;try{String token=prefs.getString(TOKEN,"");StringBuilder target=new StringBuilder(endpoint).append(endpoint.contains("?")?"&":"?").append("action=mobileSnapshot");if(!token.isEmpty())target.append("&token=").append(URLEncoder.encode(token,"UTF-8"));target.append("&_=").append(System.currentTimeMillis());h=(HttpURLConnection)new URL(target.toString()).openConnection();h.setConnectTimeout(15000);h.setReadTimeout(25000);h.setRequestProperty("Accept","application/json");h.setUseCaches(false);int code=h.getResponseCode();InputStream stream=code>=400?h.getErrorStream():h.getInputStream();if(stream==null)throw new IOException("Boş yanıt");StringBuilder body=new StringBuilder();try(BufferedReader r=new BufferedReader(new InputStreamReader(stream,StandardCharsets.UTF_8))){String line;while((line=r.readLine())!=null)body.append(line);}if(code<200||code>=300)throw new IOException("HTTP "+code);JSONObject j=new JSONObject(body.toString());if(!j.optBoolean("ok",true))throw new IOException(j.optString("message",j.optString("error","API hatası")));saveCache(j);runOnUiThread(()->{data=j;status.setText("VERİ HAZIR");status.setTextColor(GREEN);redraw();if(notify)toast("Veri güncellendi");});}catch(Exception ex){runOnUiThread(()->{status.setText(data==null?"VERİ YOK":"ÖNBELLEK");status.setTextColor(data==null?RED:MUTED);if(notify||data==null)toast("Bağlantı hatası: "+ex.getMessage());});}finally{if(h!=null)h.disconnect();}});}
  private void toast(String s){Toast.makeText(this,s,Toast.LENGTH_LONG).show();}
  @Override protected void onDestroy(){pool.shutdownNow();super.onDestroy();}
}
