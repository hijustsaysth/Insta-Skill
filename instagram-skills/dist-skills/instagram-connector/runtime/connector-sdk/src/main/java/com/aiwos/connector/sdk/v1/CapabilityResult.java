package com.aiwos.connector.sdk.v1;

import java.util.Objects;

public final class CapabilityResult {
    private final boolean ok;
    private final String code;
    private final String payloadJson;
    private final String detail;

    private CapabilityResult(boolean ok, String code, String payloadJson, String detail) {
        this.ok = ok;
        this.code = Objects.requireNonNull(code, "code");
        this.payloadJson = Objects.requireNonNull(payloadJson, "payloadJson");
        this.detail = Objects.requireNonNull(detail, "detail");
    }

    public static CapabilityResult ok(String payloadJson) {
        return new CapabilityResult(true, "OK", payloadJson, "");
    }

    public static CapabilityResult error(String code, String detail) {
        return new CapabilityResult(false, code, "{}", detail);
    }

    public boolean isOk() { return ok; }
    public String code() { return code; }
    public String payloadJson() { return payloadJson; }
    public String detail() { return detail; }
}
