package com.example.helloandroid;

import android.app.Activity;
import android.os.Bundle;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.view.ViewGroup;

public class MainActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Create a LinearLayout to hold the UI components
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setLayoutParams(
            new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        // Create a TextView
        TextView textView = new TextView(this);
        textView.setText("Hello, Mode!");
        textView.setTextSize(30); // Set text size in pixels

        // Add the TextView to the LinearLayout
        layout.addView(textView);

        // Set the LinearLayout as the content view for the activity
        setContentView(layout);
    }
}
