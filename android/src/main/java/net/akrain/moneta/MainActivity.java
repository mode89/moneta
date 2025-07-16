package net.akrain.moneta;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

import android.content.Intent;
import android.net.Uri;
import android.content.ContentResolver;

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
        webView.addJavascriptInterface(
            new JavaScriptInterface(this), "Android");

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

    private static final int CREATE_FILE = 1;
    private String fileContent = "";

    @Override
    protected void onActivityResult(
            int requestCode,
            int resultCode,
            Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == CREATE_FILE && resultCode == RESULT_OK) {
            if (data != null) {
                Uri uri = data.getData();
                if (uri != null) {
                    try {
                        ContentResolver cr = getContentResolver();
                        OutputStream os = cr.openOutputStream(uri);
                        os.write(fileContent.getBytes());
                        os.close();
                        Log.i("MonetaWebView",
                            "File saved to: " + uri.toString());
                    } catch (IOException e) {
                        Log.e("MonetaWebView", "File save failed", e);
                    }
                }
            }
        }
    }

    public class JavaScriptInterface {
        Activity activity;

        JavaScriptInterface(Activity activity) {
            this.activity = activity;
        }

        @android.webkit.JavascriptInterface
        public void createFile(String fileName, String content) {
            fileContent = content;
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/json");
            intent.putExtra(Intent.EXTRA_TITLE, fileName);
            activity.startActivityForResult(intent, CREATE_FILE);
        }
    }
}
