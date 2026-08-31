package com.aiwos.connectors.instagram;

import com.aiwos.connector.sdk.v1.ConnectorExecutionRequest;
import com.aiwos.connector.sdk.v1.ConnectorResult;
import com.aiwos.runtime.local.LocalAdbMobileRuntime;
import com.aiwos.runtime.local.LocalMobileRuntimeConfig;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import org.json.JSONObject;

public final class InstagramLocalRuntimeCommand {
    private static final String CONNECTOR_ID = "instagram.mobile.growth.v1";
    private static final String PACKAGE_NAME = "com.instagram.android";
    private static final String DEFAULT_ADB_KEYBOARD_IME = "com.android.adbkeyboard/.AdbIME";
    private static final String DEFAULT_ADB_KEYBOARD_INPUT_ACTION = "ADB_INPUT_B64";
    private static final long ENGAGE_WORKFLOW_DEADLINE_MARGIN_MS = 180_000L;

    /**
     * 输入：Gradle JavaExec 传入的系统属性。
     * 输出：stdout JSON。
     * 作用：作为本地 CLI 调用 Instagram Connector 的命令行入口。
     */
    public static void main(String[] args) throws Exception {
        try {
            JSONObject result = new InstagramLocalRuntimeCommand().run();
            System.out.println(result);
        } catch (Exception error) {
            System.out.println(errorResult("LOCAL_RUNTIME_COMMAND_FAILED", error.getMessage()));
        }
    }

    /**
     * 输入：系统属性中的 connectorId、action、inputJson、adbPath 和 serial。
     * 输出：CLI 可解析的 ConnectorResult JSON。
     * 作用：把命令行调用转换为 InstagramConnector.execute 调用。
     */
    private JSONObject run() throws Exception {
        String connectorId = setting("instagram.local.connectorId", "INSTAGRAM_CONNECTOR_ID", CONNECTOR_ID);
        String action = property("instagram.local.action", "");
        String inputJson = inputJson();
        long deadlineMs = longSetting("instagram.local.deadlineMs", "INSTAGRAM_CONNECTOR_DEADLINE_MS", 30_000L);
        long effectiveDeadlineMs = effectiveDeadlineMs(action, inputJson, deadlineMs);
        if (!CONNECTOR_ID.equals(connectorId)) {
            return failed("CONNECTOR_ID_MISMATCH", "connectorId=" + connectorId);
        }
        if ("connector.load".equals(action)) {
            return succeeded(new JSONObject()
                    .put("connectorId", CONNECTOR_ID)
                    .put("loaded", true)
                    .put("entryClass", InstagramConnector.class.getName()));
        }
        if (action.isBlank()) {
            return failed("ACTION_REQUIRED", "instagram.local.action is required");
        }

        LocalAdbMobileRuntime runtime = new LocalAdbMobileRuntime(config());
        ConnectorResult result = new InstagramConnector().execute(
                runtime,
                new ConnectorExecutionRequest(
                        "local-runtime-" + System.currentTimeMillis(),
                        action,
                        inputJson,
                        "",
                        System.currentTimeMillis() + effectiveDeadlineMs));
        return connectorResult(result);
    }

    /**
     * 输入：action、业务 JSON 和默认 deadline。
     * 输出：实际传给 connector 的 deadline。
     * 作用：让连续观看 workflow 的输入总时长不会被 30 秒默认 Host deadline 提前截断。
     */
    private long effectiveDeadlineMs(String action, String inputJson, long defaultDeadlineMs) throws Exception {
        if (!"instagram.reels.engage_workflow".equals(action)) return defaultDeadlineMs;

        long totalWatchMs = new JSONObject(inputJson).optLong("totalWatchMs", 0L);
        if (totalWatchMs <= 0L) return defaultDeadlineMs;

        return Math.max(defaultDeadlineMs, totalWatchMs + ENGAGE_WORKFLOW_DEADLINE_MARGIN_MS);
    }

    /**
     * 输入：无。
     * 输出：本地 Runtime 配置。
     * 作用：从系统属性和环境变量组装 ADB Runtime 所需配置。
     */
    private LocalMobileRuntimeConfig config() {
        String adbPath = setting("instagram.local.adbPath", "INSTAGRAM_CONNECTOR_ADB_PATH", defaultAdbPath());
        String serial = setting("instagram.local.serial", "INSTAGRAM_CONNECTOR_ADB_SERIAL", env("INSTAGRAM_ADB_SERIAL", ""));
        String artifactDir = setting(
                "instagram.local.artifactDir",
                "INSTAGRAM_CONNECTOR_ARTIFACT_DIR",
                new File("docs/Instagram/test-runs/artifacts").getAbsolutePath());
        return new LocalMobileRuntimeConfig(
                adbPath,
                serial,
                PACKAGE_NAME,
                longSetting("instagram.local.commandTimeoutMs", "INSTAGRAM_CONNECTOR_COMMAND_TIMEOUT_MS", 15_000L),
                longSetting("instagram.local.waitTimeoutMs", "INSTAGRAM_CONNECTOR_WAIT_TIMEOUT_MS", 15_000L),
                new File(artifactDir),
                setting("instagram.local.adbKeyboardIme", "INSTAGRAM_CONNECTOR_ADB_KEYBOARD_IME", DEFAULT_ADB_KEYBOARD_IME),
                setting(
                        "instagram.local.adbKeyboardInputAction",
                        "INSTAGRAM_CONNECTOR_ADB_KEYBOARD_INPUT_ACTION",
                        DEFAULT_ADB_KEYBOARD_INPUT_ACTION));
    }

    /**
     * 输入：系统属性中的 inputJsonFile 或 inputJson。
     * 输出：connector 执行输入 JSON。
     * 作用：优先从临时文件读取业务 JSON，旧 inputJson 仅作为手工调试兜底。
     */
    private String inputJson() throws Exception {
        String inputJsonFile = property("instagram.local.inputJsonFile", "");
        if (!inputJsonFile.isBlank()) {
            return new String(Files.readAllBytes(new File(inputJsonFile).toPath()), StandardCharsets.UTF_8);
        }
        return property("instagram.local.inputJson", "{}");
    }

    /**
     * 输入：ConnectorResult。
     * 输出：CLI 可解析的 JSON。
     * 作用：保持 Node CLI 和 Java RuntimeCommand 的输出合同一致。
     */
    private JSONObject connectorResult(ConnectorResult result) throws Exception {
        return new JSONObject()
                .put("status", result.status().name())
                .put("code", result.code())
                .put("outputJson", result.outputJson())
                .put("detail", result.detail());
    }

    /**
     * 输入：输出对象。
     * 输出：成功 JSON。
     * 作用：返回 connector.load 这类本地适配动作的成功结果。
     */
    private JSONObject succeeded(JSONObject output) throws Exception {
        return new JSONObject()
                .put("status", "SUCCEEDED")
                .put("code", "OK")
                .put("output", output)
                .put("detail", "");
    }

    /**
     * 输入：错误码和错误详情。
     * 输出：失败 JSON。
     * 作用：返回本地适配器边界错误。
     */
    private JSONObject failed(String code, String detail) throws Exception {
        return new JSONObject()
                .put("status", "FAILED")
                .put("code", code)
                .put("outputJson", "{}")
                .put("detail", detail == null ? "" : detail);
    }

    /**
     * 输入：错误码和错误详情。
     * 输出：失败 JSON。
     * 作用：main 捕获异常后仍输出合法 JSON，避免 runner 解析失败。
     */
    private static JSONObject errorResult(String code, String detail) throws Exception {
        return new JSONObject()
                .put("status", "FAILED")
                .put("code", code)
                .put("outputJson", "{}")
                .put("detail", detail == null ? "" : detail);
    }

    /**
     * 输入：系统属性名和默认值。
     * 输出：属性值。
     * 作用：读取 JavaExec 传入的本地 Runtime 参数。
     */
    private String property(String name, String defaultValue) {
        String value = System.getProperty(name);
        return value == null || value.isBlank() ? defaultValue : value;
    }

    /**
     * 输入：环境变量名和默认值。
     * 输出：环境变量值。
     * 作用：让 PowerShell wrapper 可以通过环境变量传递 ADB 参数。
     */
    private String env(String name, String defaultValue) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? defaultValue : value;
    }

    /**
     * 输入：系统属性名、环境变量名和默认值。
     * 输出：配置值。
     * 作用：按 JavaExec 系统属性优先、环境变量其次的顺序读取本地 Runtime 参数。
     */
    private String setting(String property, String environment, String defaultValue) {
        String propertyValue = System.getProperty(property);
        if (propertyValue != null && !propertyValue.isBlank()) return propertyValue;
        String environmentValue = System.getenv(environment);
        if (environmentValue != null && !environmentValue.isBlank()) return environmentValue;
        String legacyEnvironment = environment.replace("INSTAGRAM_CONNECTOR_", "INSTAGRAM_MCP_");
        String legacyValue = System.getenv(legacyEnvironment);
        return legacyValue == null || legacyValue.isBlank() ? defaultValue : legacyValue;
    }

    /**
     * 输入：系统属性名、环境变量名和默认值。
     * 输出：正整数配置值。
     * 作用：解析本地 Runtime 超时参数，非法值快速失败。
     */
    private long longSetting(String property, String environment, long defaultValue) {
        String value = setting(property, environment, Long.toString(defaultValue));
        try {
            long parsed = Long.parseLong(value);
            if (parsed <= 0L) throw new NumberFormatException(value);
            return parsed;
        } catch (NumberFormatException error) {
            throw new IllegalArgumentException(environment + " must be a positive integer");
        }
    }

    /**
     * 输入：无。
     * 输出：默认 ADB 路径。
     * 作用：在未显式传入 ADB 时使用 Windows Android Studio 默认 SDK 路径。
     */
    private String defaultAdbPath() {
        String localAppData = env("LOCALAPPDATA", "");
        if (!localAppData.isBlank()) {
            return new File(localAppData, "Android/Sdk/platform-tools/adb.exe").getAbsolutePath();
        }
        return "adb";
    }
}
