#!/usr/bin/env bash
set -euo pipefail

# Keep the exact HIO source while Capacitor regenerates the Android shell.
cp android/app/src/main/java/nl/tools/app/HioScanActivity.java /tmp/HioScanActivity.java

npm install --no-audit --no-fund

# Bundle both Wllama runtimes locally so the assistant does not need a CDN after installation.
rm -rf tools/assistant/vendor
mkdir -p tools/assistant/vendor/wllama tools/assistant/vendor/wllama-compat
TMP_WLLAMA="$(mktemp -d)"
PKG_WLLAMA="$(cd "$TMP_WLLAMA" && npm pack @wllama/wllama@3.5.1 --silent)"
tar -xzf "$TMP_WLLAMA/$PKG_WLLAMA" -C "$TMP_WLLAMA"
cp -R "$TMP_WLLAMA/package/esm/." tools/assistant/vendor/wllama/

TMP_COMPAT="$(mktemp -d)"
PKG_COMPAT="$(cd "$TMP_COMPAT" && npm pack @wllama/wllama-compat@3.5.1 --silent)"
tar -xzf "$TMP_COMPAT/$PKG_COMPAT" -C "$TMP_COMPAT"
cp -R "$TMP_COMPAT/package/." tools/assistant/vendor/wllama-compat/

test -f tools/assistant/vendor/wllama/index.js
test -f tools/assistant/vendor/wllama/wasm/wllama.wasm
test -f tools/assistant/vendor/wllama-compat/wasm/wllama.wasm
test -f tools/assistant/vendor/wllama-compat/wasm/wllama.js

# Build the exact web tree used by Capacitor.
rm -rf www
mkdir -p www
cp index.html www/index.html
cp -R tools www/tools
cp -R shared www/shared

python3 <<'PY'
from pathlib import Path
assets=[]
for p in Path('www').rglob('*'):
    if p.is_file() and p.stat().st_size < 12_000_000:
        assets.append('./'+p.relative_to('www').as_posix())
js = "const CACHE='toolsapk-v4';\n"
js += "const ASSETS="+repr(assets).replace("'",'"')+";\n"
js += "self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));\n"
js += "self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));\n"
js += "self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(x=>{const y=x.clone();caches.open(CACHE).then(c=>c.put(e.request,y));return x}).catch(()=>r))) });\n"
Path('sw.js').write_text(js)
Path('www/sw.js').write_text(js)
PY

# Generate a fresh Android project from the current Capacitor version.
rm -rf android
npx cap add android
npx cap sync android

mkdir -p android/app/src/main/java/nl/tools/app
cp /tmp/HioScanActivity.java android/app/src/main/java/nl/tools/app/HioScanActivity.java

cat > android/app/src/main/java/nl/tools/app/LlamaBridge.java <<'JAVA'
package nl.tools.app;

import android.app.Activity;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.*;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class LlamaBridge {
    private final WebView webView;
    private final ExecutorService executor=Executors.newSingleThreadExecutor();
    private final File modelDir;
    private final File modelFile;

    private Object jni;
    private Method nativeLoadModel;
    private Method nativeComplete;
    private Method nativeReleaseModel;
    private Method nativeGetSystemInfo;
    private long modelHandle=0L;
    private String loadedPath="";

    public LlamaBridge(Activity activity,WebView webView){
        this.webView=webView;
        modelDir=new File(activity.getFilesDir(),"ai/models");
        modelFile=new File(modelDir,"assistant-qwen3-1.7b-q4_k_m.gguf");
    }

    private synchronized void ensureApi() throws Exception {
        if(jni!=null)return;
        Class<?> c=Class.forName("dev.ffmpegkit.llama.LlamaJNI");
        Field f=c.getDeclaredField("INSTANCE");
        f.setAccessible(true);
        jni=f.get(null);
        nativeLoadModel=c.getDeclaredMethod("nativeLoadModel",String.class,int.class,int.class,int.class);
        nativeComplete=c.getDeclaredMethod("nativeComplete",long.class,String.class,String.class,int.class,float.class,float.class,int.class,int.class);
        nativeReleaseModel=c.getDeclaredMethod("nativeReleaseModel",long.class);
        nativeGetSystemInfo=c.getDeclaredMethod("nativeGetSystemInfo");
        nativeLoadModel.setAccessible(true);
        nativeComplete.setAccessible(true);
        nativeReleaseModel.setAccessible(true);
        nativeGetSystemInfo.setAccessible(true);
    }

    private boolean apiAvailable(){
        try{ensureApi();return true;}catch(Throwable e){return false;}
    }

    private synchronized long ensureModelLoaded() throws Exception {
        ensureApi();
        String path=modelFile.getAbsolutePath();
        if(modelHandle!=0L&&path.equals(loadedPath))return modelHandle;
        releaseModelLocked();
        int threads=Math.max(2,Math.min(8,Runtime.getRuntime().availableProcessors()));
        Object result=nativeLoadModel.invoke(jni,path,4096,threads,0);
        modelHandle=((Number)result).longValue();
        if(modelHandle==0L)throw new IllegalStateException("Lokaal AI-model kon niet worden geladen");
        loadedPath=path;
        return modelHandle;
    }

    private synchronized void releaseModelLocked(){
        if(modelHandle==0L)return;
        try{ensureApi();nativeReleaseModel.invoke(jni,modelHandle);}catch(Throwable ignored){}
        modelHandle=0L;
        loadedPath="";
    }

    @JavascriptInterface
    public String getRuntimeInfo(){
        try{
            JSONObject o=new JSONObject();
            o.put("engine","llama.cpp");
            o.put("nativeAvailable",apiAvailable());
            o.put("modelPath",modelFile.getAbsolutePath());
            o.put("installed",modelFile.isFile());
            if(apiAvailable()){
                try{o.put("systemInfo",String.valueOf(nativeGetSystemInfo.invoke(jni)));}catch(Throwable ignored){}
            }
            return o.toString();
        }catch(Exception e){return "{}";}
    }

    @JavascriptInterface
    public boolean isModelInstalled(){
        return apiAvailable()&&modelFile.isFile()&&modelFile.length()>100_000_000L;
    }

    @JavascriptInterface
    public void downloadModel(String url,String expectedSha256,String requestId){
        executor.execute(()->{
            File tmp=new File(modelDir,modelFile.getName()+".part");
            try{
                if(!apiAvailable())throw new IllegalStateException("Native llama.cpp runtime ontbreekt");
                if(!modelDir.exists()&&!modelDir.mkdirs())throw new IOException("Modelmap kon niet worden gemaakt");
                HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
                c.setInstanceFollowRedirects(true);
                c.setConnectTimeout(20000);
                c.setReadTimeout(60000);
                c.setRequestProperty("User-Agent","ToolsAPK/1.0");
                c.connect();
                int code=c.getResponseCode();
                if(code<200||code>=300)throw new IOException("Download HTTP "+code);

                long total=c.getContentLengthLong(),done=0;
                MessageDigest digest=MessageDigest.getInstance("SHA-256");
                byte[] buf=new byte[1024*1024];
                try(InputStream in=new BufferedInputStream(c.getInputStream());
                    OutputStream out=new BufferedOutputStream(new FileOutputStream(tmp))){
                    int n,last=-1;
                    while((n=in.read(buf))>0){
                        out.write(buf,0,n);
                        digest.update(buf,0,n);
                        done+=n;
                        if(total>0){
                            int p=(int)(done*100/total);
                            if(p!=last){last=p;progress(requestId,p);}
                        }
                    }
                }
                String sha=hex(digest.digest());
                if(expectedSha256!=null&&!expectedSha256.isEmpty()&&!sha.equalsIgnoreCase(expectedSha256))
                    throw new IOException("SHA-256 controle mislukt");

                synchronized(this){releaseModelLocked();}
                if(modelFile.exists()&&!modelFile.delete())throw new IOException("Oud model kon niet worden vervangen");
                if(!tmp.renameTo(modelFile))throw new IOException("Model kon niet worden geplaatst");
                callback(requestId,new JSONObject().put("ok",true).put("bytes",modelFile.length()).toString());
            }catch(Exception e){
                tmp.delete();
                callback(requestId,error(e));
            }
        });
    }

    @JavascriptInterface
    public void generate(String requestJson,String requestId){
        executor.execute(()->{
            try{
                if(!isModelInstalled())throw new IllegalStateException("AI-model is niet geïnstalleerd");
                JSONObject req=new JSONObject(requestJson);
                JSONArray arr=req.getJSONArray("messages");
                StringBuilder system=new StringBuilder();
                StringBuilder prompt=new StringBuilder();

                for(int i=0;i<arr.length();i++){
                    JSONObject m=arr.getJSONObject(i);
                    String role=m.optString("role","user");
                    String content=m.optString("content","");
                    if("system".equals(role)){
                        if(system.length()>0)system.append("\n");
                        system.append(content);
                    }else{
                        prompt.append(role).append(": ").append(content).append("\n");
                    }
                }
                prompt.append("assistant:");

                long handle=ensureModelLoaded();
                Object raw=nativeComplete.invoke(
                    jni,
                    handle,
                    prompt.toString(),
                    system.toString(),
                    req.optInt("max_tokens",500),
                    (float)req.optDouble("temperature",0.35),
                    0.92f,
                    40,
                    -1
                );
                JSONObject result=new JSONObject(String.valueOf(raw));
                if(result.has("error"))throw new RuntimeException(result.optString("error"));
                callback(requestId,new JSONObject().put("ok",true).put("text",result.optString("text","")).toString());
            }catch(Exception e){
                callback(requestId,error(e));
            }
        });
    }

    @JavascriptInterface
    public void removeModel(String requestId){
        executor.execute(()->{
            try{
                synchronized(this){releaseModelLocked();}
                if(modelFile.exists()&&!modelFile.delete())throw new IOException("Model kon niet worden verwijderd");
                callback(requestId,"{\"ok\":true}");
            }catch(Exception e){callback(requestId,error(e));}
        });
    }

    @JavascriptInterface
    public void clearAssistantCache(String requestId){
        callback(requestId,"{\"ok\":true}");
    }

    private void progress(String id,int p){
        webView.post(()->webView.evaluateJavascript(
            "window.__toolsNativeLlamaProgress&&window.__toolsNativeLlamaProgress("+JSONObject.quote(id)+","+p+");",null));
    }

    private void callback(String id,String payload){
        webView.post(()->webView.evaluateJavascript(
            "window.__toolsNativeLlamaCallback&&window.__toolsNativeLlamaCallback("+JSONObject.quote(id)+","+JSONObject.quote(payload)+");",null));
    }

    private static String error(Exception e){
        try{
            return new JSONObject().put("ok",false).put("error",
                e.getMessage()==null?e.getClass().getSimpleName():e.getMessage()).toString();
        }catch(Exception ignored){return "{\"ok\":false,\"error\":\"Onbekende fout\"}";}
    }

    private static String hex(byte[] bytes){
        StringBuilder s=new StringBuilder();
        for(byte b:bytes)s.append(String.format(Locale.US,"%02x",b));
        return s.toString();
    }
}
JAVA

cat > android/app/src/main/java/nl/tools/app/WebSearchBridge.java <<'JAVA'
package nl.tools.app;

import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class WebSearchBridge {
    private final WebView webView;
    private final ExecutorService executor=Executors.newFixedThreadPool(2);

    public WebSearchBridge(WebView webView){this.webView=webView;}

    @JavascriptInterface
    public void search(String query,String requestId){
        executor.execute(()->{
            try{
                JSONObject result=runSearch(query);
                result.put("ok",true);
                callback(requestId,result.toString());
            }catch(Exception e){
                try{
                    callback(requestId,new JSONObject()
                        .put("ok",false)
                        .put("error",e.getMessage()==null?"Webzoekfout":e.getMessage())
                        .toString());
                }catch(Exception ignored){}
            }
        });
    }

    private JSONObject runSearch(String query)throws Exception{
        String searchUrl="https://html.duckduckgo.com/html/?q="+URLEncoder.encode(query,"UTF-8");
        String html=get(searchUrl,12000,900000);
        Pattern linkPattern=Pattern.compile("class=\\\"result__a\\\"[^>]*href=\\\"([^\\\"]+)\\\"",Pattern.CASE_INSENSITIVE);
        Matcher matcher=linkPattern.matcher(html);
        LinkedHashSet<String> urls=new LinkedHashSet<>();

        while(matcher.find()&&urls.size()<6){
            String u=decodeResultUrl(matcher.group(1));
            if(u.startsWith("https://")||u.startsWith("http://"))urls.add(u);
        }

        JSONArray sources=new JSONArray();
        StringBuilder context=new StringBuilder();
        for(String url:urls){
            try{
                String page=get(url,10000,700000);
                String text=cleanHtml(page);
                if(text.length()>4200)text=text.substring(0,4200);
                sources.put(url);
                context.append("BRON: ").append(url).append("\n")
                       .append(text).append("\n\n");
            }catch(Exception ignored){}
        }

        if(context.length()==0){
            context.append(cleanHtml(html).substring(0,Math.min(10000,cleanHtml(html).length())));
        }

        return new JSONObject()
            .put("context",context.toString())
            .put("sources",sources);
    }

    private static String decodeResultUrl(String raw)throws Exception{
        String s=raw.replace("&amp;","&");
        if(s.startsWith("//"))s="https:"+s;
        try{
            URL u=new URL(s);
            String q=u.getQuery();
            if(q!=null){
                for(String part:q.split("&")){
                    if(part.startsWith("uddg="))
                        return URLDecoder.decode(part.substring(5),"UTF-8");
                }
            }
        }catch(Exception ignored){}
        return s;
    }

    private static String get(String url,int timeout,int maxBytes)throws Exception{
        HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
        c.setConnectTimeout(timeout);
        c.setReadTimeout(timeout);
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("User-Agent","Mozilla/5.0 (Linux; Android) ToolsAPK/1.0");
        c.setRequestProperty("Accept-Language","nl-NL,nl;q=0.9,en;q=0.7");
        int code=c.getResponseCode();
        InputStream in=code>=400?c.getErrorStream():c.getInputStream();
        if(in==null)throw new IOException("HTTP "+code);
        ByteArrayOutputStream out=new ByteArrayOutputStream();
        byte[] buf=new byte[8192];
        int n,total=0;
        while((n=in.read(buf))>0&&total<maxBytes){
            int take=Math.min(n,maxBytes-total);
            out.write(buf,0,take);
            total+=take;
        }
        in.close();
        return out.toString(StandardCharsets.UTF_8.name());
    }

    private static String cleanHtml(String html){
        return html
            .replaceAll("(?is)<script.*?</script>"," ")
            .replaceAll("(?is)<style.*?</style>"," ")
            .replaceAll("(?is)<[^>]+>"," ")
            .replace("&nbsp;"," ")
            .replace("&amp;","&")
            .replace("&quot;","\"")
            .replace("&#39;","'")
            .replaceAll("\\s+"," ")
            .trim();
    }

    private void callback(String id,String payload){
        webView.post(()->webView.evaluateJavascript(
            "window.__toolsWebSearchCallback&&window.__toolsWebSearchCallback("+JSONObject.quote(id)+","+JSONObject.quote(payload)+");",null));
    }
}
JAVA

cat > android/app/src/main/java/nl/tools/app/MainActivity.java <<'JAVA'
package nl.tools.app;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int HIO_SCAN_REQUEST=3914;
    private boolean bridgesAttached=false;

    @Override
    protected void onCreate(Bundle savedInstanceState){
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){
            @Override public void handleOnBackPressed(){
                if(goToToolsHomeIfNeeded())return;
                finish();
            }
        });
    }

    @Override
    public void onStart(){
        super.onStart();
        attachBridges();
    }

    private boolean goToToolsHomeIfNeeded(){
        if(getBridge()==null)return false;
        WebView webView=getBridge().getWebView();
        if(webView==null)return false;
        String currentUrl=webView.getUrl();
        if(currentUrl==null||!currentUrl.toLowerCase().contains("/tools/"))return false;
        String homeUrl=getBridge().getAppUrl();
        if(homeUrl==null||homeUrl.trim().isEmpty())homeUrl="https://localhost";
        final String targetUrl=homeUrl;
        webView.post(()->{
            webView.loadUrl(targetUrl);
            webView.postDelayed(webView::clearHistory,350);
        });
        return true;
    }

    private void attachBridges(){
        if(bridgesAttached||getBridge()==null)return;
        WebView webView=getBridge().getWebView();
        if(webView==null)return;

        webView.addJavascriptInterface(new HioBridge(),"Android");
        webView.addJavascriptInterface(new LlamaBridge(this,webView),"ToolsNativeLlama");
        webView.addJavascriptInterface(new WebSearchBridge(webView),"ToolsWebSearch");
        bridgesAttached=true;
    }

    public class HioBridge {
        @JavascriptInterface
        public void startHioScan(String contextJson){
            runOnUiThread(()->{
                Intent intent=new Intent(MainActivity.this,HioScanActivity.class);
                intent.putExtra("hioContext",contextJson==null?"":contextJson);
                startActivityForResult(intent,HIO_SCAN_REQUEST);
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode,int resultCode,Intent data){
        if(requestCode==HIO_SCAN_REQUEST){
            if(resultCode==RESULT_OK&&data!=null){
                String json=data.getStringExtra("hioResult");
                if(json!=null&&getBridge()!=null&&getBridge().getWebView()!=null){
                    getBridge().getWebView().post(()->getBridge().getWebView()
                        .evaluateJavascript("window.receiveHioScanResult&&window.receiveHioScanResult("+json+");",null));
                }
            }
            return;
        }
        super.onActivityResult(requestCode,resultCode,data);
    }
}
JAVA

python3 <<'PY'
from pathlib import Path

gradle=Path('android/app/build.gradle')
s=gradle.read_text()
needle="    implementation project(':capacitor-cordova-android-plugins')"
addition=needle+"""
    implementation 'androidx.appcompat:appcompat:1.7.1'
    def camerax_version = '1.4.2'
    implementation "androidx.camera:camera-core:$camerax_version"
    implementation "androidx.camera:camera-camera2:$camerax_version"
    implementation "androidx.camera:camera-lifecycle:$camerax_version"
    implementation "androidx.camera:camera-view:$camerax_version"
    implementation 'com.google.mlkit:text-recognition:16.0.1'
    implementation 'dev.ffmpegkit-maintained:llama-android:0.1.1'"""
if 'dev.ffmpegkit-maintained:llama-android' not in s:
    if needle not in s: raise SystemExit('Capacitor dependency anchor not found')
    s=s.replace(needle,addition,1)
gradle.write_text(s)

manifest=Path('android/app/src/main/AndroidManifest.xml')
x=manifest.read_text()
manifest_start=x.find('<manifest')
if manifest_start<0: raise SystemExit('manifest root not found')
head=x.find('>',manifest_start)
for perm in ['android.permission.INTERNET','android.permission.CAMERA']:
    if perm not in x:
        x=x[:head+1]+f'\n    <uses-permission android:name="{perm}" />'+x[head+1:]
        head=x.find('>',manifest_start)
if '.HioScanActivity' not in x:
    marker='</application>'
    activity='        <activity android:name=".HioScanActivity" android:screenOrientation="portrait" android:exported="false" />\n    '
    if marker not in x: raise SystemExit('application close not found')
    x=x.replace(marker,activity+marker,1)
manifest.write_text(x)
PY

# Synchronize final web assets into Android after all web changes.
npx cap sync android

# Compile the actual Android app. Nothing is committed unless this succeeds.
cd android
./gradlew assembleDebug --stacktrace
cd ..

cat > .gitignore <<'EOF'
node_modules/
.gradle/
**/build/
.idea/
.DS_Store
android/local.properties
*.iml
EOF

mkdir -p .github/workflows
cat > .github/workflows/pages.yml <<'YAML'
name: Deploy GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Pages artifact
        run: |
          rm -rf _site
          mkdir -p _site
          cp index.html _site/index.html
          cp sw.js _site/sw.js
          cp -R tools _site/tools
          cp -R shared _site/shared
          touch _site/.nojekyll
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
YAML

rm -rf node_modules .gradle android/.gradle
rm -rf android/app/build android/build
rm -f .github/workflows/bootstrap.yml .github/scripts/build-android.sh

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add -A
git commit -m 'Build complete ToolsAPK project'
git push origin HEAD:main
