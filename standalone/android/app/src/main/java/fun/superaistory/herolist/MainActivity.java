package fun.superaistory.herolist;

import android.app.Activity;
import android.app.PrintManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.widget.Toast;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Base64;
import java.util.Locale;

public final class MainActivity extends Activity {
    private static final int EXPORT_FILE = 7;
    private static final int IMPORT_FILE = 8;
    private WebView web;
    private byte[] pendingBytes;
    private ValueCallback<Uri[]> importCallback;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new Bridge(), "HeroListNative");
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (importCallback != null) importCallback.onReceiveValue(null);
                importCallback = cb;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.setType("*/*");
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"application/json","application/zip","application/octet-stream"});
                startActivityForResult(intent, IMPORT_FILE);
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (!"appassets.androidplatform.net".equals(url.getHost()) || !"https".equals(url.getScheme())) {
                    return new WebResourceResponse("text/plain","UTF-8",403,"Forbidden",new java.util.HashMap<>(),new java.io.ByteArrayInputStream(new byte[0]));
                }
                String p = Uri.decode(url.getPath());
                if (p == null || p.contains("..")) return null;
                if (p.endsWith("/")) p += "index.html";
                if (p.startsWith("/")) p = p.substring(1);
                String mime = "application/octet-stream";
                if (p.endsWith(".html")) mime="text/html";
                else if (p.endsWith(".js")) mime="text/javascript";
                else if (p.endsWith(".css")) mime="text/css";
                else if (p.endsWith(".json")) mime="application/json";
                else if (p.endsWith(".svg")) mime="image/svg+xml";
                else if (p.endsWith(".png")) mime="image/png";
                else if (p.endsWith(".jpg")||p.endsWith(".jpeg")) mime="image/jpeg";
                else if (p.endsWith(".woff2")) mime="font/woff2";
                else if (p.endsWith(".webp")) mime="image/webp";
                try {
                    InputStream stream = getAssets().open("site/" + p);
                    java.util.Map<String,String> headers = new java.util.HashMap<>();
                    headers.put("Access-Control-Allow-Origin","*");
                    return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,stream);
                } catch(Exception ex) {
                    return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",new java.util.HashMap<>(),new java.io.ByteArrayInputStream(new byte[0]));
                }
            }
        });
        web.loadUrl("https://appassets.androidplatform.net/");
    }
    public final class Bridge {
        @JavascriptInterface public void saveFile(String name, String mime, String base64) {
            byte[] bytes = Base64.getDecoder().decode(base64);
            runOnUiThread(() -> {
                pendingBytes = bytes;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(mime);
                intent.putExtra(Intent.EXTRA_TITLE,name);
                startActivityForResult(intent,EXPORT_FILE);
            });
        }
        @JavascriptInterface public void printPdf(String name) {
            runOnUiThread(() -> {
                PrintManager mgr=(PrintManager)getSystemService(PRINT_SERVICE);
                mgr.print(name,web.createPrintDocumentAdapter(name),new PrintAttributes.Builder().build());
            });
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request,result,data);
        if(request == IMPORT_FILE) {
            if(importCallback != null) {
                importCallback.onReceiveValue(result == RESULT_OK && data != null ? new Uri[]{data.getData()} : null);
                importCallback=null;
            }
        }
        if(request == EXPORT_FILE && result == RESULT_OK && data != null && pendingBytes != null) {
            try(OutputStream out=getContentResolver().openOutputStream(data.getData())) {
                if(out == null) throw new java.io.IOException("No output");
                out.write(pendingBytes);
                Toast.makeText(this,"Файл сохранён",Toast.LENGTH_SHORT).show();
            } catch(Exception e) {
                Toast.makeText(this,"Ошибка сохранения файла",Toast.LENGTH_LONG).show();
            }
        }
        if(request == EXPORT_FILE) pendingBytes=null;
    }
    @Override public void onBackPressed() {
        if(web.canGoBack())web.goBack(); else super.onBackPressed();
    }
}
