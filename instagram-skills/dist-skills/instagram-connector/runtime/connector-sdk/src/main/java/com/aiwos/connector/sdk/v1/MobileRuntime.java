package com.aiwos.connector.sdk.v1;

/**
 * Capability broker exposed by Worker. Request/response bodies use canonical JSON
 * so that the ABI can evolve without exposing Android framework objects.
 */
public interface MobileRuntime {
    /**
     * 输入：无。
     * 输出：是否支持一次 query 传入多个 selectors。
     * 作用：在保持 Plugin API v1 和旧运行时兼容的前提下显式协商批量查询。
     */
    default boolean supportsBatchQuery() {
        return false;
    }

    CapabilityResult openApp(String requestJson);
    CapabilityResult snapshot(String requestJson);
    CapabilityResult query(String requestJson);
    CapabilityResult click(String requestJson);
    CapabilityResult input(String requestJson);
    CapabilityResult submit(String requestJson);
    CapabilityResult scroll(String requestJson);
    CapabilityResult waitFor(String requestJson);
    CapabilityResult capture(String requestJson);
    CapabilityResult ocr(String requestJson);
    CapabilityResult checkpoint(String requestJson);
    boolean isCancelled();
}
