package com.aurum.top20next;

import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;

public final class MainActivity extends Activity {
  private static final int NAVY=Color.rgb(2,8,20), CARD=Color.rgb(8,25,48), GOLD=Color.rgb(212,175,55), TEXT=Color.rgb(239,244,252), MUTED=Color.rgb(157,174,196);
  private static final String SOURCE_SHA="5fbe5a2df9ec7a28f8e8b87d4648a8f1f0826dd2";
  private final ExecutorService pool=Executors.newSingleThreadExecutor();
  private LinearLayout content, nav; private TextView title,status; private JSONObject data; private SharedPreferences prefs;

  @Override public void onCreate(Bundle b){super.onCreate(b); prefs=getSharedPreferences("aurum",MODE_PRIVATE); build(); showOverview();}
  private int dp(int v){return Math.round(v*getResources().getDisplayMetrics().density);} 
  private TextView text(String s,int sp,int color){TextView v=new TextView(this);v.setText(s);v.setTextSize(sp);v.setTextColor(color);v.setPadding(0,dp(4),0,dp(4));return v;}
  private TextView heading(String s){TextView v=text(s,18,TEXT);v.setTypeface(Typeface.DEFAULT_BOLD);return v;}
  private void build(){
    LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(NAVY);
    LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);top.setPadding(dp(16),dp(14),dp(16),dp(10));
    ImageView logo=new ImageView(this);logo.setImageResource(R.drawable.ic_launcher);top.addView(logo,new LinearLayout.LayoutParams(dp(48),dp(48)));
    LinearLayout names=new LinearLayout(this);names.setOrientation(LinearLayout.VERTICAL);names.setPadding(dp(12),0,0,0);TextView brand=heading("AURUM TOP20 PRO X");brand.setTextColor(GOLD);names.addView(brand);title=text("Genel Bakış",25,TEXT);title.setTypeface(Typeface.DEFAULT_BOLD);names.addView(title);top.addView(names,new LinearLayout.LayoutParams(0,-2,1));
    status=text("VERİ YOK",12,GOLD);status.setTypeface(Typeface.DEFAULT_BOLD);top.addView(status);root.addView(top);
    ScrollView scroll=new ScrollView(this);content=new LinearLayout(this);content.setOrientation(LinearLayout.VERTICAL);content.setPadding(dp(14),dp(4),dp(14),dp(90));scroll.addView(content);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
    nav=new LinearLayout(this);nav.setGravity(Gravity.CENTER);nav.setPadding(dp(4),dp(8),dp(4),dp(10));String[] ns={"Genel","S","K1–K5","Kalite","Başarı","Kaynak","Ayar"};for(String n:ns){Button x=new Button(this);x.setText(n);x.setTextSize(10);x.setTextColor(TEXT);x.setBackgroundColor(CARD);x.setAllCaps(false);x.setOnClickListener(v->go(n));nav.addView(x,new LinearLayout.LayoutParams(0,dp(54),1));}root.addView(nav);setContentView(root);
  }
  private void go(String n){if(n.equals("Genel"))showOverview();else if(n.equals("S"))showSelection();else if(n.equals("K1–K5"))showModels();else if(n.equals("Kalite"))showQuality();else if(n.equals("Başarı"))showPerformance();else if(n.equals("Kaynak"))showSource();else showSettings();}
  private void page(String name){title.setText(name);content.removeAllViews();}
  private LinearLayout card(String h){LinearLayout c=new LinearLayout(this);c.setOrientation(LinearLayout.VERTICAL);c.setPadding(dp(16),dp(14),dp(16),dp(14));c.setBackgroundColor(CARD);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.setMargins(0,0,0,dp(12));c.setLayoutParams(p);c.addView(heading(h));content.addView(c);return c;}
  private void row(LinearLayout c,String a,String b){LinearLayout r=new LinearLayout(this);r.setPadding(0,dp(7),0,dp(7));TextView l=text(a,14,MUTED);TextView v=text(b,14,TEXT);v.setGravity(Gravity.END);v.setTypeface(Typeface.DEFAULT_BOLD);r.addView(l,new LinearLayout.LayoutParams(0,-2,1));r.addView(v,new LinearLayout.LayoutParams(0,-2,1));c.addView(r);}
  private String opt(String path,String fallback){try{Object x=data;for(String k:path.split("\\."))x=((JSONObject)x).get(k);return String.valueOf(x);}catch(Exception e){return fallback;}}
  private void showOverview(){page("Genel Bakış");LinearLayout c=card("Çalışma Durumu");row(c,"Yayın modu","SHADOW-ONLY");row(c,"Kaynak SHA",SOURCE_SHA.substring(0,12)+"…");row(c,"Veri şeması","468 sütun / A:QZ");row(c,"S adayı",data==null?"—":String.valueOf(data.optJSONArray("selection")!=null?data.optJSONArray("selection").length():0));LinearLayout i=card("Güvenlik İlkeleri");i.addView(text("• Tahmin sonrası veri özelliklerde kullanılamaz.\n• Snapshot ve giriş fiyatı değiştirilemez.\n• Eksik veri sıfır skor sayılmaz.\n• Tek-model K5 konsensüs değildir.\n• Kalite veya bütünlük hatasında üretim durur.",14,TEXT));}
  private void showSelection(){page("S Listesi");JSONArray a=data==null?null:data.optJSONArray("selection");if(a==null||a.length()==0){card("SAME_DAY / NEXT_DAY").addView(text("Doğrulanmış snapshot verisi yok. Uygulama veri uydurmaz.",15,MUTED));return;}for(int i=0;i<a.length();i++){JSONObject o=a.optJSONObject(i);LinearLayout c=card((i+1)+" · "+o.optString("symbol",o.optString("sym","?")));row(c,"Skor",o.optString("score",o.optString("finalScore","—")));row(c,"Giriş",o.optString("entryPrice","—"));row(c,"Hedef",o.optString("horizon","—"));row(c,"Modeller",o.optJSONArray("sourceModels")!=null?o.optJSONArray("sourceModels").toString():"—");}}
  private void showModels(){page("K1–K5 Modelleri");String[][] m={{"K1 · Kısa Vade Momentum","Momentum, hacim, volatilite ve Bollinger. Yüksek volatilite yönü gölge testinde."},{"K2 · Trend Devamı","EMA20/50/200, MACD, RSI ve Momentum10. RSI 55 simetrisi kalibrasyon bekliyor."},{"K3 · Dipten Toparlanma","Hisse bazında adaptif pencere ve hacim teyidi. Derin dip ödülü karantinada."},{"K4 · Çoklu Zaman Dilimi","1/3/6 aylık getiri ve pozitif-getiri risk oranı. Negatif getiri stabilite ödülü kaldırıldı."},{"K5 · Konsensüs","En az iki model desteği; tek-model adayları konsensüs sayılmaz."}};for(String[] x:m){LinearLayout c=card(x[0]);TextView b=text("SHADOW",12,GOLD);b.setTypeface(Typeface.DEFAULT_BOLD);c.addView(b);c.addView(text(x[1],14,TEXT));}}
  private void showQuality(){page("Veri Kalitesi");LinearLayout c=card("Canlı Doğrulama");row(c,"Evren","556");row(c,"Temel teknik kapsam","555 / 556 · %99,82");row(c,"Hacim değişimi","553 / 556 · %99,46");row(c,"Kalite eşiği","%80 · FAIL-CLOSED");LinearLayout d=card("Zorunlu Dışlamalar");d.addView(text("SNKRN — Temel, teknik ve T1–T30 verisi eksik; tüm modellerden dışlanır.\n\nUMPAS — Hacim değişimi tarihçesi eksik; K3 dışı.\n\nYGYO — Hacim değişimi tarihçesi eksik; K3 dışı.",14,TEXT));}
  private void showPerformance(){page("Performans");LinearLayout c=card("Ölçüm Sözleşmesi");row(c,"Precision@20",opt("metrics.precisionAt20","—"));row(c,"Recall@20",opt("metrics.recallAt20","—"));row(c,"Ortalama brüt getiri",opt("metrics.averageReturnPct","—"));row(c,"Ortalama net getiri",opt("metrics.averageNetReturnPct","—"));row(c,"MFE",opt("metrics.averageMfePct","—"));row(c,"MAE",opt("metrics.averageMaePct","—"));card("Deney Durumu").addView(text("Gerçek out-of-sample üstünlük henüz kanıtlanmadı. Legacy ve yeni S aynı tahmin anı, ayrı giriş fiyatı ve ortak Reel Top20 outcome ile karşılaştırılmalıdır.",14,MUTED));}
  private void showSource(){page("Kaynak ve Sürüm");LinearLayout c=card("Kilitli Kaynak");row(c,"Repository","netadalet-oss/bist-ai-top20");row(c,"Arşiv dalı","archive/apps-script-foundation-2026-08-02");c.addView(text(SOURCE_SHA,12,GOLD));LinearLayout m=card("Modüler Motor");m.addView(text("00_Config.gs – 42_ExpertCriteriaParityAudit.gs\n\nVeriler → kalite kapısı → K1–K4 → K5 → S → snapshot → outcome → performans",14,TEXT));}
  private void showSettings(){page("Bağlantı Ayarları");LinearLayout c=card("Apps Script Web App");EditText e=new EditText(this);e.setText(prefs.getString("endpoint",""));e.setHint("https://script.google.com/macros/s/.../exec");e.setTextColor(TEXT);e.setHintTextColor(MUTED);c.addView(e);Button save=new Button(this);save.setText("Kaydet ve Test Et");save.setTextColor(NAVY);save.setBackgroundColor(GOLD);save.setOnClickListener(v->{String u=e.getText().toString().trim();prefs.edit().putString("endpoint",u).apply();refresh(u);});c.addView(save);c.addView(text("Beklenen JSON: { selection: [], quality: {}, metrics: {} }. Yalnız HTTPS kabul edilir.",13,MUTED));}
  private void refresh(String endpoint){if(!endpoint.startsWith("https://")){toast("Geçerli HTTPS endpoint girin");return;}status.setText("BAĞLANIYOR");pool.submit(()->{try{URL u=new URL(endpoint+(endpoint.contains("?")?"&":"?")+"action=mobileSnapshot");HttpURLConnection h=(HttpURLConnection)u.openConnection();h.setConnectTimeout(15000);h.setReadTimeout(22000);h.setRequestProperty("Accept","application/json");int code=h.getResponseCode();InputStream s=code>=400?h.getErrorStream():h.getInputStream();StringBuilder b=new StringBuilder();try(BufferedReader r=new BufferedReader(new InputStreamReader(s,StandardCharsets.UTF_8))){String line;while((line=r.readLine())!=null)b.append(line);}if(code<200||code>=300)throw new IOException("HTTP "+code);JSONObject j=new JSONObject(b.toString());runOnUiThread(()->{data=j;status.setText("VERİ HAZIR");showOverview();toast("Veri güncellendi");});}catch(Exception ex){runOnUiThread(()->{status.setText("VERİ YOK");toast("Bağlantı hatası: "+ex.getMessage());});}});}
  private void toast(String s){Toast.makeText(this,s,Toast.LENGTH_LONG).show();}
  @Override protected void onDestroy(){pool.shutdownNow();super.onDestroy();}
}
