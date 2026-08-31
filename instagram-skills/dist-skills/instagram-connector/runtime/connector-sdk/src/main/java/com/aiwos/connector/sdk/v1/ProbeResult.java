package com.aiwos.connector.sdk.v1;

import java.util.Objects;

public final class ProbeResult {
    private final boolean compatible;
    private final String code;
    private final String detail;

    private ProbeResult(boolean compatible, String code, String detail) {
        this.compatible = compatible;
        this.code = Objects.requireNonNull(code, "code");
        this.detail = Objects.requireNonNull(detail, "detail");
    }

    public static ProbeResult compatible() { return new ProbeResult(true, "OK", ""); }
    public static ProbeResult incompatible(String code, String detail) {
        return new ProbeResult(false, code, detail);
    }

    public boolean isCompatible() { return compatible; }
    public String code() { return code; }
    public String detail() { return detail; }
}
