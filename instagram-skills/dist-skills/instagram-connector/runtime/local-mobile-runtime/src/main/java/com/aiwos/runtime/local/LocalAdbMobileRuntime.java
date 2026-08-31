package com.aiwos.runtime.local;

import com.aiwos.connector.sdk.v1.CapabilityResult;
import com.aiwos.connector.sdk.v1.MobileRuntime;
import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.Base64;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

public final class LocalAdbMobileRuntime implements MobileRuntime {
    private static final String REMOTE_XML_PREFIX = "/data/local/tmp/aiwos-local-runtime-window-";
    private static final String REMOTE_SCREENSHOT = "/sdcard/aiwos-local-runtime-screen.png";
    private static final String REMOTE_MEDIA_DIR = "/sdcard/Pictures/aiwos";
    private static final long DEFAULT_POLL_MS = 500L;
    private static final int SNAPSHOT_REFRESH_ATTEMPTS = 2;
    private static final int SNAPSHOT_DUMP_ATTEMPTS = 1;
    private static final int SNAPSHOT_COMPRESSED_DUMP_ATTEMPTS = 1;
    private static final long SNAPSHOT_RETRY_DELAY_MS = 150L;

    private final LocalMobileRuntimeConfig config;
    private final AdbCommand adb;
    private final UiXmlParser parser = new UiXmlParser();
    private UiSnapshot latestSnapshot;
    private volatile boolean cancelled;

    /**
     * 输入：本地 Runtime 配置。
     * 输出：ADB MobileRuntime 实现。
     * 作用：创建可真实操作 Android 模拟器的 Runtime Bridge。
     */
    public LocalAdbMobileRuntime(LocalMobileRuntimeConfig config) {
        this.config = config;
        this.adb = new AdbCommand(config);
    }

    /**
     * 输入：openApp 请求 JSON。
     * 输出：打开 App 的能力结果。
     * 作用：通过 ADB monkey 启动目标 App。
     */
    @Override
    public CapabilityResult openApp(String requestJson) {
        return runCapability("APP_OPEN_FAILED", () -> {
            JSONObject input = json(requestJson);
            String packageName = input.optString("packageName", config.targetPackage()).trim();
            if (packageName.isEmpty()) packageName = config.targetPackage();
            if (!config.targetPackage().equals(packageName)) {
                return CapabilityResult.error("APP_PACKAGE_DENIED", packageName);
            }

            // 使用 monkey 只发送一次启动事件，避免引入额外业务动作。
            AdbCommand.Result result = adb.shell("monkey", "-p", packageName, "1");
            if (!result.isOk()) return adbError("APP_OPEN_FAILED", result);
            Thread.sleep(1200L);
            return CapabilityResult.ok(new JSONObject()
                    .put("opened", true)
                    .put("packageName", packageName)
                    .toString());
        });
    }

    /**
     * 输入：snapshot 请求 JSON。
     * 输出：当前 UI XML 的结构化快照。
     * 作用：通过 UIAutomator dump 读取真实模拟器页面。
     */
    @Override
    public CapabilityResult snapshot(String requestJson) {
        return runCapability("UI_SNAPSHOT_FAILED", () -> {
            JSONObject input = json(requestJson);
            long snapshotDeadlineEpochMs = input.optLong("snapshotDeadlineEpochMs", 0L);
            JSONObject current = refreshSnapshot(snapshotDeadlineEpochMs).toJson();
            current.put("observationId", observationId("snapshot"));
            current.put("capturedAtMs", System.currentTimeMillis());
            current.put("dumpStatus", "ok");
            if (input.optBoolean("includeActivity", false)) {
                current.put("activity", currentActivity());
            }
            return CapabilityResult.ok(current.toString());
        });
    }

    /**
     * 输入：query 请求 JSON。
     * 输出：匹配 selector 的候选节点。
     * 作用：基于最新 UI XML 查询可操作控件。
     */
    @Override
    public CapabilityResult query(String requestJson) {
        return runCapability("UI_QUERY_FAILED", () -> {
            JSONObject input = json(requestJson);
            JSONObject selector = input.optJSONObject("selector");
            if (selector == null) selector = input;

            UiSnapshot snapshot = refreshSnapshot();
            JSONArray candidates = new JSONArray();
            for (UiNode node : snapshot.nodes()) {
                if (matches(node, selector)) {
                    candidates.put(node.toCandidateJson(snapshot.pageFingerprint()));
                }
            }
            return CapabilityResult.ok(new JSONObject()
                    .put("pageFingerprint", snapshot.pageFingerprint())
                    .put("candidates", candidates)
                    .toString());
        });
    }

    /**
     * 输入：click 请求 JSON。
     * 输出：点击结果。
     * 作用：把 targetPath 转换为控件中心点并执行 ADB tap。
     */
    @Override
    public CapabilityResult click(String requestJson) {
        return runCapability("UI_CLICK_FAILED", () -> {
            JSONObject input = json(requestJson);
            int x;
            int y;
            String targetPath = "";
            if (input.has("x") && input.has("y")) {
                x = input.getInt("x");
                y = input.getInt("y");
            } else {
                UiSnapshot snapshot = snapshotForBoundAction(input);
                UiNode node = boundNode(snapshot, input);
                x = node.bounds().centerX();
                y = node.bounds().centerY();
                targetPath = node.path();
            }

            AdbCommand.Result result = adb.shell("input", "tap", String.valueOf(x), String.valueOf(y));
            if (!result.isOk()) return adbError("UI_CLICK_FAILED", result);
            Thread.sleep(700L);
            JSONObject output = new JSONObject()
                    .put("clicked", true)
                    .put("targetPath", targetPath)
                    .put("x", x)
                    .put("y", y)
                    .put("strategy", input.has("x") && input.has("y") ? "coordinate" : "targetPath");
            return CapabilityResult.ok(output.toString());
        });
    }

    /**
     * 输入：input 请求 JSON。
     * 输出：输入结果。
     * 作用：点击输入框后通过 ADB input text 写入文本。
     */
    @Override
    public CapabilityResult input(String requestJson) {
        return runCapability("UI_INPUT_FAILED", () -> {
            JSONObject input = json(requestJson);
            CapabilityResult clickResult = click(requestJson);
            if (!clickResult.isOk()) return clickResult;

            String text = input.optString("text");
            boolean replace = input.optBoolean("replace", false);
            if (replace) {
                CapabilityResult clearResult = clearFocusedText();
                if (!clearResult.isOk()) return clearResult;
            }
            CapabilityResult textResult = inputText(text);
            if (!textResult.isOk()) return textResult;
            Thread.sleep(500L);
            return CapabilityResult.ok(new JSONObject()
                    .put("input", true)
                    .put("replace", replace)
                    .put("targetPath", input.optString("targetPath"))
                    .put("textLength", text.length())
                    .toString());
        });
    }

    /**
     * 输入：submit 请求 JSON。
     * 输出：提交结果。
     * 作用：对当前输入框发送 IME Enter。
     */
    @Override
    public CapabilityResult submit(String requestJson) {
        return runCapability("UI_SUBMIT_FAILED", () -> {
            JSONObject input = json(requestJson);
            UiSnapshot snapshot = snapshotForBoundAction(input);
            boundNode(snapshot, input);

            // 搜索提交使用键盘 Enter 语义，不查找不存在的确认按钮。
            AdbCommand.Result result = adb.shell("input", "keyevent", "ENTER");
            if (!result.isOk()) return adbError("UI_SUBMIT_FAILED", result);
            Thread.sleep(1000L);
            return CapabilityResult.ok(new JSONObject()
                    .put("submitted", true)
                    .put("keyEvent", "ENTER")
                    .toString());
        });
    }

    /**
     * 输入：scroll 请求 JSON。
     * 输出：滚动结果。
     * 作用：按屏幕尺寸执行上滑或下滑。
     */
    @Override
    public CapabilityResult scroll(String requestJson) {
        return runCapability("UI_SCROLL_FAILED", () -> {
            JSONObject input = json(requestJson);
            String direction = input.optString("direction", "forward");
            ScreenSize size = screenSize();
            int x = size.width / 2;
            int startY = "backward".equals(direction) ? size.height / 5 : size.height * 3 / 4;
            int endY = "backward".equals(direction) ? size.height * 3 / 4 : size.height / 5;
            int durationMs = 280;

            // forward 对应 Reels 下一条；起点避开底部手势区，避免 ADB 成功但 App 未收到滑动。
            AdbCommand.Result result = adb.shell(
                    "input", "swipe",
                    String.valueOf(x), String.valueOf(startY),
                    String.valueOf(x), String.valueOf(endY),
                    String.valueOf(durationMs));
            if (!result.isOk()) return adbError("UI_SCROLL_FAILED", result);
            Thread.sleep(900L);
            return CapabilityResult.ok(new JSONObject()
                    .put("scrolled", true)
                    .put("direction", direction)
                    .put("x", x)
                    .put("startY", startY)
                    .put("endY", endY)
                    .put("durationMs", durationMs)
                    .toString());
        });
    }

    /**
     * 输入：waitFor 请求 JSON。
     * 输出：第一个匹配节点或超时错误。
     * 作用：轮询 snapshot/query 等待目标控件出现。
     */
    @Override
    public CapabilityResult waitFor(String requestJson) {
        return runCapability("UI_WAIT_FAILED", () -> {
            JSONObject input = json(requestJson);
            long timeoutMs = input.optLong("timeoutMs", config.waitTimeoutMs());
            long intervalMs = input.optLong("intervalMs", DEFAULT_POLL_MS);
            long startedAt = System.currentTimeMillis();
            long deadline = startedAt + timeoutMs;

            while (System.currentTimeMillis() < deadline) {
                if (isCancelled()) return CapabilityResult.error("CANCELLED", "Runtime cancelled");
                CapabilityResult result = query(requestJson);
                if (!result.isOk()) return result;
                JSONObject payload = new JSONObject(result.payloadJson());
                JSONArray candidates = payload.optJSONArray("candidates");
                if (candidates != null && candidates.length() > 0) {
                    return CapabilityResult.ok(new JSONObject()
                            .put("matched", true)
                            .put("elapsedMs", System.currentTimeMillis() - startedAt)
                            .put("candidate", candidates.getJSONObject(0))
                            .toString());
                }
                Thread.sleep(intervalMs);
            }
            return CapabilityResult.error("UI_WAIT_TIMEOUT", requestJson);
        });
    }

    /**
     * 输入：capture 请求 JSON。
     * 输出：截图文件路径和屏幕尺寸。
     * 作用：截取当前模拟器画面供内容判断使用。
     */
    @Override
    public CapabilityResult capture(String requestJson) {
        return runCapability("UI_CAPTURE_FAILED", () -> {
            ensureArtifactDir();
            File localFile = artifactFile("screen", ".png");

            // screencap 保存到设备侧，再 pull 到本地日志目录。
            AdbCommand.Result capture = adb.shell("screencap", "-p", REMOTE_SCREENSHOT);
            if (!capture.isOk()) return adbError("UI_CAPTURE_FAILED", capture);
            AdbCommand.Result pull = adb.pull(REMOTE_SCREENSHOT, localFile);
            if (!pull.isOk()) return adbError("UI_CAPTURE_PULL_FAILED", pull);

            ScreenSize size = screenSize();
            return CapabilityResult.ok(new JSONObject()
                    .put("imagePath", localFile.getAbsolutePath())
                    .put("width", size.width)
                    .put("height", size.height)
                    .toString());
        });
    }

    /**
     * 输入：ocr 请求 JSON。
     * 输出：空 OCR 行。
     * 作用：首版不接 OCR 引擎，仅保持 connector 调用链路可运行。
     */
    @Override
    public CapabilityResult ocr(String requestJson) {
        return runCapability("OCR_UNAVAILABLE", () -> {
            String fingerprint = latestSnapshot == null ? "" : latestSnapshot.pageFingerprint();
            return CapabilityResult.ok(new JSONObject()
                    .put("visualPageFingerprint", fingerprint)
                    .put("lines", new JSONArray())
                    .toString());
        });
    }

    /**
     * 输入：checkpoint 请求 JSON。
     * 输出：checkpoint 记录结果。
     * 作用：首版只回传请求内容，不做恢复状态管理。
     */
    @Override
    public CapabilityResult checkpoint(String requestJson) {
        return runCapability("CHECKPOINT_FAILED", () -> {
            JSONObject input = json(requestJson);
            if ("media.prepare".equals(input.optString("type"))) {
                return prepareMedia(input);
            }
            return CapabilityResult.ok(new JSONObject()
                    .put("checkpointed", true)
                    .put("checkpointJson", input)
                    .toString());
        });
    }

    /**
     * 输入：无。
     * 输出：是否取消。
     * 作用：让 connector 在长轮询时可以停止执行。
     */
    @Override
    public boolean isCancelled() {
        return cancelled;
    }

    /**
     * 输入：取消标记。
     * 输出：无。
     * 作用：供测试代码主动中断本地 Runtime。
     */
    public void setCancelled(boolean cancelled) {
        this.cancelled = cancelled;
    }

    /**
     * 输入：无。
     * 输出：最新 UI 快照。
     * 作用：执行 UIAutomator dump、拉取 XML、解析并缓存页面状态。
     */
    private UiSnapshot refreshSnapshot() throws Exception {
        return refreshSnapshot(0L);
    }

    /**
     * 输入：snapshot deadline epoch millis。
     * 输出：最新 UI 快照。
     * 作用：执行 deadline-aware UIAutomator dump，避免动态页面长时间卡住。
     */
    private UiSnapshot refreshSnapshot(long snapshotDeadlineEpochMs) throws Exception {
        ensureArtifactDir();
        File localFile = artifactFile("window", ".xml");
        AdbCommand.Result lastFailure = new AdbCommand.Result(1, "", "UI dump did not run");
        String lastCode = "UI_DUMP_FAILED";
        for (int attempt = 0; attempt < SNAPSHOT_REFRESH_ATTEMPTS; attempt++) {
            if (attempt > 0) sleepBeforeSnapshotRetry(snapshotDeadlineEpochMs);
            ensureSnapshotDeadline(snapshotDeadlineEpochMs);
            String remoteXml = remoteXmlPath();
            try {
                AdbCommand.Result dump = dumpWindowHierarchy(remoteXml, snapshotDeadlineEpochMs);
                if (!dumpSuccessful(dump)) {
                    lastFailure = dump;
                    lastCode = dumpIdleTimedOut(dump) ? "UI_DUMP_IDLE_TIMEOUT" : "UI_DUMP_FAILED";
                    continue;
                }

                ensureSnapshotDeadline(snapshotDeadlineEpochMs);
                AdbCommand.Result exists = adb.shellWithTimeout(
                        commandTimeoutMs(snapshotDeadlineEpochMs),
                        "test",
                        "-f",
                        remoteXml);
                if (!exists.isOk()) {
                    lastFailure = new AdbCommand.Result(
                            1,
                            dump.stdout(),
                            "UI_DUMP_OUTPUT_MISSING: " + remoteXml + "\n" + dump.stderr());
                    lastCode = "UI_DUMP_FAILED";
                    continue;
                }

                ensureSnapshotDeadline(snapshotDeadlineEpochMs);
                AdbCommand.Result pull = adb.pullWithTimeout(
                        remoteXml,
                        localFile,
                        commandTimeoutMs(snapshotDeadlineEpochMs));
                if (!pull.isOk()) {
                    lastFailure = pull;
                    lastCode = "UI_XML_PULL_FAILED";
                    continue;
                }

                ensureSnapshotDeadline(snapshotDeadlineEpochMs);
                // XML 是 Runtime 后续 query/click 的唯一页面事实来源。
                String xml = new String(Files.readAllBytes(localFile.toPath()), StandardCharsets.UTF_8);
                latestSnapshot = parser.parse(xml);
                return latestSnapshot;
            } finally {
                removeRemoteFileQuietly(remoteXml);
            }
        }
        return failAdb(lastCode, lastFailure);
    }

    /**
     * 输入：无。
     * 输出：UIAutomator dump 命令结果。
     * 作用：对动态页面做短重试，并在普通 dump 失败后使用 compressed 兜底。
     */
    private AdbCommand.Result dumpWindowHierarchy(String remoteXml, long snapshotDeadlineEpochMs) throws Exception {
        AdbCommand.Result last = null;
        for (int attempt = 0; attempt < SNAPSHOT_DUMP_ATTEMPTS; attempt++) {
            if (attempt > 0) sleepBeforeSnapshotRetry(snapshotDeadlineEpochMs);
            ensureSnapshotDeadline(snapshotDeadlineEpochMs);
            last = adb.shellWithTimeout(commandTimeoutMs(snapshotDeadlineEpochMs), "uiautomator", "dump", remoteXml);
            if (dumpSuccessful(last)) return last;
        }
        for (int attempt = 0; attempt < SNAPSHOT_COMPRESSED_DUMP_ATTEMPTS; attempt++) {
            if (attempt > 0) sleepBeforeSnapshotRetry(snapshotDeadlineEpochMs);
            ensureSnapshotDeadline(snapshotDeadlineEpochMs);
            last = adb.shellWithTimeout(
                    commandTimeoutMs(snapshotDeadlineEpochMs),
                    "uiautomator",
                    "dump",
                    "--compressed",
                    remoteXml);
            if (dumpSuccessful(last)) return last;
        }
        return last;
    }

    /**
     * 输入：ADB dump 结果。
     * 输出：是否可继续拉取 XML。
     * 作用：uiautomator 某些失败会以 exitCode=0 输出 ERROR，不能当成功处理。
     */
    private boolean dumpSuccessful(AdbCommand.Result result) {
        if (result == null || !result.isOk()) return false;
        String detail = (result.stderr() + "\n" + result.stdout()).toLowerCase();
        return !detail.contains("error:");
    }

    /**
     * 输入：ADB dump 结果。
     * 输出：是否是 UIAutomator 等待空闲超时。
     * 作用：让上层日志区分动态页面常见失败。
     */
    private boolean dumpIdleTimedOut(AdbCommand.Result result) {
        String detail = (result.stderr() + "\n" + result.stdout()).toLowerCase();
        return detail.contains("idle") || detail.contains("could not get idle state");
    }

    /**
     * 输入：snapshot deadline epoch millis。
     * 输出：单条 ADB 命令超时。
     * 作用：将 ADB 命令等待限制在 Host deadline 剩余时间内。
     */
    private long commandTimeoutMs(long snapshotDeadlineEpochMs) {
        if (snapshotDeadlineEpochMs <= 0L) return config.commandTimeoutMs();
        long remainingMs = snapshotDeadlineEpochMs - System.currentTimeMillis();
        if (remainingMs <= 0L) {
            throw new CapabilityFailure("UI_SNAPSHOT_DEADLINE_EXCEEDED", "snapshot deadline exceeded");
        }
        return Math.min(config.commandTimeoutMs(), remainingMs);
    }

    /**
     * 输入：snapshot deadline epoch millis。
     * 输出：无。
     * 作用：在每次重试和耗时步骤前快速中断 debug snapshot。
     */
    private void ensureSnapshotDeadline(long snapshotDeadlineEpochMs) {
        if (snapshotDeadlineEpochMs > 0L && System.currentTimeMillis() >= snapshotDeadlineEpochMs) {
            throw new CapabilityFailure("UI_SNAPSHOT_DEADLINE_EXCEEDED", "snapshot deadline exceeded");
        }
    }

    /**
     * 输入：snapshot deadline epoch millis。
     * 输出：无。
     * 作用：缩短 UI dump 重试间隔，并确保睡眠不会越过 deadline。
     */
    private void sleepBeforeSnapshotRetry(long snapshotDeadlineEpochMs) throws Exception {
        long sleepMs = SNAPSHOT_RETRY_DELAY_MS;
        if (snapshotDeadlineEpochMs > 0L) {
            sleepMs = Math.min(sleepMs, Math.max(0L, snapshotDeadlineEpochMs - System.currentTimeMillis()));
        }
        if (sleepMs > 0L) Thread.sleep(sleepMs);
        ensureSnapshotDeadline(snapshotDeadlineEpochMs);
    }

    /**
     * 输入：media.prepare 请求 JSON。
     * 输出：图片入相册结果。
     * 作用：把 URL 或本地图片推送到模拟器相册并触发媒体扫描。
     */
    private CapabilityResult prepareMedia(JSONObject input) throws Exception {
        String mediaType = input.optString("mediaType", "image").trim();
        if (!"image".equals(mediaType)) {
            return CapabilityResult.error("MEDIA_PREPARE_TYPE_UNSUPPORTED", mediaType);
        }

        String url = input.optString("url").trim();
        String localPath = input.optString("localPath").trim();
        if (url.isBlank() == localPath.isBlank()) {
            return CapabilityResult.error("MEDIA_PREPARE_SOURCE_INVALID", "Exactly one of url or localPath is required");
        }

        ensureArtifactDir();
        File sourceFile;
        String sourceType;
        if (!url.isBlank()) {
            sourceFile = downloadMedia(url);
            sourceType = "url";
        } else {
            sourceFile = localMediaFile(localPath);
            sourceType = "localPath";
        }

        String remotePath = REMOTE_MEDIA_DIR + "/" + mediaRemoteFileName(sourceFile);
        AdbCommand.Result mkdir = adb.shell("mkdir", "-p", REMOTE_MEDIA_DIR);
        if (!mkdir.isOk()) return adbError("MEDIA_PREPARE_REMOTE_DIR_FAILED", mkdir);

        AdbCommand.Result push = adb.push(sourceFile, remotePath);
        if (!push.isOk()) return adbError("MEDIA_PREPARE_PUSH_FAILED", push);

        AdbCommand.Result scan = adb.shell(
                "am",
                "broadcast",
                "-a",
                "android.intent.action.MEDIA_SCANNER_SCAN_FILE",
                "-d",
                "file://" + remotePath);
        if (!scan.isOk()) return adbError("MEDIA_PREPARE_SCAN_FAILED", scan);
        Thread.sleep(1000L);

        return CapabilityResult.ok(new JSONObject()
                .put("prepared", true)
                .put("type", "media.prepare")
                .put("mediaType", mediaType)
                .put("sourceType", sourceType)
                .put("localPath", sourceFile.getAbsolutePath())
                .put("remotePath", remotePath)
                .toString());
    }

    /**
     * 输入：图片 URL。
     * 输出：下载后的本地文件。
     * 作用：把网络图片下载到 artifact 目录，供后续 adb push。
     */
    private File downloadMedia(String url) throws Exception {
        URI uri = new URI(url);
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https")) {
            throw new CapabilityFailure("MEDIA_PREPARE_URL_UNSUPPORTED", "Only http and https URLs are supported");
        }

        HttpURLConnection connection = (HttpURLConnection) uri.toURL().openConnection();
        connection.setConnectTimeout((int) Math.min(config.commandTimeoutMs(), 30000L));
        connection.setReadTimeout((int) Math.min(config.commandTimeoutMs(), 30000L));
        try {
            int statusCode = connection.getResponseCode();
            if (statusCode < 200 || statusCode >= 300) {
                throw new CapabilityFailure("MEDIA_PREPARE_DOWNLOAD_FAILED", "HTTP " + statusCode);
            }

            String suffix = mediaSuffix(url, connection.getContentType());
            File localFile = artifactFile("media", suffix);
            try (InputStream stream = connection.getInputStream()) {
                Files.copy(stream, localFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
            }
            return localFile;
        } finally {
            connection.disconnect();
        }
    }

    /**
     * 输入：本地图片路径。
     * 输出：本地图片文件。
     * 作用：校验 host 图片来源，避免向模拟器推送非图片文件。
     */
    private File localMediaFile(String localPath) {
        File file = new File(localPath);
        if (!file.isFile()) {
            throw new CapabilityFailure("MEDIA_PREPARE_LOCAL_FILE_NOT_FOUND", localPath);
        }
        mediaSuffix(file.getName(), "");
        return file;
    }

    /**
     * 输入：源文件。
     * 输出：设备侧图片文件名。
     * 作用：生成可被相册扫描的稳定图片文件名。
     */
    private String mediaRemoteFileName(File sourceFile) {
        String suffix = mediaSuffix(sourceFile.getName(), "");
        return "aiwos-" + System.currentTimeMillis() + "-" + Math.abs(sourceFile.getAbsolutePath().hashCode()) + suffix;
    }

    /**
     * 输入：文件名或 URL、Content-Type。
     * 输出：图片后缀。
     * 作用：限制 media.prepare 只处理 Instagram 头像可用的常见图片类型。
     */
    private String mediaSuffix(String name, String contentType) {
        String normalizedType = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        if (normalizedType.contains("image/jpeg") || normalizedType.contains("image/jpg")) return ".jpg";
        if (normalizedType.contains("image/png")) return ".png";
        if (normalizedType.contains("image/webp")) return ".webp";
        if (!normalizedType.isBlank() && !normalizedType.startsWith("image/")) {
            throw new CapabilityFailure("MEDIA_PREPARE_IMAGE_TYPE_UNSUPPORTED", contentType);
        }

        String lowerName = name.toLowerCase(Locale.ROOT);
        int queryIndex = lowerName.indexOf('?');
        if (queryIndex >= 0) lowerName = lowerName.substring(0, queryIndex);
        if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return ".jpg";
        if (lowerName.endsWith(".png")) return ".png";
        if (lowerName.endsWith(".webp")) return ".webp";
        throw new CapabilityFailure("MEDIA_PREPARE_IMAGE_TYPE_UNSUPPORTED", name);
    }

    /**
     * 输入：无。
     * 输出：当前前台 Activity 摘要。
     * 作用：让 debug snapshot 带上 XML 之外的设备状态。
     */
    private JSONObject currentActivity() throws Exception {
        AdbCommand.Result result;
        try {
            result = adb.shell("dumpsys", "activity", "activities");
        } catch (Exception error) {
            return new JSONObject()
                    .put("status", "failed")
                    .put("detail", error.getMessage() == null ? error.getClass().getName() : error.getMessage());
        }
        if (!result.isOk()) {
            return new JSONObject()
                    .put("status", "failed")
                    .put("detail", result.stderr().isBlank() ? result.stdout() : result.stderr());
        }
        String output = result.stdout();
        Matcher matcher = Pattern.compile("topResumedActivity=([^\\n\\r]+)").matcher(output);
        String top = matcher.find() ? matcher.group(1).trim() : "";
        if (top.isBlank()) {
            matcher = Pattern.compile("mResumedActivity: ([^\\n\\r]+)").matcher(output);
            if (matcher.find()) top = matcher.group(1).trim();
        }
        return new JSONObject()
                .put("status", "ok")
                .put("topResumedActivity", top);
    }

    /**
     * 输入：无。
     * 输出：本次 dump 专用的远端 XML 文件。
     * 作用：避免 dump/pull 边界情况下拉到上一次 snapshot 遗留的 XML。
     */
    private String remoteXmlPath() {
        return REMOTE_XML_PREFIX + System.currentTimeMillis() + "-" + System.nanoTime() + ".xml";
    }

    /**
     * 输入：设备远端文件路径。
     * 输出：无。
     * 作用：清理临时 XML；清理失败不影响已经完成的 snapshot。
     */
    private void removeRemoteFileQuietly(String remotePath) {
        try {
            adb.shell("rm", "-f", remotePath);
        } catch (Exception ignored) {
            // Best-effort cleanup only.
        }
    }

    /**
     * 输入：采样类型。
     * 输出：本地观测 ID。
     * 作用：关联一次 debug 输出内的 XML、截图和 activity 记录。
     */
    private String observationId(String type) {
        return type + "-" + System.currentTimeMillis();
    }

    /**
     * 输入：包含 targetPath 和 expectedPageFingerprint 的动作请求。
     * 输出：可用于执行动作的页面快照。
     * 作用：优先复用 query 阶段缓存的节点，避免动态页面刷新导致点击前指纹误判。
     */
    private UiSnapshot snapshotForBoundAction(JSONObject input) throws Exception {
        String expected = input.optString("expectedPageFingerprint");
        if (!expected.isBlank() && latestSnapshot != null && expected.equals(latestSnapshot.pageFingerprint())) {
            return latestSnapshot;
        }
        return refreshSnapshot();
    }

    /**
     * 输入：当前快照和动作请求。
     * 输出：已绑定节点。
     * 作用：校验页面指纹并按 targetPath 找到动作目标。
     */
    private UiNode boundNode(UiSnapshot snapshot, JSONObject input) {
        String expected = input.optString("expectedPageFingerprint");
        if (!expected.isBlank() && !expected.equals(snapshot.pageFingerprint())) {
            throw new IllegalStateException("UI_PAGE_CHANGED_REQUERY_REQUIRED");
        }
        String targetPath = input.optString("targetPath", input.optString("path"));
        UiNode node = snapshot.nodeByPath(targetPath);
        if (node == null) throw new IllegalStateException("UI_TARGET_NOT_FOUND: " + targetPath);
        return node;
    }

    /**
     * 输入：UiNode 和 selector。
     * 输出：是否匹配。
     * 作用：实现 Runtime query 支持的最小 selector 集合。
     */
    private boolean matches(UiNode node, JSONObject selector) {
        if (selector.has("resourceId") && !selector.optString("resourceId").equals(node.resourceId())) return false;
        if (selector.has("text") && !selector.optString("text").equals(node.text())) return false;
        if (selector.has("textContains") && !node.text().contains(selector.optString("textContains"))) return false;
        if (selector.has("contentDescription")
                && !selector.optString("contentDescription").equals(node.contentDescription())) return false;
        if (selector.has("descriptionContains")
                && !node.contentDescription().contains(selector.optString("descriptionContains"))) return false;
        if (selector.has("className") && !selector.optString("className").equals(node.className())) return false;
        if (selector.has("clickable") && selector.optBoolean("clickable") != node.clickable()) return false;
        if (selector.has("enabled") && selector.optBoolean("enabled") != node.enabled()) return false;
        if (selector.has("selected") && selector.optBoolean("selected") != node.selected()) return false;
        if (selector.has("checked") && selector.optBoolean("checked") != node.checked()) return false;
        return true;
    }

    /**
     * 输入：requestJson 字符串。
     * 输出：JSONObject。
     * 作用：解析 Runtime 能力调用输入。
     */
    private JSONObject json(String requestJson) throws Exception {
        String value = requestJson == null || requestJson.isBlank() ? "{}" : requestJson;
        return new JSONObject(value);
    }

    /**
     * 输入：待输入文本。
     * 输出：文本输入能力结果。
     * 作用：优先使用剪贴板粘贴支持 Unicode，剪贴板失败后仅允许 ASCII 走 ADB input text 兜底。
     */
    private CapabilityResult inputText(String text) throws Exception {
        CapabilityResult adbKeyboardResult = inputTextWithAdbKeyboard(text);
        if (adbKeyboardResult.isOk()) return adbKeyboardResult;

        if (!isPrintableAscii(text)) {
            return CapabilityResult.error(
                    "UI_INPUT_UNICODE_UNSUPPORTED",
                    "ADB Keyboard input failed and adb input text only supports ASCII fallback: " + adbKeyboardResult.detail());
        }

        AdbCommand.Result fallback = adb.shell("input", "text", escapeInputText(text));
        if (!fallback.isOk()) return adbError("UI_INPUT_FAILED", fallback);
        return CapabilityResult.ok(new JSONObject()
                .put("inputStrategy", "adb_text")
                .put("textLength", text.length())
                .toString());
    }

    /**
     * 输入：无。
     * 输出：清空当前焦点输入框的能力结果。
     * 作用：在 replace=true 时先全选删除，避免资料字段被追加文本。
     */
    private CapabilityResult clearFocusedText() throws Exception {
        AdbCommand.Result selectAll = adb.shell("input", "keycombination", "KEYCODE_CTRL_LEFT", "KEYCODE_A");
        if (!selectAll.isOk()) return adbError("UI_INPUT_SELECT_ALL_FAILED", selectAll);

        AdbCommand.Result delete = adb.shell("input", "keyevent", "KEYCODE_DEL");
        if (!delete.isOk()) return adbError("UI_INPUT_CLEAR_FAILED", delete);

        Thread.sleep(150L);
        return CapabilityResult.ok(new JSONObject()
                .put("cleared", true)
                .put("strategy", "ctrl_a_delete")
                .toString());
    }

    /**
     * 输入：待输入文本。
     * 输出：ADB Keyboard 输入能力结果。
     * 作用：通过外部 ADB Keyboard 输入法提交 Unicode 文本。
     */
    private CapabilityResult inputTextWithAdbKeyboard(String text) throws Exception {
        String targetIme = config.adbKeyboardIme();
        if (!isImeInstalled(targetIme)) {
            return CapabilityResult.error("UI_ADB_KEYBOARD_UNAVAILABLE", "IME not installed: " + targetIme);
        }

        String previousIme = currentInputMethod();
        boolean switched = !targetIme.equals(previousIme);
        if (switched) {
            AdbCommand.Result enable = adb.shell("ime", "enable", targetIme);
            if (!enable.isOk()) return adbError("UI_ADB_KEYBOARD_ENABLE_FAILED", enable);

            AdbCommand.Result set = adb.shell("ime", "set", targetIme);
            if (!set.isOk()) return adbError("UI_ADB_KEYBOARD_SET_FAILED", set);

            Thread.sleep(300L);
        }

        try {
            String textBase64 = Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8));
            AdbCommand.Result broadcast = adb.shell(
                    "am",
                    "broadcast",
                    "-a",
                    config.adbKeyboardInputAction(),
                    "--es",
                    "msg",
                    textBase64);
            if (!broadcast.isOk()) return adbError("UI_ADB_KEYBOARD_BROADCAST_FAILED", broadcast);
            if (broadcastFailed(broadcast)) {
                return CapabilityResult.error("UI_ADB_KEYBOARD_BROADCAST_FAILED", commandDetail(broadcast));
            }

            Thread.sleep(300L);
            return CapabilityResult.ok(new JSONObject()
                    .put("inputStrategy", "adb_keyboard")
                    .put("ime", targetIme)
                    .put("action", config.adbKeyboardInputAction())
                    .put("textLength", text.length())
                    .toString());
        } finally {
            if (switched) restoreInputMethodQuietly(previousIme);
        }
    }

    /**
     * 输入：输入法组件名。
     * 输出：是否已安装。
     * 作用：在尝试切换输入法前确认外部 ADB Keyboard 可用。
     */
    private boolean isImeInstalled(String ime) throws Exception {
        AdbCommand.Result result = adb.shell("ime", "list", "-s");
        if (!result.isOk()) return false;
        for (String line : result.stdout().split("\\R")) {
            if (ime.equals(line.trim())) return true;
        }
        return false;
    }

    /**
     * 输入：无。
     * 输出：当前默认输入法组件名。
     * 作用：输入完成后尽量恢复用户原输入法。
     */
    private String currentInputMethod() throws Exception {
        AdbCommand.Result result = adb.shell("settings", "get", "secure", "default_input_method");
        return result.isOk() ? result.stdout().trim() : "";
    }

    /**
     * 输入：原输入法组件名。
     * 输出：无。
     * 作用：尽量恢复输入前的默认输入法，失败不影响已完成输入。
     */
    private void restoreInputMethodQuietly(String ime) {
        if (ime.isBlank()) return;
        try {
            adb.shell("ime", "set", ime);
        } catch (Exception ignored) {
            // 输入已经完成，恢复失败只影响设备环境，不应覆盖主动作结果。
        }
    }

    /**
     * 输入：广播命令结果。
     * 输出：广播是否被系统明确标记失败。
     * 作用：避免 broadcast exitCode=0 但实际没有投递到输入法时误判成功。
     */
    private boolean broadcastFailed(AdbCommand.Result result) {
        String detail = commandDetail(result).toLowerCase();
        return detail.contains("broadcast completed: result=-1") || detail.contains("unable to find");
    }

    /**
     * 输入：ADB 命令结果。
     * 输出：stdout 和 stderr 合并后的诊断文本。
     * 作用：检测 exitCode 之外的 shell 伪成功错误信息。
     */
    private String commandDetail(AdbCommand.Result result) {
        return (result.stderr() + "\n" + result.stdout()).trim();
    }

    /**
     * 输入：待输入文本。
     * 输出：是否只包含可打印 ASCII 字符。
     * 作用：限制 ADB input text 兜底范围，避免中文、Emoji 或换行被错误发送。
     */
    private boolean isPrintableAscii(String text) {
        for (int index = 0; index < text.length(); index++) {
            char current = text.charAt(index);
            if (current < 0x20 || current > 0x7E) return false;
        }
        return true;
    }

    /**
     * 输入：文本。
     * 输出：ADB input text 参数。
     * 作用：把空格转换为 Android input text 可接受的形式。
     */
    private String escapeInputText(String text) {
        return text.replace("\\", "\\\\")
                .replace(" ", "%s")
                .replace("\"", "\\\"")
                .replace("'", "\\'");
    }

    /**
     * 输入：无。
     * 输出：屏幕尺寸。
     * 作用：为 scroll 和 capture 返回值提供真实页面尺寸。
     */
    private ScreenSize screenSize() throws Exception {
        AdbCommand.Result result = adb.shell("wm", "size");
        if (!result.isOk()) return failAdb("WM_SIZE_FAILED", result);
        Matcher matcher = Pattern.compile("(\\d+)x(\\d+)").matcher(result.stdout());
        if (!matcher.find()) throw new IllegalStateException("WM_SIZE_PARSE_FAILED: " + result.stdout());
        return new ScreenSize(Integer.parseInt(matcher.group(1)), Integer.parseInt(matcher.group(2)));
    }

    /**
     * 输入：文件名前缀和后缀。
     * 输出：产物文件路径。
     * 作用：为 XML 和截图生成本地保存位置。
     */
    private File artifactFile(String prefix, String suffix) {
        return new File(config.artifactDir(), System.currentTimeMillis() + "-" + prefix + suffix);
    }

    /**
     * 输入：无。
     * 输出：无。
     * 作用：确保测试产物目录存在。
     */
    private void ensureArtifactDir() throws Exception {
        Files.createDirectories(config.artifactDir().toPath());
    }

    /**
     * 输入：错误码和 ADB 结果。
     * 输出：能力错误结果。
     * 作用：把外部命令失败转换为 Runtime 错误。
     */
    private CapabilityResult adbError(String code, AdbCommand.Result result) {
        return CapabilityResult.error(code, result.stderr().isBlank() ? result.stdout() : result.stderr());
    }

    /**
     * 输入：错误码和 ADB 结果。
     * 输出：不会正常返回。
     * 作用：在需要对象返回值的私有流程中暴露 ADB 失败。
     */
    private <T> T failAdb(String code, AdbCommand.Result result) {
        throw new CapabilityFailure(code, result.stderr().isBlank() ? result.stdout() : result.stderr());
    }

    /**
     * 输入：兜底错误码和能力逻辑。
     * 输出：CapabilityResult。
     * 作用：统一把本地异常转换为 MobileRuntime 能力错误。
     */
    private CapabilityResult runCapability(String fallbackCode, CapabilityCall call) {
        try {
            return call.run();
        } catch (CapabilityFailure failure) {
            return CapabilityResult.error(failure.code, failure.getMessage() == null ? "" : failure.getMessage());
        } catch (Exception error) {
            return CapabilityResult.error(fallbackCode, error.getMessage() == null ? error.toString() : error.getMessage());
        }
    }

    private interface CapabilityCall {
        /**
         * 输入：无。
         * 输出：能力调用结果。
         * 作用：让 runCapability 统一处理异常到 CapabilityResult 的转换。
         */
        CapabilityResult run() throws Exception;
    }

    private static final class CapabilityFailure extends RuntimeException {
        private final String code;

        private CapabilityFailure(String code, String detail) {
            super(detail);
            this.code = code;
        }
    }

    private static final class ScreenSize {
        private final int width;
        private final int height;

        /**
         * 输入：宽度和高度。
         * 输出：屏幕尺寸对象。
         * 作用：保存当前模拟器分辨率。
         */
        private ScreenSize(int width, int height) {
            this.width = width;
            this.height = height;
        }
    }
}
