package com.aiwos.connector.sdk.v1;

import java.util.Collections;
import java.util.List;
import java.util.Objects;

public final class ConnectorDescriptor {
    private final String connectorId;
    private final String version;
    private final int pluginApiVersion;
    private final List<String> actions;
    private final List<String> requiredCapabilities;

    public ConnectorDescriptor(
            String connectorId,
            String version,
            int pluginApiVersion,
            List<String> actions,
            List<String> requiredCapabilities) {
        this.connectorId = Objects.requireNonNull(connectorId, "connectorId");
        this.version = Objects.requireNonNull(version, "version");
        this.pluginApiVersion = pluginApiVersion;
        this.actions = immutableCopy(actions);
        this.requiredCapabilities = immutableCopy(requiredCapabilities);
    }

    public String connectorId() { return connectorId; }
    public String version() { return version; }
    public int pluginApiVersion() { return pluginApiVersion; }
    public List<String> actions() { return actions; }
    public List<String> requiredCapabilities() { return requiredCapabilities; }

    private static List<String> immutableCopy(List<String> value) {
        return Collections.unmodifiableList(List.copyOf(Objects.requireNonNull(value, "value")));
    }
}
