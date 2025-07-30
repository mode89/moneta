package net.akrain.moneta;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;

import java.io.IOException;
import java.io.OutputStream;

import android.content.Intent;
import android.net.Uri;
import android.content.ContentResolver;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.Base64;

public class MainActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Remove title bar
        requestWindowFeature(android.view.Window.FEATURE_NO_TITLE);

        // Create a WebView programmatically
        webView = new WebView(this);
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

        webView.post(() -> {
            webView.evaluateJavascript(
                """
                Android.___pickFileRequests = {};

                Android.pickFile = function(callback) {
                    const uuid = crypto.randomUUID();
                    Android.___pickFileRequests[uuid] = callback;
                    Android.___pickFile(uuid);
                };

                Android.___pickFileResult = function(uuid, base64Content) {
                    const callback = Android.___pickFileRequests[uuid];
                    if (callback) {
                        delete Android.___pickFileRequests[uuid];
                        if (base64Content) {
                            const content = atob(base64Content);
                            callback(content);
                        } else {
                            callback(null); // Indicate failure
                        }
                    }
                };
                """,
                null
            );
        });

    }

    private static final int CREATE_FILE = 1;
    private static final int PICK_FILE = 2;
    private String fileContent = "";
    private String pickFileRequestId = null;
    private WebView webView;

    @Override
    protected void onActivityResult(
            int requestCode,
            int resultCode,
            Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode == RESULT_OK && data != null) {
            Uri uri = data.getData();
            if (uri != null) {
                if (requestCode == CREATE_FILE) {
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
                } else if (requestCode == PICK_FILE) {
                    try {
                        ContentResolver cr = getContentResolver();
                        InputStream is = cr.openInputStream(uri);
                        BufferedReader reader = new BufferedReader(
                            new InputStreamReader(is));
                        StringBuilder stringBuilder = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) {
                            stringBuilder.append(line);
                        }
                        is.close();
                        Log.i("MonetaWebView",
                            "File read successfully: " + uri.toString());

                        if (pickFileRequestId != null) {
                            String requestId = pickFileRequestId;
                            String encodedContent =
                                Base64.getEncoder().encodeToString(
                                    stringBuilder.toString().getBytes());
                            webView.post(() -> webView.evaluateJavascript(
                                "Android.___pickFileResult('" +
                                requestId + "', '" + encodedContent + "')",
                                null));
                        } else {
                            Log.w("MonetaWebView",
                            "No pickFileRequestId to return file content");
                        }
                    } catch (IOException e) {
                        Log.e("MonetaWebView", "File read failed", e);
                        if (pickFileRequestId != null) {
                            String requestId = pickFileRequestId;
                            webView.post(() -> webView.evaluateJavascript(
                                "Android.___pickFileResult('" +
                                requestId + "', null)",
                                null));
                        }
                    }
                    pickFileRequestId = null;
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

        @android.webkit.JavascriptInterface
        public void ___pickFile(String uuid) {
            pickFileRequestId = uuid;
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/json");
            activity.startActivityForResult(intent, PICK_FILE);
        }
    }
}
