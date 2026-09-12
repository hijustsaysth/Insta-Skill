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
        assertTrue(connector.descriptor().actions().contains("instagram.profile.update"));
    }

    /**
     * 输入：FakeRuntime 首页。
     * 输出：search.open 成功断言。
     * 作用：确认 Search tab 被定位并点击。
     */
    @Test
    public void searchOpenClicksSearchTab() throws Exception {
        FakeRuntime runtime = new BatchFakeRuntime();
        ConnectorResult result = execute(runtime, "instagram.search.open", new JSONObject());

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals(List.of("query", "click", "query"), runtime.calls);
        assertEquals(List.of(2, 1), runtime.querySelectorCounts);
        assertTrue(runtime.queryRequests.get(0).has("selectors"));
        JSONArray searchSelectors = runtime.queryRequests.get(0).getJSONArray("selectors");
        assertEquals("com.instagram.android:id/search_tab",
                searchSelectors.getJSONObject(0).getString("resourceId"));
        assertEquals("Search and explore",
                searchSelectors.getJSONObject(1).getString("contentDescription"));
        assertEquals("/tabs/search", runtime.lastClick.getString("targetPath"));
    }

    /**
     * 输入：只接受旧 selector 载荷的 Runtime。
     * 输出：search.open 仍成功，且不会发送 selectors 字段。
     * 作用：确认 Plugin API v1 的旧 Runtime 不会被批量查询优化破坏。
     */
    @Test
    public void searchOpenKeepsLegacySingleSelectorQueryContract() throws Exception {
        FakeRuntime runtime = new FakeRuntime();
        runtime.hidePrimarySearchTab = true;
        ConnectorResult result = execute(runtime, "instagram.search.open", new JSONObject());

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertFalse(runtime.supportsBatchQuery());
        assertEquals(List.of(1, 1, 1), runtime.querySelectorCounts);
        assertTrue(runtime.queryRequests.stream().allMatch(request -> request.has("selector")));
        assertTrue(runtime.queryRequests.stream().noneMatch(request -> request.has("selectors")));
        assertEquals("com.instagram.android:id/search_tab",
                runtime.queryRequests.get(0).getJSONObject("selector").getString("resourceId"));
        assertEquals("Search and explore",
                runtime.queryRequests.get(1).getJSONObject("selector").getString("contentDescription"));
        assertEquals("/tabs/search-fallback", runtime.lastClick.getString("targetPath"));
    }

    /**
     * 输入：所有 Search tab locator 都不匹配的页面。
     * 输出：每轮重试只发起一次批量 query。
     * 作用：确认候选 selector 共享页面采集，但重试边界仍会重新校验。
     */
    @Test
    public void searchOpenBatchesCandidateValidationPerRetry() {
        FakeRuntime runtime = new BatchFakeRuntime();
        runtime.returnCandidates = false;
        ConnectorResult result = execute(runtime, "instagram.search.open", new JSONObject());

        assertEquals(ConnectorResult.Status.FAILED, result.status());
        assertEquals("INSTAGRAM_VISUAL_COORDINATE_UNSUPPORTED", result.code());
        assertEquals(3, runtime.calls.stream().filter("query"::equals).count());
        assertEquals(List.of(2, 2, 2), runtime.querySelectorCounts);
        assertEquals(1, runtime.calls.stream().filter("capture"::equals).count());
    }

    /**
     * 输入：query capability 返回失败。
     * 输出：立即保留 Runtime 错误，不继续重试或视觉兜底。
     * 作用：确认批量查询不会掩盖真实运行时失败。
     */
    @Test
    public void searchOpenStopsOnBatchQueryFailure() {
        FakeRuntime runtime = new BatchFakeRuntime();
        runtime.failQuery = true;
        ConnectorResult result = execute(runtime, "instagram.search.open", new JSONObject());

        assertEquals(ConnectorResult.Status.FAILED, result.status());
        assertEquals("UI_QUERY_FAILED", result.code());
        assertEquals(1, runtime.calls.stream().filter("query"::equals).count());
        assertEquals(0, runtime.calls.stream().filter("capture"::equals).count());
    }

    /**
     * 输入：FakeRuntime 当前截图。
     * 输出：debug.ocr 成功断言。
     * 作用：确认调试 OCR 能力会透传给 Runtime。
     */
    @Test
    public void debugOcrCallsRuntimeOcr() {
        FakeRuntime runtime = new BatchFakeRuntime();
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
        FakeRuntime runtime = new BatchFakeRuntime();
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
        FakeRuntime runtime = new BatchFakeRuntime();
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
        FakeRuntime runtime = new BatchFakeRuntime();
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
        FakeRuntime runtime = new BatchFakeRuntime();
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
        FakeRuntime runtime = new BatchFakeRuntime();
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
     * 输入：开启日志包装的批量 Runtime。
     * 输出：包装后仍声明支持批量 query。
     * 作用：确认诊断拦截层不会意外关闭性能优化能力。
     */
    @Test
    public void consoleLoggerPreservesBatchQueryCapability() {
        System.setProperty("instagram.connector.consoleLog", "true");
        try {
            MobileRuntime wrapped = InstagramConnectorConsoleLogger.fromSettings("job-1")
                    .wrap(new BatchFakeRuntime());
            assertTrue(wrapped.supportsBatchQuery());
        } finally {
            System.clearProperty("instagram.connector.consoleLog");
        }
    }

    /**
     * 输入：默认 collect_signals 参数。
     * 输出：单帧采样结果。
     * 作用：确认默认返回页面文本、截图和 OCR 文本。
     */
    @Test
    public void reelCollectSignalsUsesSingleFrameByDefault() throws Exception {
        FakeRuntime runtime = new BatchFakeRuntime();
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
        FakeRuntime runtime = new BatchFakeRuntime();
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
        FakeRuntime runtime = new BatchFakeRuntime();
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
        FakeRuntime runtime = new BatchFakeRuntime();
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
        FakeRuntime runtime = new BatchFakeRuntime();
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
        FakeRuntime runtime = new BatchFakeRuntime();
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
        FakeRuntime runtime = new BatchFakeRuntime();
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
        FakeRuntime runtime = new BatchFakeRuntime();
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
        FakeRuntime runtime = new BatchFakeRuntime();
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
        FakeRuntime runtime = new BatchFakeRuntime();
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
        FakeRuntime runtime = new BatchFakeRuntime();
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
        FakeRuntime runtime = new BatchFakeRuntime();
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
        FakeRuntime runtime = new BatchFakeRuntime();
        ConnectorResult result = execute(runtime, "instagram.reel.comment", new JSONObject());

        assertEquals(ConnectorResult.Status.FAILED, result.status());
        assertEquals("INSTAGRAM_COMMENT_TEXT_REQUIRED", result.code());
        assertTrue(runtime.calls.isEmpty());
    }

    /**
     * 输入：空 profile.update 请求。
     * 输出：失败结果。
     * 作用：确认资料更新空输入快速失败且不触碰设备。
     */
    @Test
    public void profileUpdateEmptyInputFailsBeforeTouchingDevice() throws Exception {
        FakeRuntime runtime = new BatchFakeRuntime();
        ConnectorResult result = execute(runtime, "instagram.profile.update", new JSONObject()
                .put("displayName", " ")
                .put("username", "")
                .put("bio", "")
                .put("avatarUrl", ""));

        assertEquals(ConnectorResult.Status.FAILED, result.status());
        assertEquals("INSTAGRAM_PROFILE_UPDATE_EMPTY", result.code());
        assertTrue(runtime.calls.isEmpty());
    }

    /**
     * 输入：只包含 displayName 的资料更新。
     * 输出：只更新 Name 字段。
     * 作用：确认局部更新不会触碰 username、bio 或头像流程。
     */
    @Test
    public void profileUpdateDisplayNameOnlyUpdatesNameField() throws Exception {
        FakeRuntime runtime = new BatchFakeRuntime();
        ConnectorResult result = execute(runtime, "instagram.profile.update", new JSONObject()
                .put("displayName", "Tiny Paws"));
        JSONObject output = new JSONObject(result.outputJson());

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals("instagram.profile.update", output.getString("action"));
        assertEquals("displayName", output.getJSONArray("updatedFields").getString(0));
        assertEquals(1, output.getJSONArray("updatedFields").length());
        assertEquals(List.of("Tiny Paws"), runtime.inputTexts);
        assertEquals(List.of(true), runtime.inputReplaceFlags);
        assertTrue(output.getJSONArray("steps")
                .getJSONObject(3)
                .getJSONObject("result")
                .getJSONObject("confirmation")
                .getBoolean("present"));
        assertTrue(runtime.clickPaths.contains("/profile/full-name"));
        assertTrue(runtime.clickPaths.contains("/profile/name-confirm"));
        assertTrue(!runtime.clickPaths.contains("/profile/username"));
        assertTrue(!runtime.clickPaths.contains("/profile/bio"));
        assertTrue(!runtime.clickPaths.contains("/profile/change-avatar"));
    }

    /**
     * 输入：username 和 bio。
     * 输出：只更新 Username 和 Bio 字段。
     * 作用：确认多个非空字段按局部更新规则执行。
     */
    @Test
    public void profileUpdateUsernameAndBioUpdatesOnlyThoseFields() throws Exception {
        FakeRuntime runtime = new BatchFakeRuntime();
        ConnectorResult result = execute(runtime, "instagram.profile.update", new JSONObject()
                .put("username", "tinypaws")
                .put("bio", "Daily cozy pet moments."));
        JSONObject output = new JSONObject(result.outputJson());

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals("username", output.getJSONArray("updatedFields").getString(0));
        assertEquals("bio", output.getJSONArray("updatedFields").getString(1));
        assertEquals(List.of("tinypaws", "Daily cozy pet moments."), runtime.inputTexts);
        assertEquals(List.of(true, true), runtime.inputReplaceFlags);
        assertTrue(output.getJSONArray("steps")
                .getJSONObject(3)
                .getJSONObject("result")
                .getJSONObject("confirmation")
                .getBoolean("present"));
        assertTrue(!runtime.clickPaths.contains("/profile/full-name"));
        assertTrue(runtime.clickPaths.contains("/profile/username"));
        assertTrue(runtime.clickPaths.contains("/profile/name-confirm"));
        assertTrue(runtime.clickPaths.contains("/profile/bio"));
    }

    /**
     * 输入：保持在 Edit profile 表单页内联编辑的 Bio 更新。
     * 输出：按 Bio 行 bounds 选中同一行内层输入框。
     * 作用：防止多个 prism_form_field_container 场景下误把 Bio 文本写到 Name 字段。
     */
    @Test
    public void profileUpdateBioUsesMatchingInlineFieldWhenFormStaysOpen() throws Exception {
        FakeRuntime runtime = new BatchFakeRuntime();
        runtime.keepProfileEditorInline = true;
        ConnectorResult result = execute(runtime, "instagram.profile.update", new JSONObject()
                .put("bio", "hahaha"));
        JSONObject output = new JSONObject(result.outputJson());
        JSONObject updateBio = output.getJSONArray("steps").getJSONObject(3).getJSONObject("result");

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals("inline_profile_form", updateBio.getString("editorStrategy"));
        assertEquals("/profile/bio-value", updateBio.getJSONObject("editor").getString("targetPath"));
        assertEquals(List.of("hahaha"), runtime.inputTexts);
        assertEquals(List.of("/profile/bio-value"), runtime.inputTargetPaths);
        assertTrue(!runtime.inputTargetPaths.contains("/profile/full-name-value"));
    }

    /**
     * 输入：avatarUrl。
     * 输出：执行头像相册选择链路。
     * 作用：确认头像更新使用采集到的头像入口、相册入口、首图和 Done 节点。
     */
    @Test
    public void profileUpdateAvatarUsesGalleryFlow() throws Exception {
        FakeRuntime runtime = new BatchFakeRuntime();
        ConnectorResult result = execute(runtime, "instagram.profile.update", new JSONObject()
                .put("avatarUrl", "https://example.com/avatar.jpg"));
        JSONObject output = new JSONObject(result.outputJson());

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals("avatar", output.getJSONArray("updatedFields").getString(0));
        assertEquals("media.prepare", runtime.checkpointRequests.get(0).getString("type"));
        assertEquals("https://example.com/avatar.jpg", runtime.checkpointRequests.get(0).getString("url"));
        assertTrue(runtime.clickPaths.contains("/profile/change-avatar"));
        assertTrue(runtime.clickPaths.contains("/avatar/library"));
        assertTrue(runtime.clickPaths.contains("/avatar/gallery/item-1"));
        assertTrue(runtime.clickPaths.contains("/avatar/gallery/done"));
        assertEquals("instagram-edit-profile", runtime.currentPageFingerprint);
    }

    /**
     * 输入：avatarUrl 为本地图片路径。
     * 输出：media.prepare 使用 localPath。
     * 作用：确认头像来源支持 host 本地图片。
     */
    @Test
    public void profileUpdateAvatarAcceptsLocalImagePath() throws Exception {
        FakeRuntime runtime = new BatchFakeRuntime();
        ConnectorResult result = execute(runtime, "instagram.profile.update", new JSONObject()
                .put("avatarUrl", "F:\\avatar\\profile.jpg"));

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertEquals("media.prepare", runtime.checkpointRequests.get(0).getString("type"));
        assertEquals("F:\\avatar\\profile.jpg", runtime.checkpointRequests.get(0).getString("localPath"));
        assertTrue(!runtime.checkpointRequests.get(0).has("url"));
    }

    /**
     * 输入：缺少 Edit profile 节点的 Runtime。
     * 输出：阶段化失败。
     * 作用：确认资料更新在关键页面节点缺失时快速失败。
     */
    @Test
    public void profileUpdateFailsWhenEditProfileButtonMissing() throws Exception {
        FakeRuntime runtime = new BatchFakeRuntime();
        runtime.hideEditProfile = true;
        ConnectorResult result = execute(runtime, "instagram.profile.update", new JSONObject()
                .put("displayName", "Tiny Paws"));

        assertEquals(ConnectorResult.Status.FAILED, result.status());
        assertEquals("INSTAGRAM_EDIT_PROFILE_BUTTON_NOT_FOUND", result.code());
        assertTrue(result.detail().contains("stage=open_profile"));
    }

    /**
     * 输入：无匹配 locator 的 Runtime。
     * 输出：视觉坐标协议未支持错误。
     * 作用：确认 3 次 locator 失败后进入明确兜底失败。
     */
    @Test
    public void reelLikeDoesNotClickWhenStateUnknown() throws Exception {
        FakeRuntime runtime = new BatchFakeRuntime();
        runtime.returnCandidates = false;
        ConnectorResult result = execute(runtime, "instagram.reel.like", new JSONObject());
        JSONObject output = new JSONObject(result.outputJson());

        assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
        assertTrue(!output.getBoolean("performed"));
        assertEquals("state_unknown_noop", output.getString("strategy"));
        assertEquals(1, runtime.calls.stream().filter("capture"::equals).count());
        assertEquals(1, runtime.calls.stream().filter("query"::equals).count());
        assertEquals(List.of(4), runtime.querySelectorCounts);
    }

    /**
     * 输入：固定 perVideoWatchMs、totalWatchMs 和 preOpenScrollCount 的完整工作流。
     * 输出：完成状态和阶段轨迹。
     * 作用：确认打开 App、搜索、结果页滑动、打开 Reel、连续观看和下一条滚动按顺序执行。
     */
    @Test
    public void reelsEngageWorkflowSearchesScrollsOpensAndContinuouslyWatches() throws Exception {
        FakeRuntime runtime = new BatchFakeRuntime();
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
        FakeRuntime runtime = new BatchFakeRuntime();
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
        FakeRuntime runtime = new BatchFakeRuntime();
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

    private static final class BatchFakeRuntime extends FakeRuntime {
        /**
         * 输入：无。
         * 输出：true。
         * 作用：让性能回归测试显式启用批量 query 协议。
         */
        @Override
        public boolean supportsBatchQuery() {
            return true;
        }
    }

    private static class FakeRuntime implements MobileRuntime {
        private final List<String> calls = new ArrayList<>();
        private final List<String> clickPaths = new ArrayList<>();
        private final List<String> inputTexts = new ArrayList<>();
        private final List<String> inputTargetPaths = new ArrayList<>();
        private final List<Boolean> inputReplaceFlags = new ArrayList<>();
        private final List<JSONObject> checkpointRequests = new ArrayList<>();
        private final List<Integer> querySelectorCounts = new ArrayList<>();
        private final List<JSONObject> queryRequests = new ArrayList<>();
        private String currentPageFingerprint = "instagram-home";
        private boolean returnCandidates = true;
        private boolean hidePrimarySearchTab;
        private boolean hideEditProfile;
        private boolean keepProfileEditorInline;
        private JSONObject lastClick;
        private JSONObject lastInput;
        private JSONObject lastSubmit;
        private JSONObject lastScroll;
        private JSONObject lastSnapshot;
        private boolean liked;
        private String activeProfileField = "";
        private int captureCount;
        private int scrollCount;
        private boolean keepFingerprintAfterScroll;
        private boolean failSnapshot;
        private boolean failQuery;

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
            JSONObject request = jsonObject(requestJson);
            queryRequests.add(request);
            JSONArray selectors = request.optJSONArray("selectors");
            if (selectors != null && !supportsBatchQuery()) {
                throw new AssertionError("legacy query 不支持 selectors");
            }
            if (selectors == null) {
                JSONObject selector = request.optJSONObject("selector");
                if (selector == null) throw new AssertionError("query 请求缺少 selector");
                selectors = new JSONArray().put(selector);
            }
            querySelectorCounts.add(selectors.length());
            if (failQuery) return CapabilityResult.error("UI_QUERY_FAILED", "query failed");
            JSONArray candidates = new JSONArray();
            if (returnCandidates) {
                for (int index = 0; index < selectors.length(); index++) {
                    JSONObject candidate = match(selectors.getJSONObject(index));
                    if (candidate == null) continue;
                    candidates.put(candidate);
                    break;
                }
            }
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
            clickPaths.add(path);
            if ("/tabs/search".equals(path) || "/tabs/search-fallback".equals(path)) {
                currentPageFingerprint = "instagram-search-page";
            }
            if ("/tabs/profile".equals(path)) currentPageFingerprint = "instagram-profile";
            if ("/profile/edit".equals(path)) currentPageFingerprint = "instagram-edit-profile";
            if ("/profile/full-name".equals(path)) {
                activeProfileField = "displayName";
                if (!keepProfileEditorInline) currentPageFingerprint = "instagram-edit-name";
            }
            if ("/profile/username".equals(path)) {
                activeProfileField = "username";
                if (!keepProfileEditorInline) currentPageFingerprint = "instagram-edit-username";
            }
            if ("/profile/bio".equals(path)) {
                activeProfileField = "bio";
                if (!keepProfileEditorInline) currentPageFingerprint = "instagram-edit-bio";
            }
            if ("/profile/field-done".equals(path)) {
                currentPageFingerprint = ("displayName".equals(activeProfileField) || "username".equals(activeProfileField))
                        ? "edit-profile-name-confirm"
                        : "instagram-edit-profile";
            }
            if ("/profile/name-confirm".equals(path)) currentPageFingerprint = "instagram-edit-profile";
            if ("/profile/change-avatar".equals(path)) currentPageFingerprint = "instagram-avatar-sheet";
            if ("/avatar/library".equals(path)) currentPageFingerprint = "instagram-avatar-gallery";
            if ("/avatar/gallery/item-1".equals(path)) currentPageFingerprint = "instagram-avatar-gallery";
            if ("/avatar/gallery/done".equals(path)) currentPageFingerprint = "instagram-edit-profile";
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
            inputTexts.add(lastInput.optString("text"));
            inputTargetPaths.add(lastInput.optString("targetPath"));
            inputReplaceFlags.add(lastInput.optBoolean("replace", false));
            if ("/search/input".equals(lastInput.optString("targetPath"))) {
                currentPageFingerprint = "instagram-search-typed";
            }
            if (lastInput.optString("targetPath").startsWith("/profile/full-name")) {
                currentPageFingerprint = "instagram-edit-name";
            }
            if (lastInput.optString("targetPath").startsWith("/profile/username")) {
                currentPageFingerprint = "instagram-edit-username";
            }
            if (lastInput.optString("targetPath").startsWith("/profile/bio")) {
                currentPageFingerprint = "instagram-edit-bio";
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
            JSONObject input = jsonObject(requestJson);
            checkpointRequests.add(input);
            if ("media.prepare".equals(input.optString("type"))) {
                return ok(json(
                        "prepared", true,
                        "type", "media.prepare",
                        "remotePath", "/sdcard/Pictures/aiwos/avatar.jpg"));
            }
            return ok(json("checkpointed", true, "checkpointJson", input));
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
            if (!hidePrimarySearchTab && "com.instagram.android:id/search_tab".equals(resourceId)) {
                return node("/tabs/search");
            }
            if ("Search and explore".equals(contentDescription)) return node("/tabs/search-fallback");
            if ("com.instagram.android:id/action_bar_search_edit_text".equals(resourceId)) {
                return node("/search/input");
            }
            if ("com.instagram.android:id/profile_tab".equals(resourceId) || "Profile".equals(contentDescription)) {
                return node("/tabs/profile", "resourceId", "com.instagram.android:id/profile_tab", "contentDescription", "Profile");
            }
            if (!hideEditProfile && currentPageFingerprint.equals("instagram-profile")
                    && ("Edit profile".equals(contentDescription) || "Edit profile".equals(text))) {
                return node("/profile/edit", "contentDescription", "Edit profile");
            }
            if (currentPageFingerprint.equals("instagram-edit-profile")
                    && ("Edit profile".equals(contentDescription) || "Edit profile".equals(text))) {
                return node("/profile/editor/title", "contentDescription", "Edit profile", "text", "Edit profile");
            }
            if (currentPageFingerprint.equals("instagram-edit-profile")
                    && "com.instagram.android:id/full_name".equals(resourceId)) {
                return node("/profile/full-name",
                        "resourceId", resourceId,
                        "className", "android.widget.Button",
                        "clickable", true,
                        "bounds", bounds(653, 0, 823, 1080));
            }
            if (currentPageFingerprint.equals("instagram-edit-profile")
                    && "com.instagram.android:id/username".equals(resourceId)) {
                return node("/profile/username",
                        "resourceId", resourceId,
                        "className", "android.view.ViewGroup",
                        "clickable", false,
                        "bounds", bounds(823, 0, 993, 1080));
            }
            if (currentPageFingerprint.equals("instagram-edit-profile")
                    && "com.instagram.android:id/bio".equals(resourceId)) {
                return node("/profile/bio",
                        "resourceId", resourceId,
                        "className", "android.widget.Button",
                        "clickable", true,
                        "bounds", bounds(1163, 0, 1332, 1080));
            }
            if ((currentPageFingerprint.equals("instagram-edit-name")
                    || currentPageFingerprint.equals("instagram-edit-username")
                    || currentPageFingerprint.equals("instagram-edit-bio"))
                    && ("Name".equals(text)
                            || "Username".equals(text)
                            || "Bio".equals(text)
                            || "Name".equals(contentDescription)
                            || "Username".equals(contentDescription)
                            || "Bio".equals(contentDescription))) {
                String title = currentPageFingerprint.equals("instagram-edit-name")
                        ? "Name"
                        : currentPageFingerprint.equals("instagram-edit-username") ? "Username" : "Bio";
                if (title.equals(text) || title.equals(contentDescription)) {
                    return node("/profile/field-title",
                            "resourceId", "com.instagram.android:id/action_bar_title",
                            "text", title,
                            "contentDescription", title);
                }
            }
            if ((currentPageFingerprint.equals("instagram-edit-name")
                    || currentPageFingerprint.equals("instagram-edit-username")
                    || currentPageFingerprint.equals("instagram-edit-bio"))
                    && ("com.instagram.android:id/prism_form_field_container".equals(resourceId)
                            || "android.widget.EditText".equals(selector.optString("className")))) {
                return node("/profile/field-input", "resourceId", "com.instagram.android:id/prism_form_field_container");
            }
            if ((currentPageFingerprint.equals("instagram-edit-name")
                    || currentPageFingerprint.equals("instagram-edit-username")
                    || currentPageFingerprint.equals("instagram-edit-bio"))
                    && "com.instagram.android:id/action_bar_button_action".equals(resourceId)) {
                return node("/profile/field-done",
                        "resourceId", "com.instagram.android:id/action_bar_button_action",
                        "contentDescription", "Done");
            }
            if (currentPageFingerprint.equals("edit-profile-name-confirm")
                    && ("com.instagram.android:id/igds_alert_dialog_primary_button".equals(resourceId)
                            || "Change name".equals(text)
                            || "Confirm".equals(contentDescription))) {
                return node("/profile/name-confirm",
                        "resourceId", "com.instagram.android:id/igds_alert_dialog_primary_button",
                        "text", "Change name");
            }
            if (currentPageFingerprint.equals("instagram-edit-profile")
                    && ("com.instagram.android:id/change_avatar_button".equals(resourceId)
                            || "com.instagram.android:id/profile_pic_imageview".equals(resourceId)
                            || "Edit profile picture".equals(contentDescription))) {
                return node("/profile/change-avatar", "resourceId", "com.instagram.android:id/change_avatar_button");
            }
            if (currentPageFingerprint.equals("instagram-avatar-sheet")
                    && ("Choose from library".equals(contentDescription) || "Choose from library".equals(text))) {
                return node("/avatar/library", "contentDescription", "Choose from library");
            }
            if (currentPageFingerprint.equals("instagram-avatar-gallery")
                    && "com.instagram.android:id/gallery_picker_grid_item_container".equals(resourceId)) {
                return node("/avatar/gallery/item-1",
                        "resourceId", "com.instagram.android:id/gallery_picker_grid_item_container",
                        "contentDescription", "Photo thumbnail, Added on 1 minute ago");
            }
            if (currentPageFingerprint.equals("instagram-avatar-gallery")
                    && "com.instagram.android:id/next_button_textview".equals(resourceId)) {
                return node("/avatar/gallery/done",
                        "resourceId", "com.instagram.android:id/next_button_textview",
                        "text", "Done",
                        "contentDescription", "Done");
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
            } else if (currentPageFingerprint.equals("instagram-profile")) {
                visibleText = new JSONArray().put("Edit profile").put("Moonquake");
                nodes.put(node("/profile/edit", "contentDescription", "Edit profile"));
            } else if (currentPageFingerprint.equals("instagram-edit-profile")) {
                visibleText = new JSONArray().put("Edit profile").put("Name").put("Username").put("Bio");
                nodes.put(node("/profile/editor/title", "text", "Edit profile", "contentDescription", "Edit profile"));
                nodes.put(node("/profile/full-name",
                        "resourceId", "com.instagram.android:id/full_name",
                        "className", "android.widget.Button",
                        "clickable", true,
                        "bounds", bounds(653, 0, 823, 1080)));
                nodes.put(node("/profile/full-name-container",
                        "resourceId", "com.instagram.android:id/prism_form_field_container",
                        "className", "android.widget.EditText",
                        "clickable", true,
                        "bounds", bounds(674, 42, 823, 1038)));
                nodes.put(node("/profile/full-name-value",
                        "className", "android.widget.EditText",
                        "clickable", true,
                        "bounds", bounds(747, 84, 823, 996)));
                nodes.put(node("/profile/username",
                        "resourceId", "com.instagram.android:id/username",
                        "className", "android.view.ViewGroup",
                        "clickable", false,
                        "bounds", bounds(823, 0, 993, 1080)));
                nodes.put(node("/profile/username-container",
                        "resourceId", "com.instagram.android:id/prism_form_field_container",
                        "className", "android.widget.EditText",
                        "clickable", true,
                        "bounds", bounds(844, 42, 993, 1038)));
                nodes.put(node("/profile/username-value",
                        "className", "android.widget.EditText",
                        "clickable", true,
                        "bounds", bounds(917, 84, 993, 996)));
                nodes.put(node("/profile/bio",
                        "resourceId", "com.instagram.android:id/bio",
                        "className", "android.widget.Button",
                        "clickable", true,
                        "bounds", bounds(1163, 0, 1332, 1080)));
                nodes.put(node("/profile/bio-container",
                        "resourceId", "com.instagram.android:id/prism_form_field_container",
                        "className", "android.widget.EditText",
                        "clickable", true,
                        "bounds", bounds(1184, 42, 1332, 1038)));
                nodes.put(node("/profile/bio-value",
                        "className", "android.widget.EditText",
                        "clickable", true,
                        "bounds", bounds(1257, 84, 1332, 996)));
            } else if (currentPageFingerprint.equals("edit-profile-name-confirm")) {
                visibleText = new JSONArray()
                        .put("Are you sure you want to change your name?")
                        .put("Change name")
                        .put("Cancel");
                nodes.put(node("/profile/name-confirm",
                        "resourceId", "com.instagram.android:id/igds_alert_dialog_primary_button",
                        "text", "Change name"));
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

        private static JSONObject bounds(int top, int left, int bottom, int right) {
            return json("top", top, "left", left, "bottom", bottom, "right", right);
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
