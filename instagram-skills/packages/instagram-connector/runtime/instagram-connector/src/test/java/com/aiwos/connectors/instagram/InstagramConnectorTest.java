package com.aiwos.connectors.instagram;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import com.aiwos.connector.sdk.v1.CapabilityResult;
import com.aiwos.connector.sdk.v1.ConnectorExecutionRequest;
import com.aiwos.connector.sdk.v1.ConnectorResult;
import com.aiwos.connector.sdk.v1.MobileRuntime;
import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

public final class InstagramConnectorTest {
    private final InstagramConnector connector = new InstagramConnector();

    /**
     * 输入：无。
     * 输出：descriptor 断言。
     * 作用：确认 manifest 需要声明的 operation 已由代码发布。
     */
    @Test
    public void descriptorPublishesInstagramOperations() {
        assertEquals("instagram.mobile.growth.v1", connector.descriptor().connectorId());
        assertEquals("0.1.0", connector.descriptor().version());
        assertTrue(connector.descriptor().actions().contains("instagram.search.open"));
        assertTrue(connector.descriptor().actions().contains("instagram.search.input"));
        assertTrue(connector.descriptor().actions().contains("instagram.search.open_first_reel"));
        assertTrue(connector.descriptor().actions().contains("instagram.reel.collect_signals"));
        assertTrue(connector.descriptor().actions().contains("instagram.reel.like"));
        assertTrue(connector.descriptor().actions().contains("instagram.reel.comment"));
        assertTrue(connector.descriptor().actions().contains("instagram.reel.next"));
        assertTrue(connector.descriptor().actions().contains("instagram.reels.engage_workflow"));
    }

    /**
     * 输入：FakeRuntime 首页。
     * 输出：search.open 成功断言。
     * 作用：确认 Search tab 被定位并点击。
     */
    @Test
    public void searchOpenClicksSearchTab() throws Exception {
        FakeRuntime runtime = new FakeRuntime();
        ConnectorResult result = execute(runtime, "instagram.search.open", new JSONObject());

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals(List.of("query", "click", "query"), runtime.calls);
        assertEquals("/tabs/search", runtime.lastClick.getString("targetPath"));
    }

    /**
     * 输入：FakeRuntime 当前截图。
     * 输出：debug.ocr 成功断言。
     * 作用：确认调试 OCR 能力会透传给 Runtime。
     */
    @Test
    public void debugOcrCallsRuntimeOcr() {
        FakeRuntime runtime = new FakeRuntime();
        ConnectorResult result = execute(runtime, "instagram.debug.ocr", new JSONObject());

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals(List.of("ocr"), runtime.calls);
    }

    /**
     * 输入：默认 debug.snapshot 请求。
     * 输出：snapshot 请求不包含 includeActivity=true。
     * 作用：避免普通 debug snapshot 触发较慢的 activity dumpsys。
     */
    @Test
    public void debugSnapshotDoesNotIncludeActivityByDefault() {
        FakeRuntime runtime = new FakeRuntime();
        ConnectorResult result = execute(runtime, "instagram.debug.snapshot", new JSONObject());

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals(List.of("snapshot"), runtime.calls);
        assertTrue(!runtime.lastSnapshot.optBoolean("includeActivity", false));
        assertTrue(runtime.lastSnapshot.optLong("snapshotDeadlineEpochMs") > System.currentTimeMillis());
    }

    /**
     * 输入：显式 includeActivity=true。
     * 输出：snapshot 请求透传 includeActivity。
     * 作用：保留需要 activity 诊断时的可选能力。
     */
    @Test
    public void debugSnapshotCanIncludeActivityWhenRequested() throws Exception {
        FakeRuntime runtime = new FakeRuntime();
        ConnectorResult result = execute(runtime, "instagram.debug.snapshot", new JSONObject()
                .put("includeActivity", true));

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals(List.of("snapshot"), runtime.calls);
        assertTrue(runtime.lastSnapshot.getBoolean("includeActivity"));
        assertTrue(runtime.lastSnapshot.optLong("snapshotDeadlineEpochMs") > System.currentTimeMillis());
    }

    /**
     * 输入：debug.snapshot 遇到 XML dump idle 超时。
     * 输出：返回截图兜底结果。
     * 作用：动态 Reel 页面不能 dump XML 时仍提供可诊断视觉证据。
     */
    @Test
    public void debugSnapshotFallsBackToCaptureWhenSnapshotUnavailable() throws Exception {
        FakeRuntime runtime = new FakeRuntime();
        runtime.failSnapshot = true;
        ConnectorResult result = execute(runtime, "instagram.debug.snapshot", new JSONObject());
        JSONObject output = new JSONObject(result.outputJson());

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals(List.of("snapshot", "capture"), runtime.calls);
        assertTrue(!output.getBoolean("snapshotAvailable"));
        assertEquals("capture_after_snapshot_unavailable", output.getString("verificationStrategy"));
        assertEquals("UI_DUMP_IDLE_TIMEOUT", output.getJSONObject("snapshotFailure").getString("code"));
        assertEquals("capture-1", output.getJSONObject("capture").getString("imageToken"));
    }

    /**
     * 输入：已过期 deadline 的 debug.snapshot 请求。
     * 输出：不调用 Runtime，直接 deadline 失败。
     * 作用：让 Java 入口读取的 deadlineMs 真正约束 debug snapshot。
     */
    @Test
    public void debugSnapshotStopsWhenDeadlineExceeded() {
        FakeRuntime runtime = new FakeRuntime();
        ConnectorResult result = executeWithDeadline(
                runtime,
                "instagram.debug.snapshot",
                new JSONObject(),
                System.currentTimeMillis() - 1L);

        assertEquals(ConnectorResult.Status.FAILED, result.status());
        assertEquals("INSTAGRAM_EXECUTION_DEADLINE_EXCEEDED", result.code());
        assertTrue(result.detail().contains("stage=debug_snapshot"));
        assertTrue(runtime.calls.isEmpty());
    }

    /**
     * 输入：开启 consoleLog 的执行请求。
     * 输出：stderr 中存在 action 和 runtime capability 日志。
     * 作用：确认日志由统一执行拦截层输出。
     */
    @Test
    public void executeEmitsConsoleDiagnostics() throws Exception {
        FakeRuntime runtime = new FakeRuntime();
        PrintStream previousErr = System.err;
        ByteArrayOutputStream stderr = new ByteArrayOutputStream();
        System.setProperty("instagram.connector.consoleLog", "true");
        System.setErr(new PrintStream(stderr, true, StandardCharsets.UTF_8));
        try {
            ConnectorResult result = execute(runtime, "instagram.debug.ocr", new JSONObject());

            assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        } finally {
            System.setErr(previousErr);
            System.clearProperty("instagram.connector.consoleLog");
        }

        String logs = stderr.toString(StandardCharsets.UTF_8);
        assertTrue(logs.contains("event=connector.start"));
        assertTrue(logs.contains("action=\"instagram.debug.ocr\""));
        assertTrue(logs.contains("event=runtime.start capability=ocr"));
        assertTrue(logs.contains("event=connector.end"));
    }

    /**
     * 输入：默认 collect_signals 参数。
     * 输出：单帧采样结果。
     * 作用：确认默认返回页面文本、截图和 OCR 文本。
     */
    @Test
    public void reelCollectSignalsUsesSingleFrameByDefault() throws Exception {
        FakeRuntime runtime = new FakeRuntime();
        runtime.currentPageFingerprint = "instagram-reel-page";
        ConnectorResult result = execute(runtime, "instagram.reel.collect_signals", new JSONObject());
        JSONObject output = new JSONObject(result.outputJson());
        JSONObject frame = output.getJSONArray("frames").getJSONObject(0);

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals(List.of("snapshot", "capture", "ocr"), runtime.calls);
        assertEquals("instagram-reel-page", output.getString("pageFingerprint"));
        assertEquals(1, output.getJSONArray("frames").length());
        assertEquals("capture-1", frame.getJSONObject("capture").getString("imageToken"));
        assertEquals("sample ocr", frame.getJSONArray("ocrText").getString(0));
        assertEquals("Reels", output.getJSONArray("visibleText").getString(0));
    }

    /**
     * 输入：Reel 播放页 XML dump 不可用。
     * 输出：collect_signals 仍返回截图和 OCR 帧。
     * 作用：Reel 自动播放导致 uiautomator 无法 idle 时，视觉信号仍可用。
     */
    @Test
    public void reelCollectSignalsFallsBackToVisualWhenSnapshotUnavailable() throws Exception {
        FakeRuntime runtime = new FakeRuntime();
        runtime.failSnapshot = true;
        ConnectorResult result = execute(runtime, "instagram.reel.collect_signals", new JSONObject());
        JSONObject output = new JSONObject(result.outputJson());

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals(List.of("snapshot", "capture", "ocr"), runtime.calls);
        assertTrue(!output.getBoolean("snapshotAvailable"));
        assertEquals("UNKNOWN_VISUAL", output.getString("pageType"));
        assertEquals("UI_DUMP_IDLE_TIMEOUT", output.getJSONObject("snapshotFailure").getString("code"));
        assertEquals("capture-1", output.getJSONArray("frames").getJSONObject(0)
                .getJSONObject("capture").getString("imageToken"));
    }

    /**
     * 输入：frameCount、intervalMs、includeVisibleText、includeOcr。
     * 输出：多帧采样结果。
     * 作用：确认接口支持保留多帧扩展参数。
     */
    @Test
    public void reelCollectSignalsSupportsMultipleFrames() throws Exception {
        FakeRuntime runtime = new FakeRuntime();
        ConnectorResult result = execute(runtime, "instagram.reel.collect_signals", new JSONObject()
                .put("frameCount", 2)
                .put("intervalMs", 1)
                .put("includeVisibleText", false)
                .put("includeOcr", false));
        JSONObject output = new JSONObject(result.outputJson());

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals(List.of("snapshot", "capture", "capture"), runtime.calls);
        assertEquals(2, output.getJSONArray("frames").length());
        assertEquals("capture-2", output.getJSONArray("frames").getJSONObject(1)
                .getJSONObject("capture").getString("imageToken"));
        assertTrue(!output.has("visibleText"));
        assertTrue(!output.getJSONArray("frames").getJSONObject(0).has("ocr"));
    }

    /**
     * 输入：keyword。
     * 输出：search.input 成功断言。
     * 作用：确认关键词输入并提交搜索。
     */
    @Test
    public void searchInputSubmitsKeyword() throws Exception {
        FakeRuntime runtime = new FakeRuntime();
        runtime.currentPageFingerprint = "instagram-search-page";
        ConnectorResult result = execute(runtime, "instagram.search.input", new JSONObject()
                .put("keyword", "exo"));

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals(List.of("query", "input", "submit", "query"), runtime.calls);
        assertEquals("exo", runtime.lastInput.getString("text"));
        assertEquals("/search/input", runtime.lastSubmit.getString("targetPath"));
    }

    /**
     * 输入：搜索结果页。
     * 输出：open_first_reel 成功断言。
     * 作用：确认优先点击 Reel / Video 搜索结果。
     */
    @Test
    public void searchOpenFirstReelClicksFirstVideo() throws Exception {
        FakeRuntime runtime = new FakeRuntime();
        runtime.currentPageFingerprint = "instagram-search-results";
        ConnectorResult result = execute(runtime, "instagram.search.open_first_reel", new JSONObject());

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals(List.of("query", "click", "snapshot"), runtime.calls);
        assertEquals("/results/reel-1", runtime.lastClick.getString("targetPath"));
    }

    /**
     * 输入：打开 Reel 后 XML dump 不可用。
     * 输出：open_first_reel 用截图完成降级确认。
     * 作用：避免 Reel 自动播放让页面确认阶段直接失败。
     */
    @Test
    public void searchOpenFirstReelFallsBackToCaptureWhenSnapshotUnavailable() throws Exception {
        FakeRuntime runtime = new FakeRuntime();
        runtime.currentPageFingerprint = "instagram-search-results";
        runtime.failSnapshot = true;
        ConnectorResult result = execute(runtime, "instagram.search.open_first_reel", new JSONObject());
        JSONObject output = new JSONObject(result.outputJson());

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals(List.of("query", "click", "snapshot", "capture"), runtime.calls);
        assertEquals("REEL_VIEWER", output.getJSONObject("viewer").getString("pageType"));
        assertTrue(!output.getJSONObject("viewer").getBoolean("snapshotAvailable"));
        assertEquals("capture_after_snapshot_unavailable",
                output.getJSONObject("viewer").getString("verificationStrategy"));
    }

    /**
     * 输入：Reel 页面。
     * 输出：like 成功断言。
     * 作用：确认当前视频 Like 按钮被点击。
     */
    @Test
    public void reelLikeChecksStateClicksAndRechecks() throws Exception {
        FakeRuntime runtime = new FakeRuntime();
        runtime.currentPageFingerprint = "instagram-reel-page";
        ConnectorResult result = execute(runtime, "instagram.reel.like", new JSONObject());
        JSONObject output = new JSONObject(result.outputJson());

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals(List.of("query", "click", "query"), runtime.calls);
        assertEquals("/reel/like", runtime.lastClick.getString("targetPath"));
        assertTrue(output.getBoolean("performed"));
        assertTrue(output.getBoolean("afterLiked"));
    }

    /**
     * 输入：已经点赞的 Reel 页面。
     * 输出：like 跳过点击。
     * 作用：确认 Like 操作是幂等语义，不会误取消红心。
     */
    @Test
    public void reelLikeSkipsWhenAlreadyLiked() throws Exception {
        FakeRuntime runtime = new FakeRuntime();
        runtime.currentPageFingerprint = "instagram-reel-page";
        runtime.liked = true;
        ConnectorResult result = execute(runtime, "instagram.reel.like", new JSONObject());
        JSONObject output = new JSONObject(result.outputJson());

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals(List.of("query"), runtime.calls);
        assertTrue(!output.getBoolean("performed"));
        assertTrue(output.getBoolean("alreadyLiked"));
    }

    /**
     * 输入：评论文本。
     * 输出：comment 成功断言。
     * 作用：确认评论弹层打开、文本输入、点击 Post，并关闭评论弹窗。
     */
    @Test
    public void reelCommentInputsTextAndClicksPost() throws Exception {
        FakeRuntime runtime = new FakeRuntime();
        runtime.currentPageFingerprint = "instagram-reel-page";
        ConnectorResult result = execute(runtime, "instagram.reel.comment", new JSONObject()
                .put("commentText", "Great content"));

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals(List.of("query", "query", "input", "query", "click", "snapshot", "scroll", "snapshot"),
                runtime.calls);
        assertEquals("Great content", runtime.lastInput.getString("text"));
        assertEquals("/comment/post", runtime.lastClick.getString("targetPath"));
        assertEquals("backward", runtime.lastScroll.getString("direction"));
        JSONObject output = new JSONObject(result.outputJson());
        assertTrue(output.getJSONObject("close").getBoolean("performed"));
    }

    /**
     * 输入：Reel 页面。
     * 输出：next 成功断言。
     * 作用：确认下一条视频使用 forward scroll。
     */
    @Test
    public void reelNextScrollsForward() throws Exception {
        FakeRuntime runtime = new FakeRuntime();
        ConnectorResult result = execute(runtime, "instagram.reel.next", new JSONObject());

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals(List.of("snapshot", "scroll", "snapshot"), runtime.calls);
        assertEquals("forward", runtime.lastScroll.getString("direction"));
        JSONObject output = new JSONObject(result.outputJson());
        assertTrue(output.getBoolean("changed"));
        assertEquals("instagram-home", output.getString("beforePageFingerprint"));
        assertEquals("instagram-reel-next", output.getString("afterPageFingerprint"));
    }

    /**
     * 输入：滚动后 UI 指纹不变的 Reel 页面。
     * 输出：next 成功但 changed=false。
     * 作用：兼容真实 Reels 视频内容变化但 UIAutomator XML 结构未变化的情况。
     */
    @Test
    public void reelNextSucceedsWhenUiFingerprintDoesNotChange() throws Exception {
        FakeRuntime runtime = new FakeRuntime();
        runtime.keepFingerprintAfterScroll = true;
        ConnectorResult result = execute(runtime, "instagram.reel.next", new JSONObject());
        JSONObject output = new JSONObject(result.outputJson());

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals("forward", runtime.lastScroll.getString("direction"));
        assertTrue(!output.getBoolean("changed"));
        assertEquals(output.getString("beforePageFingerprint"), output.getString("afterPageFingerprint"));
    }

    /**
     * 输入：缺失 keyword。
     * 输出：失败结果。
     * 作用：确认输入边界快速失败且不触碰设备。
     */
    @Test
    public void missingKeywordFailsBeforeTouchingDevice() {
        FakeRuntime runtime = new FakeRuntime();
        ConnectorResult result = execute(runtime, "instagram.search.input", new JSONObject());

        assertEquals(ConnectorResult.Status.FAILED, result.status());
        assertEquals("INSTAGRAM_KEYWORD_REQUIRED", result.code());
        assertTrue(runtime.calls.isEmpty());
    }

    /**
     * 输入：缺失 commentText。
     * 输出：失败结果。
     * 作用：确认评论输入边界快速失败且不触碰设备。
     */
    @Test
    public void missingCommentTextFailsBeforeTouchingDevice() {
        FakeRuntime runtime = new FakeRuntime();
        ConnectorResult result = execute(runtime, "instagram.reel.comment", new JSONObject());

        assertEquals(ConnectorResult.Status.FAILED, result.status());
        assertEquals("INSTAGRAM_COMMENT_TEXT_REQUIRED", result.code());
        assertTrue(runtime.calls.isEmpty());
    }

    /**
     * 输入：无匹配 locator 的 Runtime。
     * 输出：视觉坐标协议未支持错误。
     * 作用：确认 3 次 locator 失败后进入明确兜底失败。
     */
    @Test
    public void reelLikeDoesNotClickWhenStateUnknown() throws Exception {
        FakeRuntime runtime = new FakeRuntime();
        runtime.returnCandidates = false;
        ConnectorResult result = execute(runtime, "instagram.reel.like", new JSONObject());
        JSONObject output = new JSONObject(result.outputJson());

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertTrue(!output.getBoolean("performed"));
        assertEquals("state_unknown_noop", output.getString("strategy"));
        assertEquals(1, runtime.calls.stream().filter("capture"::equals).count());
        assertEquals(4, runtime.calls.stream().filter("query"::equals).count());
    }

    /**
     * 输入：固定 perVideoWatchMs、totalWatchMs 和 preOpenScrollCount 的完整工作流。
     * 输出：完成状态和阶段轨迹。
     * 作用：确认打开 App、搜索、结果页滑动、打开 Reel、连续观看和下一条滚动按顺序执行。
     */
    @Test
    public void reelsEngageWorkflowSearchesScrollsOpensAndContinuouslyWatches() throws Exception {
        FakeRuntime runtime = new FakeRuntime();
        ConnectorResult result = execute(runtime, "instagram.reels.engage_workflow", new JSONObject()
                .put("keyword", "fitness")
                .put("preOpenScrollCount", 2)
                .put("perVideoWatchMs", 1)
                .put("totalWatchMs", 3)
                .put("like", true)
                .put("commentText", "Nice reel"));
        JSONObject output = new JSONObject(result.outputJson());

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals("completed", output.getString("workflowStatus"));
        assertEquals("fitness", output.getString("keyword"));
        assertEquals(2, output.getInt("preOpenScrollCount"));
        assertEquals(1, output.getLong("perVideoWatchMs"));
        assertEquals(3, output.getLong("totalWatchMs"));
        assertEquals(3, output.getLong("watchedMs"));
        assertEquals(3, output.getInt("watchedVideoCount"));
        assertFalse(output.has("likeRequested"));
        assertFalse(output.has("commentRequested"));
        assertFalse(output.has("finalPageFingerprint"));
        assertEquals(List.of(
                "open",
                "query", "click", "query",
                "query", "input", "submit", "query",
                "scroll", "scroll",
                "query", "click", "snapshot",
                "scroll",
                "scroll"), runtime.calls);
        assertEquals("/search/input", runtime.lastInput.getString("targetPath"));
        assertEquals(false, runtime.liked);
    }

    /**
     * 输入：缺失观看时长参数的完整工作流。
     * 输出：失败状态。
     * 作用：确认连续观看时长必须由调用方显式传入。
     */
    @Test
    public void reelsEngageWorkflowRequiresExplicitWatchDurations() throws Exception {
        FakeRuntime runtime = new FakeRuntime();
        ConnectorResult result = execute(runtime, "instagram.reels.engage_workflow", new JSONObject()
                .put("keyword", "fitness")
                .put("totalWatchMs", 3));

        assertEquals(ConnectorResult.Status.FAILED, result.status());
        assertEquals("INSTAGRAM_PER_VIDEO_WATCH_MS_INVALID", result.code());
        assertTrue(result.detail().contains("stage=start"));
        assertTrue(runtime.calls.isEmpty());
    }

    /**
     * 输入：缺失 keyword 的完整工作流。
     * 输出：失败状态。
     * 作用：确认工作流输入边界在触碰设备前失败，且 detail 包含阶段诊断。
     */
    @Test
    public void reelsEngageWorkflowRequiresKeywordBeforeTouchingDevice() {
        FakeRuntime runtime = new FakeRuntime();
        ConnectorResult result = execute(runtime, "instagram.reels.engage_workflow", new JSONObject());

        assertEquals(ConnectorResult.Status.FAILED, result.status());
        assertEquals("INSTAGRAM_WORKFLOW_KEYWORD_REQUIRED", result.code());
        assertTrue(result.detail().contains("stage=start"));
        assertTrue(runtime.calls.isEmpty());
    }

    /**
     * 输入：Runtime、operation 和 input。
     * 输出：ConnectorResult。
     * 作用：构造测试执行请求。
     */
    private ConnectorResult execute(FakeRuntime runtime, String action, JSONObject input) {
        return executeWithDeadline(runtime, action, input, System.currentTimeMillis() + 30_000);
    }

    private ConnectorResult executeWithDeadline(
            FakeRuntime runtime,
            String action,
            JSONObject input,
            long deadlineEpochMillis) {
        return connector.execute(runtime, new ConnectorExecutionRequest(
                "job-1", action, input.toString(), "", deadlineEpochMillis));
    }

    private static final class FakeRuntime implements MobileRuntime {
        private final List<String> calls = new ArrayList<>();
        private String currentPageFingerprint = "instagram-home";
        private boolean returnCandidates = true;
        private JSONObject lastClick;
        private JSONObject lastInput;
        private JSONObject lastSubmit;
        private JSONObject lastScroll;
        private JSONObject lastSnapshot;
        private boolean liked;
        private int captureCount;
        private int scrollCount;
        private boolean keepFingerprintAfterScroll;
        private boolean failSnapshot;

        /**
         * 输入：openApp 请求。
         * 输出：成功 payload。
         * 作用：模拟打开 Instagram。
         */
        @Override
        public CapabilityResult openApp(String requestJson) {
            calls.add("open");
            currentPageFingerprint = "instagram-home";
            return ok(json("opened", true));
        }

        /**
         * 输入：snapshot 请求。
         * 输出：当前页面快照。
         * 作用：模拟 Runtime 页面读取。
         */
        @Override
        public CapabilityResult snapshot(String requestJson) {
            calls.add("snapshot");
            lastSnapshot = jsonObject(requestJson);
            if (failSnapshot) {
                return CapabilityResult.error("UI_DUMP_IDLE_TIMEOUT", "ERROR: could not get idle state.");
            }
            return ok(snapshotPayload());
        }

        /**
         * 输入：query 请求。
         * 输出：候选节点。
         * 作用：按 selector 模拟无障碍查询。
         */
        @Override
        public CapabilityResult query(String requestJson) {
            calls.add("query");
            JSONObject selector = jsonObject(requestJson).optJSONObject("selector");
            if (selector == null) throw new AssertionError("query 请求缺少 selector");
            JSONObject candidate = match(selector);
            JSONArray candidates = new JSONArray();
            if (returnCandidates && candidate != null) candidates.put(candidate);
            return ok(json("pageFingerprint", currentPageFingerprint, "candidates", candidates));
        }

        /**
         * 输入：click 请求。
         * 输出：点击结果。
         * 作用：记录点击目标并推进页面状态。
         */
        @Override
        public CapabilityResult click(String requestJson) {
            calls.add("click");
            lastClick = jsonObject(requestJson);
            if (lastClick.has("x") && lastClick.has("y")) {
                return ok(json("clicked", true, "x", lastClick.optInt("x"), "y", lastClick.optInt("y")));
            }
            String path = lastClick.optString("targetPath");
            if ("/tabs/search".equals(path)) currentPageFingerprint = "instagram-search-page";
            if ("/results/reel-1".equals(path)) currentPageFingerprint = "instagram-reel-page";
            if ("/reel/like".equals(path)) liked = true;
            if ("/reel/comment".equals(path)) currentPageFingerprint = "instagram-comment-sheet";
            if ("/comment/post".equals(path)) currentPageFingerprint = "instagram-comment-sheet-posted";
            return ok(json("clicked", true));
        }

        /**
         * 输入：input 请求。
         * 输出：输入结果。
         * 作用：记录输入文本并推进搜索状态。
         */
        @Override
        public CapabilityResult input(String requestJson) {
            calls.add("input");
            lastInput = jsonObject(requestJson);
            if ("/search/input".equals(lastInput.optString("targetPath"))) {
                currentPageFingerprint = "instagram-search-typed";
            }
            if ("/comment/input".equals(lastInput.optString("targetPath"))) {
                currentPageFingerprint = "instagram-comment-sheet";
            }
            return ok(json("input", true));
        }

        /**
         * 输入：submit 请求。
         * 输出：提交结果。
         * 作用：记录提交目标并进入搜索结果页。
         */
        @Override
        public CapabilityResult submit(String requestJson) {
            calls.add("submit");
            lastSubmit = jsonObject(requestJson);
            currentPageFingerprint = "instagram-search-results";
            return ok(json("submitted", true));
        }

        /**
         * 输入：scroll 请求。
         * 输出：滚动结果。
         * 作用：记录滚动方向并进入下一条 Reel。
         */
        @Override
        public CapabilityResult scroll(String requestJson) {
            calls.add("scroll");
            lastScroll = jsonObject(requestJson);
            scrollCount++;
            if ("backward".equals(lastScroll.optString("direction"))
                    && currentPageFingerprint.startsWith("instagram-comment-sheet")) {
                currentPageFingerprint = "instagram-reel-page";
                return ok(json("scrolled", true));
            }
            if (!keepFingerprintAfterScroll) {
                if (currentPageFingerprint.startsWith("instagram-search-results")) {
                    currentPageFingerprint = "instagram-search-results-scroll-" + scrollCount;
                } else if (scrollCount == 1) {
                    currentPageFingerprint = "instagram-reel-next";
                } else {
                    currentPageFingerprint = "instagram-reel-next-" + scrollCount;
                }
            }
            return ok(json("scrolled", true));
        }

        /**
         * 输入：waitFor 请求。
         * 输出：未使用能力。
         * 作用：测试当前实现不依赖 waitFor。
         */
        @Override
        public CapabilityResult waitFor(String requestJson) {
            calls.add("wait");
            return ok(json("pageFingerprint", currentPageFingerprint, "candidates", new JSONArray()));
        }

        /**
         * 输入：capture 请求。
         * 输出：截图结果。
         * 作用：模拟 locator 失败后的视觉兜底入口。
         */
        @Override
        public CapabilityResult capture(String requestJson) {
            calls.add("capture");
            captureCount++;
            return ok(json("imageToken", "capture-" + captureCount, "width", 1080, "height", 2400));
        }

        /**
         * 输入：ocr 请求。
         * 输出：OCR 结果。
         * 作用：模拟 debug.ocr 能力。
         */
        @Override
        public CapabilityResult ocr(String requestJson) {
            calls.add("ocr");
            JSONArray lines = new JSONArray().put(json("text", "sample ocr", "visualTargetToken", "ocr-token-1"));
            return ok(json("visualPageFingerprint", "visual-1", "lines", lines));
        }

        /**
         * 输入：checkpoint 请求。
         * 输出：未使用能力。
         * 作用：保持 MobileRuntime 接口完整。
         */
        @Override
        public CapabilityResult checkpoint(String requestJson) {
            calls.add("checkpoint");
            return CapabilityResult.error("UNUSED", "checkpoint unused");
        }

        /**
         * 输入：无。
         * 输出：取消状态。
         * 作用：测试默认不中断执行。
         */
        @Override
        public boolean isCancelled() {
            return false;
        }

        /**
         * 输入：selector。
         * 输出：匹配节点或 null。
         * 作用：按实测 Instagram selector 返回目标路径。
         */
        private JSONObject match(JSONObject selector) {
            String resourceId = selector.optString("resourceId");
            String text = selector.optString("text");
            String textContains = selector.optString("textContains");
            String contentDescription = selector.optString("contentDescription");
            String descriptionContains = selector.optString("descriptionContains");
            if ("com.instagram.android:id/search_tab".equals(resourceId)
                    || "Search and explore".equals(contentDescription)) {
                return node("/tabs/search");
            }
            if ("com.instagram.android:id/action_bar_search_edit_text".equals(resourceId)) {
                return node("/search/input");
            }
            if ("For you".equals(text) || "Accounts".equals(text) || "Tags".equals(text)) {
                return node("/search/tab/" + text);
            }
            if ("Reel by".equals(descriptionContains) || "Video by".equals(descriptionContains)
                    || "com.instagram.android:id/grid_card_layout_container".equals(resourceId)) {
                return node("/results/reel-1");
            }
            if ("com.instagram.android:id/image_preview".equals(resourceId)) {
                return node("/results/reel-1");
            }
            if ("com.instagram.android:id/clips_viewer_action_bar_title".equals(resourceId)) {
                return node("/reel/title", "resourceId", resourceId, "text", "Reels");
            }
            if ("com.instagram.android:id/like_button".equals(resourceId)
                    || "Like".equals(contentDescription)
                    || "Liked".equals(contentDescription)
                    || "Unlike".equals(contentDescription)) {
                return node("/reel/like",
                        "resourceId", "com.instagram.android:id/like_button",
                        "contentDescription", liked ? "Unlike" : "Like",
                        "checked", liked,
                        "selected", liked);
            }
            if ("com.instagram.android:id/comment_button".equals(resourceId) || "Comment".equals(contentDescription)) {
                return node("/reel/comment",
                        "resourceId", "com.instagram.android:id/comment_button",
                        "contentDescription", "Comment");
            }
            if ("Add comment".equals(textContains) || "Add comment".equals(descriptionContains)
                    || "com.instagram.android:id/layout_comment_thread_edittext".equals(resourceId)) {
                return node("/comment/input",
                        "resourceId", "com.instagram.android:id/layout_comment_thread_edittext",
                        "text", "Add comment...");
            }
            if ("com.instagram.android:id/layout_comment_thread_post_button_icon".equals(resourceId)
                    || "Post".equals(contentDescription)
                    || "Post".equals(text)) {
                return node("/comment/post",
                        "resourceId", "com.instagram.android:id/layout_comment_thread_post_button_icon",
                        "contentDescription", "Post");
            }
            return null;
        }

        /**
         * 输入：无。
         * 输出：页面快照 JSON。
         * 作用：生成当前页面基础字段。
         */
        private JSONObject snapshotPayload() {
            JSONArray visibleText = currentPageFingerprint.startsWith("instagram-comment-sheet")
                    ? new JSONArray().put("Comments").put("Join the conversation...")
                    : new JSONArray().put("Reels");
            JSONArray nodes = new JSONArray();
            if (currentPageFingerprint.startsWith("instagram-comment-sheet")) {
                nodes.put(node("/comment/title", "text", "Comments"));
                nodes.put(node("/comment/input", "resourceId",
                        "com.instagram.android:id/layout_comment_thread_edittext", "text", "Join the conversation..."));
                nodes.put(node("/comment/post", "resourceId",
                        "com.instagram.android:id/layout_comment_thread_post_button_icon", "contentDescription", "Post"));
            } else if (currentPageFingerprint.startsWith("instagram-reel")) {
                nodes.put(node("/reel/title", "resourceId",
                        "com.instagram.android:id/clips_viewer_action_bar_title", "text", "Reels"));
                nodes.put(node("/reel/like", "resourceId", "com.instagram.android:id/like_button"));
                nodes.put(node("/reel/comment", "resourceId", "com.instagram.android:id/comment_button"));
            }
            return json(
                    "packageName", "com.instagram.android",
                    "pageFingerprint", currentPageFingerprint,
                    "observationId", "observation-1",
                    "capturedAtMs", 1L,
                    "visibleText", visibleText,
                    "nodes", nodes);
        }

        /**
         * 输入：path。
         * 输出：候选节点 JSON。
         * 作用：生成带 path 的候选节点。
         */
        private static JSONObject node(String path) {
            return node(path, new Object[0]);
        }

        private static JSONObject node(String path, Object... pairs) {
            JSONObject value = json("path", path, "targetPath", path);
            try {
                for (int index = 0; index < pairs.length; index += 2) {
                    value.put((String) pairs[index], pairs[index + 1]);
                }
                return value;
            } catch (Exception error) {
                throw new AssertionError(error);
            }
        }

        /**
         * 输入：payload JSON。
         * 输出：成功 CapabilityResult。
         * 作用：简化 FakeRuntime 成功返回。
         */
        private static CapabilityResult ok(JSONObject payload) {
            return CapabilityResult.ok(payload.toString());
        }

        /**
         * 输入：JSON 字符串。
         * 输出：JSONObject。
         * 作用：解析测试请求。
         */
        private static JSONObject jsonObject(String source) {
            try {
                return new JSONObject(source);
            } catch (Exception error) {
                throw new AssertionError(error);
            }
        }

        /**
         * 输入：键值对。
         * 输出：JSONObject。
         * 作用：构造测试 JSON。
         */
        private static JSONObject json(Object... pairs) {
            try {
                JSONObject value = new JSONObject();
                for (int index = 0; index < pairs.length; index += 2) {
                    value.put((String) pairs[index], pairs[index + 1]);
                }
                return value;
            } catch (Exception error) {
                throw new AssertionError(error);
            }
        }
    }
}
