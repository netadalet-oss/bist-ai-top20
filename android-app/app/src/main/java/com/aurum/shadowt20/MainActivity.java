package com.aurum.shadowt20;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private WebView webView;
    private final ExecutorService executor = Executors.newCachedThreadPool();

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new NativeBridge(), "AurumNative");
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        executor.shutdownNow();
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    private final class NativeBridge {
        @JavascriptInterface
        public String getReferenceCatalog() {
            return "{\"status\":\"READY\",\"sourceLock\":\"5fbe5a2df9ec7a28f8e8b87d4648a8f1f0826dd2\",\"releaseMode\":\"SHADOW_ONLY\"}";
        }

        @JavascriptInterface
        public String getUniverseSnapshot() {
            return "{\"status\":\"UNAVAILABLE\",\"source\":\"REMOTE_API_REQUIRED\",\"members\":[]}";
        }

        @JavascriptInterface
        public void request(String id, String url, String method, String headersJson, String body, int timeoutMs) {
            executor.execute(() -> executeRequest(id, url, method, headersJson, body, timeoutMs));
        }
    }

    private void executeRequest(String id, String target, String method, String headersJson, String body, int timeoutMs) {
        JSONObject result = new JSONObject();
        HttpURLConnection connection = null;
        try {
            URL url = new URL(target);
            if (!"https".equalsIgnoreCase(url.getProtocol())) throw new SecurityException("Yalnız HTTPS desteklenir");
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod(method == null || method.isBlank() ? "GET" : method);
            connection.setConnectTimeout(Math.max(3000, timeoutMs));
            connection.setReadTimeout(Math.max(3000, timeoutMs));
            connection.setInstanceFollowRedirects(true);

            JSONObject headers = new JSONObject(headersJson == null ? "{}" : headersJson);
            Iterator<String> keys = headers.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                connection.setRequestProperty(key, headers.optString(key, ""));
            }

            if (body != null && !body.isEmpty() && !"GET".equalsIgnoreCase(connection.getRequestMethod())) {
                connection.setDoOutput(true);
                connection.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
            }

            int status = connection.getResponseCode();
            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            result.put("status", status);
            result.put("url", connection.getURL().toString());
            result.put("body", readAll(stream));
            JSONObject responseHeaders = new JSONObject();
            connection.getHeaderFields().forEach((key, values) -> {
                if (key != null && values != null && !values.isEmpty()) {
                    try { responseHeaders.put(key, values.get(0)); } catch (Exception ignored) { }
                }
            });
            result.put("headers", responseHeaders);
        } catch (Exception error) {
            try { result.put("error", error.getClass().getSimpleName() + ": " + error.getMessage()); } catch (Exception ignored) { }
        } finally {
            if (connection != null) connection.disconnect();
        }

        String js = "window.__aurumNativeHttpResponse(" + JSONObject.quote(id) + "," + JSONObject.quote(result.toString()) + ");";
        runOnUiThread(() -> webView.evaluateJavascript(js, null));
    }

    private static String readAll(InputStream stream) throws Exception {
        if (stream == null) return "";
        StringBuilder text = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) text.append(line).append('\n');
        }
        return text.toString();
    }
}
