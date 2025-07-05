package net.akrain.moneta;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;

public class MainActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Remove title bar
        requestWindowFeature(android.view.Window.FEATURE_NO_TITLE);

        // Create a WebView programmatically
        WebView webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setAllowUniversalAccessFromFileURLs(true);

        // Load HTML content
        webView.loadUrl("file:///android_asset/index.html");

        // Set a WebChromeClient to handle console messages
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                String message =
                    consoleMessage.sourceId() + ":" +
                    consoleMessage.lineNumber() + " " +
                    consoleMessage.message();
                String tag = "MonetaWebView";
                switch (consoleMessage.messageLevel()) {
                    case DEBUG:
                        Log.d(tag, message);
                        break;
                    case ERROR:
                        Log.e(tag, message);
                        break;
                    case LOG:
                        Log.i(tag, message);
                        break;
                    case TIP:
                        Log.w(tag, message);
                        break;
                    case WARNING:
                        Log.w(tag, message);
                        break;
                }
                return true;
            }
        });

        // Set the WebView as the content view for the activity
        setContentView(webView);
    }
}
