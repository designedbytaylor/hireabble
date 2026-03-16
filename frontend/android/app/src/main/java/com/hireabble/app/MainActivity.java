package com.hireabble.app;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private GooglePlayBillingPlugin billingPlugin;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Register the Google Play Billing JS interface on the WebView
        // so the web layer can call window.Android.purchase() etc.
        getBridge().getWebView().post(() -> {
            WebView webView = getBridge().getWebView();
            billingPlugin = new GooglePlayBillingPlugin(this, webView);
            webView.addJavascriptInterface(billingPlugin, "Android");
        });
    }

    @Override
    protected void onDestroy() {
        if (billingPlugin != null) {
            billingPlugin.destroy();
        }
        super.onDestroy();
    }
}
