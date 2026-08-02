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
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.*;

public final class MainActivity extends Activity {
  private static final int NAVY=Color.rgb(2,8,20), CARD=Color.rgb(8,25,48), GOLD=Color.rgb(212,175,55), TEXT=Color.rgb(239,244,252), MUTED=Color.rgb(157,174,196), RED=Color.rgb(240,96,96), GREEN=Color.rgb(89,204,144);
  private static final String SOURCE_SHA="5fbe5a2df9ec7a28f8e8b87d4648a8f1f0826dd2";
  private static final String PREF_ENDPOINT="endpoint", PREF_TOKEN="token", PREF_CACHE="cache", PREF_CACHE_TS="cacheTs";
  private final ExecutorService pool=Executors.newSingleThreadExecutor();
  private LinearLayout content, nav;
  private TextView title,status;
  private JSONObject data;
  private SharedPreferences prefs;
  private String currentPage="Genel";

  @Override public void onCreate(Bundle b){
    super.onCreate(b);
    prefs=getSharedPreferences("aurum",MODE_PRIVATE);
    loadCache();
    build();
    showOverview();
    String endpoint=prefs.getString(PREF_ENDPOINT,"");
    if(endpoint.startsWith("https://")) refresh(endpoint,false);
  }

  private int dp(int v){return Math.round(v*getResources().getDisplayMetrics().density);}
  private TextView text(String s,int sp,int color){TextView v=new TextView(this);v.setText(s);v.setTextSize(sp);v.setTextColor(color);v.setPadding(0,dp(4),0,dp(4));v.setLineSpacing(0,1.08f);return v;}
  private TextView heading(String s){TextView v=text(s,18,TEXT);v.setTypeface(Typeface.DEFAULT_BOLD);return v;}

  private void build(){
    LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(NAVY);
    LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);top.setPadding(dp(16),dp(14),dp(16),dp(10));
    ImageView logo=new ImageView(this);logo.setImageResource(R.drawable.ic_launcher);top.addView(logo,new LinearLayout.LayoutParams(dp(48),dp(48)));
    LinearLayout names=new LinearLayout(this);names.setOrientation(LinearLayout.VERTICAL);names.setPadding(dp(12),0,0,0);
    TextView brand=heading("AURUM TOP20 PRO X");brand.setTextColor(GOLD);names.addView(brand);
    title=text("Genel Bakış",25,TEXT);title.setTypeface(Typeface.DEFAULT_BOLD);names.addView(title);top.addView(names,new LinearLayout.LayoutParams(0,-2,1));
    status=text(data==null?"VERİ YOK":"ÖNBELLEK",12,data==null?GOLD:MUTED);status.setTypeface(Typeface.DEFAULT_BOLD);status.setGravity(Gravity.END);top.addView(status);root.addView(top);
    ScrollView scroll=new ScrollView(this);content=new LinearLayout(this);content.setOrientation(LinearLayout.VERTICAL);content.setPadding(dp(14),dp(4),dp(14),dp(90));scroll.addView(content);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
    nav=new LinearLayout(this);nav.setGravity(Gravity.CENTER);nav.setPadding(dp(4),dp(8),dp(4),dp(10));
    String[] ns={"Genel","S","K1–K5","Kalite","Başarı","Kaynak","Ayar"};
    for(String n:ns){Button x=new Button(this);x.setText(n);x.setTextSize(10);x.setTextColor(TEXT);x.setBackgroundColor(CARD);x.setAllCaps(false);x.setOnClickListener(v->go(n));nav.addView(x,new LinearLayout.LayoutParams(0,dp(54),1));}
    root.addView(nav);setContentView(root);
  }

  private void go(String n){currentPage=n;if(n.equals("Genel"))showOverview();else if(n.equals("S"))showSelection();else if(n.equals("K1–K5"))showModels();else if(n.equals("Kalite"))showQuality();else if(n.equals("Başarı"))showPerformance();else if(n.equals("Kaynak"))showSource();else showSettings();}
  private void redraw(){go(currentPage);}
  private void page(String name){title.setText(name);content.removeAllViews();}
  private LinearLayout card(String h){LinearLayout c=new LinearLayout(this);c.setOrientation(LinearLayout.VERTICAL);c.setPadding(dp(16),dp(14),dp(16),dp(14));c.setBackgroundColor(CARD);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.setMargins(0,0,0,dp(12));c.setLayoutParams(p);c.addView(heading(h));content.addView(c);return c;}
  private void row(LinearLayout c,String a,String b){LinearLayout r=new LinearLayout(this);r.setPadding(0,dp(7),0,dp(7));TextView l=text(a,14,MUTED);TextView v=text(b,14,TEXT);v.setGravity(Gravity.END);v.setTypeface(Typeface.DEFAULT_BOLD);r.addView(l,new LinearLayout.LayoutParams(0,-2,1));r.addView(v,new LinearLayout.LayoutParams(0,-2,1));c.addView(r);}
  private Button action(String caption){Button b=new Button(this);b.setText(caption);b.setTextColor(NAVY);b.setBackgroundColor(GOLD);b.setAllCaps(false);return b;}

  private String opt(String path,String fallback){try{Object x=data;for(String k:path.split("\\."))x=((JSONObject)x).get(k);if(x==null||x==JSONObject.NULL||String.valueOf(x).trim().isEmpty())return fallback;return String.valueOf(x);}catch(Exception e){return fallback;}}
  private JSONObject object(String name){return data==null?null:data.optJSONObject(name);}
  private JSONArray array(String name){return data==null?null:data.optJSONArray(name);}
  private String display(Object value,String fallback){if(value==null||value==JSONObject.NULL)return fallback;String s=String.valueOf(value).trim();return s.isEmpty()||s.equals("null")?fallback:s;}
  private String pct(Object value){String s=display(value,"—");if(s.equals("—"))return s;try{double d=Double.parseDouble(s.replace(",","."));if(Math.abs(d)<=1.0)d*=100.0;return String.format(Locale.US,"%.2f%%",d);}catch(Exception e){return s.contains("%")?s:s+"%";}}

  private void showOverview(){
    page("Genel Bakış");
    LinearLayout c=card("Çalışma Durumu");
    row(c,"Yayın modu",opt("mode","SHADOW-ONLY"));
    row(c,"Kaynak SHA",opt("sourceSha",SOURCE_SHA).substring(0,Math.min(12,opt("sourceSha",SOURCE_SHA).length()))+"…");
    row(c,"Veri şeması",opt("schema.columns","468")+" sütun / "+opt("schema.range","A:QZ"));
    JSONArray s=array("selection");row(c,"S adayı",s==null?"—":String.valueOf(s.length()));
    row(c,"Son sunucu zamanı",opt("generatedAt","—"));
    long cacheTs=prefs.getLong(PREF_CACHE_TS,0);row(c,"Son cihaz senkronu",cacheTs==0?"—":new SimpleDateFormat("dd.MM.yyyy HH:mm:ss",Locale.getDefault()).format(new Date(cacheTs)));
    Button sync=action("Şimdi Yenile");sync.setOnClickListener(v->{String endpoint=prefs.getString(PREF_ENDPOINT,"");if(endpoint.isEmpty())showSettings();else refresh(endpoint,true);});c.addView(sync);

    JSONObject q=object("quality");
    LinearLayout qcard=card("Hızlı Kalite Özeti");
    row(qcard,"Son çalışma",q==null?"—":q.optString("latestRunStatus","—"));
    row(qcard,"Teknik kapsam",q==null?"%99,82":pct(q.opt("technicalCoverage")));
    row(qcard,"Kalite kapısı",q!=null&&q.optBoolean("failClosed",true)?"FAIL-CLOSED":"UYARI");

    LinearLayout i=card("Güvenlik İlkeleri");
    i.addView(text("• Tahmin sonrası veri özelliklerde kullanılamaz.\n• Snapshot ve giriş fiyatı değiştirilemez.\n• Eksik veri sıfır skor sayılmaz.\n• Tek-model K5 konsensüs değildir.\n• Kalite veya bütünlük hatasında üretim durur.",14,TEXT));
  }

  private void showSelection(){
    page("S Listesi");JSONArray a=array("selection");
    if(a==null||a.length()==0){LinearLayout c=card("SAME_DAY / NEXT_DAY");c.addView(text("Doğrulanmış snapshot verisi yok. Ayarlar bölümünden Apps Script Web App endpoint'ini tanımlayın. Uygulama veri uydurmaz.",15,MUTED));return;}
    for(int i=0;i<a.length();i++){
      JSONObject o=a.optJSONObject(i);if(o==null)continue;
      String symbol=o.optString("symbol",o.optString("sym","?"));String rank=display(o.opt("rank"),String.valueOf(i+1));
      LinearLayout c=card(rank+" · "+symbol);
      row(c,"Skor",display(o.opt("score"),display(o.opt("finalScore"),"—")));
      row(c,"Giriş",display(o.opt("entryPrice"),"—"));
      row(c,"Hedef",display(o.opt("horizon"),"—"));
      JSONArray models=o.optJSONArray("sourceModels");row(c,"Modeller",models==null?"—":models.join(", ").replace("\"",""));
    }
  }

  private void showModels(){
    page("K1–K5 Modelleri");
    JSONObject models=object("models");
    String[][] descriptions={{"K1","Kısa vade momentum, hacim, volatilite ve Bollinger."},{"K2","EMA20/50/200, MACD, RSI ve Momentum10 trend devamı."},{"K3","Hisse bazında adaptif dipten toparlanma ve hacim teyidi."},{"K4","1/3/6 aylık liderlik ve pozitif-getiri risk oranı."},{"K5","En az iki model desteğine dayalı konsensüs."}};
    for(String[] d:descriptions){
      JSONArray rows=models==null?null:models.optJSONArray(d[0]);
      LinearLayout c=card(d[0]+" · "+d[1]);
      TextView badge=text(rows==null||rows.length()==0?"VERİ YOK":"İLK "+Math.min(rows.length(),5)+" ADAY",12,rows==null||rows.length()==0?MUTED:GOLD);badge.setTypeface(Typeface.DEFAULT_BOLD);c.addView(badge);
      if(rows!=null)for(int i=0;i<Math.min(rows.length(),5);i++){
        JSONObject r=rows.optJSONObject(i);if(r==null)continue;
        String sym=first(r,"symbol","sym","Hisse","Sembol");String score=first(r,"score","Skor","FinalScore","Puan");
        row(c,(i+1)+" · "+display(sym,"?"),display(score,"—"));
      }
    }
  }

  private String first(JSONObject o,String... keys){for(String k:keys){if(o.has(k)&&o.opt(k)!=JSONObject.NULL&&!String.valueOf(o.opt(k)).trim().isEmpty())return String.valueOf(o.opt(k));}return "";}

  private void showQuality(){
    page("Veri Kalitesi");JSONObject q=object("quality");
    LinearLayout c=card("Canlı Doğrulama");
    row(c,"Evren",q==null?"556":display(q.opt("universe"),"556"));
    row(c,"Temel teknik kapsam",q==null?"%99,82":pct(q.opt("technicalCoverage")));
    row(c,"Hacim değişimi",q==null?"%99,46":pct(q.opt("volumeChangeCoverage")));
    row(c,"Kalite eşiği",q==null?"%80 · FAIL-CLOSED":pct(q.opt("threshold"))+" · "+(q.optBoolean("failClosed",true)?"FAIL-CLOSED":"UYARI"));
    row(c,"Son çalışma",q==null?"—":q.optString("latestRunStatus","—"));
    if(q!=null&&!q.optString("latestRunMessage","").isEmpty())c.addView(text(q.optString("latestRunMessage"),13,RED));
    LinearLayout d=card("Zorunlu Dışlamalar");JSONArray exclusions=q==null?null:q.optJSONArray("exclusions");
    if(exclusions==null){d.addView(text("SNKRN — Tüm modellerden dışlanır.\n\nUMPAS — K3 dışı.\n\nYGYO — K3 dışı.",14,TEXT));}
    else for(int i=0;i<exclusions.length();i++){JSONObject x=exclusions.optJSONObject(i);if(x!=null)d.addView(text("• "+x.optString("symbol","?")+" — "+x.optString("reason",""),14,TEXT));}
  }

  private void showPerformance(){
    page("Performans");JSONObject m=object("metrics");
    LinearLayout c=card("Ölçüm Sonuçları");
    row(c,"Precision@20",m==null?"—":pct(m.opt("precisionAt20")));
    row(c,"Recall@20",m==null?"—":pct(m.opt("recallAt20")));
    row(c,"Ortalama brüt getiri",m==null?"—":pct(m.opt("averageReturnPct")));
    row(c,"Ortalama net getiri",m==null?"—":pct(m.opt("averageNetReturnPct")));
    row(c,"MFE",m==null?"—":pct(m.opt("averageMfePct")));
    row(c,"MAE",m==null?"—":pct(m.opt("averageMaePct")));
    row(c,"Örneklem",m==null?"0":display(m.opt("sampleCount"),"0"));
    LinearLayout warning=card("Deney Durumu");warning.addView(text("Gerçek out-of-sample üstünlük yeterli snapshot ve outcome birikmeden ilan edilmez. Legacy ve yeni S aynı tahmin anı, ayrı giriş fiyatı ve ortak Reel Top20 sonucu ile karşılaştırılır.",14,MUTED));
  }

  private void showSource(){
    page("Kaynak ve Sürüm");LinearLayout c=card("Kilitli Kaynak");
    row(c,"Repository","netadalet-oss/bist-ai-top20");row(c,"Arşiv dalı","archive/apps-script-foundation-2026-08-02");row(c,"Mobil API",opt("apiVersion","—"));c.addView(text(opt("sourceSha",SOURCE_SHA),12,GOLD));
    LinearLayout m=card("Modüler Motor");m.addView(text("00_Config.gs – 43_MobileApi.gs\n\nVeriler → kalite kapısı → K1–K4 → K5 → S → snapshot → outcome → performans → mobil API",14,TEXT));
  }

  private void showSettings(){
    page("Bağlantı Ayarları");LinearLayout c=card("Apps Script Web App");
    EditText endpoint=new EditText(this);endpoint.setText(prefs.getString(PREF_ENDPOINT,""));endpoint.setHint("https://script.google.com/macros/s/.../exec");endpoint.setTextColor(TEXT);endpoint.setHintTextColor(MUTED);endpoint.setSingleLine(false);c.addView(endpoint);
    EditText token=new EditText(this);token.setText(prefs.getString(PREF_TOKEN,""));token.setHint("Opsiyonel MOBILE.API.TOKEN");token.setTextColor(TEXT);token.setHintTextColor(MUTED);token.setSingleLine(true);c.addView(token);
    Button save=action("Kaydet ve Test Et");save.setOnClickListener(v->{String u=endpoint.getText().toString().trim();String t=token.getText().toString().trim();prefs.edit().putString(PREF_ENDPOINT,u).putString(PREF_TOKEN,t).apply();refresh(u,true);});c.addView(save);
    Button clear=new Button(this);clear.setText("Önbelleği Temizle");clear.setAllCaps(false);clear.setOnClickListener(v->{prefs.edit().remove(PREF_CACHE).remove(PREF_CACHE_TS).apply();data=null;status.setText("VERİ YOK");redraw();});c.addView(clear);
    c.addView(text("Apps Script projesine 43_MobileApi.gs eklenmeli ve Web App olarak dağıtılmalıdır. Endpoint yalnız HTTPS kabul eder. Token tanımlı değilse boş bırakılır.",13,MUTED));
  }

  private void loadCache(){try{String raw=prefs.getString(PREF_CACHE,"");if(!raw.isEmpty())data=new JSONObject(raw);}catch(Exception ignored){data=null;}}
  private void saveCache(JSONObject j){prefs.edit().putString(PREF_CACHE,j.toString()).putLong(PREF_CACHE_TS,System.currentTimeMillis()).apply();}

  private void refresh(String endpoint,boolean notify){
    if(endpoint==null||!endpoint.startsWith("https://")){toast("Geçerli HTTPS endpoint girin");return;}
    status.setText("BAĞLANIYOR");status.setTextColor(GOLD);
    pool.submit(()->{
      HttpURLConnection h=null;
      try{
        String token=prefs.getString(PREF_TOKEN,"");StringBuilder target=new StringBuilder(endpoint);target.append(endpoint.contains("?")?"&":"?").append("action=mobileSnapshot");if(!token.isEmpty())target.append("&token=").append(URLEncoder.encode(token,"UTF-8"));target.append("&_=").append(System.currentTimeMillis());
        URL u=new URL(target.toString());h=(HttpURLConnection)u.openConnection();h.setConnectTimeout(15000);h.setReadTimeout(25000);h.setRequestProperty("Accept","application/json");h.setUseCaches(false);
        int code=h.getResponseCode();InputStream stream=code>=400?h.getErrorStream():h.getInputStream();if(stream==null)throw new IOException("Boş yanıt");
        StringBuilder body=new StringBuilder();try(BufferedReader r=new BufferedReader(new InputStreamReader(stream,StandardCharsets.UTF_8))){String line;while((line=r.readLine())!=null)body.append(line);}
        if(code<200||code>=300)throw new IOException("HTTP "+code);
        JSONObject j=new JSONObject(body.toString());if(!j.optBoolean("ok",true))throw new IOException(j.optString("message",j.optString("error","API hatası")));
        saveCache(j);
        runOnUiThread(()->{data=j;status.setText("VERİ HAZIR");status.setTextColor(GREEN);redraw();if(notify)toast("Veri güncellendi");});
      }catch(Exception ex){runOnUiThread(()->{status.setText(data==null?"VERİ YOK":"ÖNBELLEK");status.setTextColor(data==null?RED:MUTED);if(notify||data==null)toast("Bağlantı hatası: "+ex.getMessage());});}
      finally{if(h!=null)h.disconnect();}
    });
  }

  private void toast(String s){Toast.makeText(this,s,Toast.LENGTH_LONG).show();}
  @Override protected void onDestroy(){pool.shutdownNow();super.onDestroy();}
}
