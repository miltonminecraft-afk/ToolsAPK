package nl.tools.app;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int HIO_SCAN_REQUEST = 3914;
    private boolean bridgesAttached = false;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { if (goToToolsHomeIfNeeded()) return; finish(); }
        });
    }

    @Override public void onStart() { super.onStart(); attachBridges(); }

    private boolean goToToolsHomeIfNeeded() {
        if (getBridge()==null) return false;
        WebView webView=getBridge().getWebView(); if(webView==null)return false;
        String currentUrl=webView.getUrl();
        if(currentUrl==null || !currentUrl.toLowerCase().contains("/tools/")) return false;
        String homeUrl=getBridge().getAppUrl(); if(homeUrl==null||homeUrl.trim().isEmpty())homeUrl="https://localhost";
        final String targetUrl=homeUrl;
        webView.post(()->{webView.loadUrl(targetUrl);webView.postDelayed(webView::clearHistory,350);});
        return true;
    }

    private void attachBridges() {
        if (bridgesAttached || getBridge()==null) return;
        WebView webView=getBridge().getWebView(); if(webView==null)return;
        webView.addJavascriptInterface(new HioBridge(),"Android");
        webView.addJavascriptInterface(new LlamaBridge(this,webView),"ToolsNativeLlama");
        bridgesAttached=true;
    }

    public class HioBridge {
        @JavascriptInterface public void startHioScan(String contextJson) {
            runOnUiThread(()->{Intent intent=new Intent(MainActivity.this,HioScanActivity.class);intent.putExtra("hioContext",contextJson==null?"":contextJson);startActivityForResult(intent,HIO_SCAN_REQUEST);});
        }
    }

    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        if(requestCode==HIO_SCAN_REQUEST){
            if(resultCode==RESULT_OK&&data!=null){String json=data.getStringExtra("hioResult");if(json!=null&&getBridge()!=null&&getBridge().getWebView()!=null)getBridge().getWebView().post(()->getBridge().getWebView().evaluateJavascript("window.receiveHioScanResult&&window.receiveHioScanResult("+json+");",null));}
            return;
        }
        super.onActivityResult(requestCode,resultCode,data);
    }
}
