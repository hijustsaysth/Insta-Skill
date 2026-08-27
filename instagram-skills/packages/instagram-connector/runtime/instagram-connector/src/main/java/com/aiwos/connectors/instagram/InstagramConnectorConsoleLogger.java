package com.aiwos.connectors.instagram;

import com.aiwos.connector.sdk.v1.CapabilityResult;
import com.aiwos.connector.sdk.v1.ConnectorResult;
import com.aiwos.connector.sdk.v1.MobileRuntime;
import java.io.PrintStream;
import java.time.Instant;
import java.util.Locale;
import java.util.Objects;

/**
 * A small execution interceptor for connector diagnostics.
 */
public final class InstagramConnectorConsoleLogger {
    private static final int MAX_JSON_CHARS = 900;

    private final boolean enabled;
    private final String jobId;
    private final PrintStream stream;

    private InstagramConnectorConsoleLogger(boolean enabled, String jobId, PrintStream stream) {
        this.enabled = enabled;
        this.jobId = jobId == null || jobId.isBlank() ? "-" : jobId;
        this.stream = Objects.requireNonNull(stream, "stream");
    }

    public static InstagramConnectorConsoleLogger fromSettings(String jobId) {
        return new InstagramConnectorConsoleLogger(enabledBySettings(), jobId, System.err);
    }

    public MobileRuntime wrap(MobileRuntime runtime) {
        if (!enabled || runtime instanceof LoggingMobileRuntime) return runtime;
        return new LoggingMobileRuntime(runtime);
    }

    public void connectorStart(String action, String inputJson, long deadlineEpochMillis) {
        if (!enabled) return;
        log("connector.start",
                "action=" + value(action),
                "deadlineEpochMillis=" + deadlineEpochMillis,
                "input=" + summarizeJson(inputJson));
    }

    public void connectorEnd(ConnectorResult result, long durationMs) {
        if (!enabled) return;
        log("connector.end",
                "status=" + result.status().name(),
                "code=" + value(result.code()),
                "durationMs=" + durationMs,
                "detail=" + value(result.detail()),
                "output=" + summarizeJson(result.outputJson()));
    }

    private CapabilityResult capability(String capability, String requestJson, CapabilityCall call) {
        long startedAt = System.currentTimeMillis();
        log("runtime.start", "capability=" + capability, "input=" + summarizeJson(requestJson));
        try {
            CapabilityResult result = call.call();
            log("runtime.end",
                    "capability=" + capability,
                    "ok=" + result.isOk(),
                    "code=" + value(result.code()),
                    "durationMs=" + (System.currentTimeMillis() - startedAt),
                    "detail=" + value(result.detail()),
                    "output=" + summarizeJson(result.payloadJson()));
            return result;
        } catch (RuntimeException error) {
            log("runtime.error",
                    "capability=" + capability,
                    "durationMs=" + (System.currentTimeMillis() - startedAt),
                    "error=" + value(error.getClass().getSimpleName()),
                    "message=" + value(error.getMessage()));
            throw error;
        }
    }

    private void log(String event, String... fields) {
        StringBuilder line = new StringBuilder()
                .append("[instagram-connector] ")
                .append("ts=").append(Instant.now())
                .append(" jobId=").append(value(jobId))
                .append(" event=").append(event);
        for (String field : fields) {
            line.append(' ').append(field);
        }
        stream.println(line);
    }

    private static boolean enabledBySettings() {
        String value = firstNonBlank(
                System.getProperty("instagram.connector.consoleLog"),
                System.getenv("INSTAGRAM_CONNECTOR_CONSOLE_LOG"));
        if (value == null) return true;
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return !("0".equals(normalized)
                || "false".equals(normalized)
                || "no".equals(normalized)
                || "off".equals(normalized));
    }

    private static String summarizeJson(String json) {
        if (json == null || json.isBlank()) return "{}";
        String summary = redact(json)
                .replace("\r", "\\r")
                .replace("\n", "\\n")
                .replace("\t", "\\t");
        if (summary.length() > MAX_JSON_CHARS) {
            summary = summary.substring(0, MAX_JSON_CHARS) + "...<truncated:" + summary.length() + ">";
        }
        return value(summary);
    }

    private static String redact(String text) {
        return text.replaceAll(
                "(?i)(\"(?:password|passcode|token|cookie|sessionid|authorization|accessToken|refreshToken|apiKey|secret)\"\\s*:\\s*\")[^\"]*(\")",
                "$1<redacted>$2");
    }

    private static String value(String value) {
        if (value == null || value.isBlank()) return "\"\"";
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    private static String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) return first;
        if (second != null && !second.isBlank()) return second;
        return null;
    }

    private interface CapabilityCall {
        CapabilityResult call();
    }

    private final class LoggingMobileRuntime implements MobileRuntime {
        private final MobileRuntime delegate;

        private LoggingMobileRuntime(MobileRuntime delegate) {
            this.delegate = Objects.requireNonNull(delegate, "delegate");
        }

        @Override
        public CapabilityResult openApp(String requestJson) {
            return capability("openApp", requestJson, () -> delegate.openApp(requestJson));
        }

        @Override
        public CapabilityResult snapshot(String requestJson) {
            return capability("snapshot", requestJson, () -> delegate.snapshot(requestJson));
        }

        @Override
        public CapabilityResult query(String requestJson) {
            return capability("query", requestJson, () -> delegate.query(requestJson));
        }

        @Override
        public CapabilityResult click(String requestJson) {
            return capability("click", requestJson, () -> delegate.click(requestJson));
        }

        @Override
        public CapabilityResult input(String requestJson) {
            return capability("input", requestJson, () -> delegate.input(requestJson));
        }

        @Override
        public CapabilityResult submit(String requestJson) {
            return capability("submit", requestJson, () -> delegate.submit(requestJson));
        }

        @Override
        public CapabilityResult scroll(String requestJson) {
            return capability("scroll", requestJson, () -> delegate.scroll(requestJson));
        }

        @Override
        public CapabilityResult waitFor(String requestJson) {
            return capability("waitFor", requestJson, () -> delegate.waitFor(requestJson));
        }

        @Override
        public CapabilityResult capture(String requestJson) {
            return capability("capture", requestJson, () -> delegate.capture(requestJson));
        }

        @Override
        public CapabilityResult ocr(String requestJson) {
            return capability("ocr", requestJson, () -> delegate.ocr(requestJson));
        }

        @Override
        public CapabilityResult checkpoint(String requestJson) {
            return capability("checkpoint", requestJson, () -> delegate.checkpoint(requestJson));
        }

        @Override
        public boolean isCancelled() {
            return delegate.isCancelled();
        }
    }
}
