package com.effectnote.mobile;

import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Environment;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.IOException;

public class MainActivity extends BridgeActivity {

    private String getAppRootDir() {
        String iconsStoragePath = getBaseContext().getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS) + "/EffectNote";
        File sdIconStorageDir = new File(iconsStoragePath);
        if(!sdIconStorageDir.exists()){
            sdIconStorageDir.mkdirs();
        }
        return sdIconStorageDir.getAbsolutePath();
    }
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        try {
            NanoHttp nanoHttp = new NanoHttp(getAppRootDir());
        } catch (IOException e) {
            Log.e("NanoHttp", "start http sever failed", e);
        }
        registerPlugin(GitOperationPlugin.class);
        super.onCreate(savedInstanceState);
        if (ContextCompat.checkSelfPermission(MainActivity.this, android.Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED)
        {   ActivityCompat.requestPermissions(MainActivity.this, new String[]{android.Manifest.permission.CAMERA}, 1);
        }
        if (ContextCompat.checkSelfPermission(MainActivity.this, android.Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED)
        {   ActivityCompat.requestPermissions(MainActivity.this, new String[]{android.Manifest.permission.WRITE_EXTERNAL_STORAGE}, 2);
        }
    }
}
