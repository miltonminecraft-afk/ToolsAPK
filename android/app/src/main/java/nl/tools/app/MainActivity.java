package nl.tools.app;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private static final int HIO_SCAN_REQUEST = 3914;
    private boolean bridgesAttached = false;
    private boolean returningHome = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getBridge() != null) {
            getBridge().addWebViewListener(new WebViewListener() {
                @Override
                public void onPageLoaded(WebView view) {
                    if (returningHome && HomeNavigation.isLandingPage(
                            view.getUrl(), getBridge().getAppUrl())) {
                        returningHome = false;
                        view.clearHistory();
                    }
                }

                @Override
                public void onReceivedError(WebView view) {
                    returningHome = false;
                }

                @Override
                public void onReceivedHttpError(WebView view) {
                    returningHome = false;
                }
            });
        }
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleToolsBack();
            }
        });
    }

    @Override
    public void onStart() {
        super.onStart();
        attachBridges();
    }

    private void handleToolsBack() {
        // Unknown or still-loading pages must never be treated as the landing page.
        if (getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView == null || returningHome) return;
        String appUrl = getBridge().getAppUrl();
        if (webView.getProgress() == 100
                && HomeNavigation.isLandingPage(webView.getUrl(), appUrl)) {
            finish();
            return;
        }
        returningHome = true;
        webView.loadUrl(HomeNavigation.landingUrl(appUrl));
    }

    private void attachBridges() {
        if (bridgesAttached || getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView == null) return;
        webView.addJavascriptInterface(new HioBridge(), "Android");
        if (NativeLlama.isAvailable()) {
            webView.addJavascriptInterface(new LlamaBridge(this, webView), "ToolsNativeLlama");
        }
        bridgesAttached = true;
    }

    public class HioBridge {
        @JavascriptInterface
        public void startHioScan(String contextJson) {
            runOnUiThread(() -> {
                Intent intent = new Intent(MainActivity.this, HioScanActivity.class);
                intent.putExtra("hioContext", contextJson == null ? "" : contextJson);
                startActivityForResult(intent, HIO_SCAN_REQUEST);
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == HIO_SCAN_REQUEST) {
            if (resultCode == RESULT_OK && data != null) {
                String json = data.getStringExtra("hioResult");
                if (json != null && getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript("window.receiveHioScanResult&&window.receiveHioScanResult(" + json + ");", null));
                }
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }
}
