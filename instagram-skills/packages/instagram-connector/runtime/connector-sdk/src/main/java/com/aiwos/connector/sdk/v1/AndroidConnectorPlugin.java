package com.aiwos.connector.sdk.v1;

/**
 * Stable ABI implemented by first-party Android Connector bundles.
 *
 * <p>The Connector never receives an Android Context, AccessibilityService,
 * credential store, Binder object, or file path. All device interaction must
 * go through the capability-scoped {@link MobileRuntime} supplied by Worker.</p>
 */
public interface AndroidConnectorPlugin {
    /** Static metadata; must agree with the signed bundle manifest. */
    ConnectorDescriptor descriptor();

    /** Cheap compatibility check performed before a version becomes active. */
    ProbeResult probe(MobileRuntime runtime, ProbeRequest request);

    /** Executes one Host Job action. Implementations must return after cancellation. */
    ConnectorResult execute(MobileRuntime runtime, ConnectorExecutionRequest request);

    /** Releases Connector-owned memory before the isolated process unloads it. */
    void shutdown();
}
