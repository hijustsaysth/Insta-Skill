package com.aiwos.connector.sdk.v1;

import java.util.Objects;

public final class ConnectorExecutionRequest {
    private final String jobId;
    private final String action;
    private final String inputJson;
    private final String checkpointJson;
    private final long deadlineEpochMillis;

    public ConnectorExecutionRequest(
            String jobId,
            String action,
            String inputJson,
            String checkpointJson,
            long deadlineEpochMillis) {
        this.jobId = Objects.requireNonNull(jobId, "jobId");
        this.action = Objects.requireNonNull(action, "action");
        this.inputJson = Objects.requireNonNull(inputJson, "inputJson");
        this.checkpointJson = checkpointJson == null ? "" : checkpointJson;
        this.deadlineEpochMillis = deadlineEpochMillis;
    }

    public String jobId() { return jobId; }
    public String action() { return action; }
    public String inputJson() { return inputJson; }
    public String checkpointJson() { return checkpointJson; }
    public long deadlineEpochMillis() { return deadlineEpochMillis; }
}
