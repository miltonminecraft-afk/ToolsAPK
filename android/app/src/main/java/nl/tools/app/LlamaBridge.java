package nl.tools.app;

import android.app.Activity;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class LlamaBridge {
    private final Activity activity; private final WebView webView; private final ExecutorService executor=Executors.newSingleThreadExecutor();
    private final File modelDir; private final File modelFile;
    public LlamaBridge(Activity activity, WebView webView){this.activity=activity;this.webView=webView;modelDir=new File(activity.getFilesDir(),"ai/models");modelFile=new File(modelDir,"assistant-qwen3-1.7b-q4_k_m.gguf");}

    @JavascriptInterface public String getRuntimeInfo(){try{return new JSONObject().put("engine","llama.cpp").put("modelPath",modelFile.getAbsolutePath()).put("installed",modelFile.isFile()).toString();}catch(Exception e){return "{}";}}
    @JavascriptInterface public boolean isModelInstalled(){return modelFile.isFile()&&modelFile.length()>100_000_000L;}

    @JavascriptInterface public void downloadModel(String url,String expectedSha256,String requestId){executor.execute(()->{
        File tmp=new File(modelDir,modelFile.getName()+".part");
        try{if(!modelDir.exists()&&!modelDir.mkdirs())throw new IOException("Modelmap kon niet worden gemaakt");
            HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();c.setInstanceFollowRedirects(true);c.setConnectTimeout(20000);c.setReadTimeout(60000);c.setRequestProperty("User-Agent","ToolsAPK/1.0");c.connect();
            if(c.getResponseCode()<200||c.getResponseCode()>=300)throw new IOException("Download HTTP "+c.getResponseCode());
            long total=c.getContentLengthLong(),done=0;MessageDigest digest=MessageDigest.getInstance("SHA-256");byte[] buf=new byte[1024*1024];
            try(InputStream in=new BufferedInputStream(c.getInputStream());OutputStream out=new BufferedOutputStream(new FileOutputStream(tmp))){int n;int last=-1;while((n=in.read(buf))>0){out.write(buf,0,n);digest.update(buf,0,n);done+=n;if(total>0){int p=(int)(done*100/total);if(p!=last){last=p;progress(requestId,p);}}}}
            String sha=hex(digest.digest());if(expectedSha256!=null&&!expectedSha256.isEmpty()&&!sha.equalsIgnoreCase(expectedSha256))throw new IOException("SHA-256 controle mislukt");
            if(modelFile.exists()&&!modelFile.delete())throw new IOException("Oud model kon niet worden vervangen");if(!tmp.renameTo(modelFile))throw new IOException("Model kon niet worden geplaatst");
            callback(requestId,new JSONObject().put("ok",true).put("bytes",modelFile.length()).toString());
        }catch(Exception e){tmp.delete();callback(requestId,error(e));}
    });}

    @JavascriptInterface public void generate(String requestJson,String requestId){executor.execute(()->{
        try{if(!isModelInstalled())throw new IllegalStateException("AI-model is niet geïnstalleerd");JSONObject req=new JSONObject(requestJson);JSONArray a=req.getJSONArray("messages");String[] roles=new String[a.length()],contents=new String[a.length()];for(int i=0;i<a.length();i++){JSONObject m=a.getJSONObject(i);roles[i]=m.optString("role","user");contents[i]=m.optString("content","");}
            String text=NativeLlama.generate(modelFile.getAbsolutePath(),roles,contents,req.optInt("max_tokens",420),(float)req.optDouble("temperature",0.35));if(text!=null&&text.startsWith("__ERROR__:"))throw new RuntimeException(text.substring(10));
            callback(requestId,new JSONObject().put("ok",true).put("text",text==null?"":text).toString());
        }catch(Exception e){callback(requestId,error(e));}
    });}

    @JavascriptInterface public void removeModel(String requestId){executor.execute(()->{try{NativeLlama.unloadModel();if(modelFile.exists()&&!modelFile.delete())throw new IOException("Model kon niet worden verwijderd");callback(requestId,new JSONObject().put("ok",true).toString());}catch(Exception e){callback(requestId,error(e));}});}
    @JavascriptInterface public void clearAssistantCache(String requestId){callback(requestId,"{\"ok\":true}");}

    private void progress(String id,int p){webView.post(()->webView.evaluateJavascript("window.__toolsNativeLlamaProgress&&window.__toolsNativeLlamaProgress("+JSONObject.quote(id)+","+p+");",null));}
    private void callback(String id,String payload){webView.post(()->webView.evaluateJavascript("window.__toolsNativeLlamaCallback&&window.__toolsNativeLlamaCallback("+JSONObject.quote(id)+","+JSONObject.quote(payload)+");",null));}
    private static String error(Exception e){try{return new JSONObject().put("ok",false).put("error",e.getMessage()==null?e.getClass().getSimpleName():e.getMessage()).toString();}catch(Exception ignored){return "{\"ok\":false,\"error\":\"Onbekende fout\"}";}}
    private static String hex(byte[] bytes){StringBuilder s=new StringBuilder();for(byte b:bytes)s.append(String.format(Locale.US,"%02x",b));return s.toString();}
}
