package com.aiwos.connector.sdk.v1;

import java.util.Objects;

public final class ConnectorResult {
    public enum Status { SUCCEEDED, FAILED, CANCELLED, RETRYABLE }

    private final Status status;
    private final String code;
    private final String outputJson;
    private final String detail;

    private ConnectorResult(Status status, String code, String outputJson, String detail) {
        this.status = Objects.requireNonNull(status, "status");
        this.code = Objects.requireNonNull(code, "code");
        this.outputJson = Objects.requireNonNull(outputJson, "outputJson");
        this.detail = Objects.requireNonNull(detail, "detail");
    }

    public static ConnectorResult succeeded(String outputJson) {
        return new ConnectorResult(Status.SUCCEEDED, "OK", outputJson, "");
    }

    public static ConnectorResult failed(String code, String detail) {
        return new ConnectorResult(Status.FAILED, code, "{}", detail);
    }

    public static ConnectorResult cancelled(String detail) {
        return new ConnectorResult(Status.CANCELLED, "CANCELLED", "{}", detail);
    }

    public static ConnectorResult retryable(String code, String detail) {
        return new ConnectorResult(Status.RETRYABLE, code, "{}", detail);
    }

    public Status status() { return status; }
    public String code() { return code; }
    public String outputJson() { return outputJson; }
    public String detail() { return detail; }
}
