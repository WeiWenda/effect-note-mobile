package com.effectnote.mobile;

import static android.util.Log.i;

import android.util.Log;

import java.io.FileInputStream;
import java.io.IOException;

import fi.iki.elonen.NanoHTTPD;

public class NanoHttp extends NanoHTTPD {

    private String workspaceDir;

    public NanoHttp(String workspaceDir) throws IOException {
        super(51223);
        this.workspaceDir = workspaceDir;
        start(NanoHTTPD.SOCKET_READ_TIMEOUT, true);
        Log.i("NanoHttp", "Running! Point your browsers to http://localhost:51223/");
    }

    @Override
    public Response serve(IHTTPSession session) {
        String uri = session.getUri();
        try {
            Log.i("NanoHttp", String.format("serving %s", uri));
            return NanoHTTPD.newChunkedResponse(
                    Response.Status.OK,
                    "image/png",
                    new FileInputStream(workspaceDir + uri)
            );
        } catch (Exception e) {
            String message = String.format("Failed to load asset %s because %s", uri, e.getMessage());
            Log.e("NanoHttp", message, e);
            return NanoHTTPD.newFixedLengthResponse(message);
        }
    }
}
