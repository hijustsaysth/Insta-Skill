package com.aiwos.connector.sdk.v1;

import java.util.Objects;

public final class ProbeRequest {
    private final String workerVersion;
    private final int pluginApiVersion;
    private final String deviceProfileJson;

    public ProbeRequest(String workerVersion, int pluginApiVersion, String deviceProfileJson) {
        this.workerVersion = Objects.requireNonNull(workerVersion, "workerVersion");
        this.pluginApiVersion = pluginApiVersion;
        this.deviceProfileJson = Objects.requireNonNull(deviceProfileJson, "deviceProfileJson");
    }

    public String workerVersion() { return workerVersion; }
    public int pluginApiVersion() { return pluginApiVersion; }
    public String deviceProfileJson() { return deviceProfileJson; }
}
