package com.aiwos.connectors.instagram;

import com.aiwos.connector.sdk.v1.AndroidConnectorPlugin;
import com.aiwos.connector.sdk.v1.CapabilityResult;
import com.aiwos.connector.sdk.v1.ConnectorDescriptor;
import com.aiwos.connector.sdk.v1.ConnectorExecutionRequest;
import com.aiwos.connector.sdk.v1.ConnectorResult;
import com.aiwos.connector.sdk.v1.MobileRuntime;
import com.aiwos.connector.sdk.v1.ProbeRequest;
import com.aiwos.connector.sdk.v1.ProbeResult;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ThreadLocalRandom;
import org.json.JSONArray;
import org.json.JSONObject;

public final class InstagramConnector implements AndroidConnectorPlugin {
    private static final String PACKAGE_NAME = "com.instagram.android";
    private static final String RID_SEARCH_TAB = "com.instagram.android:id/search_tab";
    private static final String RID_SEARCH_INPUT = "com.instagram.android:id/action_bar_search_edit_text";
    private static final String RID_RESULT_CARD = "com.instagram.android:id/grid_card_layout_container";
    private static final String RID_IMAGE_PREVIEW = "com.instagram.android:id/image_preview";
    private static final String RID_REELS_TITLE = "com.instagram.android:id/clips_viewer_action_bar_title";
    private static final String RID_LIKE = "com.instagram.android:id/like_button";
    private static final String RID_COMMENT = "com.instagram.android:id/comment_button";
    private static final String RID_COMMENT_INPUT = "com.instagram.android:id/layout_comment_thread_edittext";
    private static final String RID_COMMENT_POST = "com.instagram.android:id/layout_comment_thread_post_button_icon";
    private static final String RID_BACKGROUND_DIMMER = "com.instagram.android:id/background_dimmer";
    private static final String RID_PROFILE_TAB = "com.instagram.android:id/profile_tab";
    private static final String RID_EDIT_PROFILE_PICTURE = "com.instagram.android:id/profile_pic_imageview";
    private static final String RID_CHANGE_AVATAR = "com.instagram.android:id/change_avatar_button";
    private static final String RID_PROFILE_FULL_NAME = "com.instagram.android:id/full_name";
    private static final String RID_PROFILE_USERNAME = "com.instagram.android:id/username";
    private static final String RID_PROFILE_BIO = "com.instagram.android:id/bio";
    private static final String RID_PROFILE_FIELD_CONTAINER = "com.instagram.android:id/prism_form_field_container";
    private static final String RID_ACTION_BAR_TITLE = "com.instagram.android:id/action_bar_title";
    private static final String RID_ACTION_DONE = "com.instagram.android:id/action_bar_button_action";
    private static final String RID_PROFILE_NAME_CONFIRM_PRIMARY =
            "com.instagram.android:id/igds_alert_dialog_primary_button";
    private static final String RID_GALLERY_ITEM = "com.instagram.android:id/gallery_picker_grid_item_container";
    private static final String RID_GALLERY_DONE = "com.instagram.android:id/next_button_textview";

    private static final String PAGE_REEL_VIEWER = "REEL_VIEWER";
    private static final String PAGE_COMMENT_SHEET = "COMMENT_SHEET";
    private static final String PAGE_SEARCH_RESULTS = "SEARCH_RESULTS";
    private static final String PAGE_UNKNOWN_INSTAGRAM = "UNKNOWN_INSTAGRAM";
    private static final String LIKE_LIKED = "LIKED";
    private static final String LIKE_UNLIKED = "UNLIKED";
    private static final String LIKE_UNKNOWN = "UNKNOWN";

    private static final int LOCATOR_ATTEMPTS = 3;
    private static final long WAIT_MS = 5_000L;
    private static final long POLL_MS = 150L;

    private static final List<String> OPERATIONS = List.of(
            "instagram.app.open",
            "instagram.debug.snapshot",
            "instagram.debug.ocr",
            "instagram.search.open",
            "instagram.search.input",
            "instagram.search.open_first_reel",
            "instagram.reel.inspect",
            "instagram.reel.collect_signals",
            "instagram.reel.like",
            "instagram.reel.comment",
            "instagram.reel.next",
            "instagram.reels.engage_workflow",
            "instagram.profile.update");

    private static final List<String> CAPABILITIES = List.of(
            "app.open",
            "ui.snapshot",
            "ui.query",
            "ui.click-token",
            "ui.click-coordinate",
            "ui.input-token",
            "ui.submit-token",
            "ui.scroll",
            "ui.wait",
            "ui.capture",
            "vision.ocr");

    /**
     * 输入：无。
     * 输出：Connector 静态描述符。
     * 作用：向 Runtime 声明 Instagram Connector 的版本、动作和能力。
     */
    @Override
    public ConnectorDescriptor descriptor() {
        return new ConnectorDescriptor(
                "instagram.mobile.growth.v1",
                "0.1.0",
                1,
                OPERATIONS,
                CAPABILITIES);
    }

    /**
     * 输入：Runtime 和探测请求。
     * 输出：Plugin API 兼容性结果。
     * 作用：在激活前快速确认 SDK ABI 版本。
     */
    @Override
    public ProbeResult probe(MobileRuntime runtime, ProbeRequest request) {
        return request.pluginApiVersion() == 1
                ? ProbeResult.compatible()
                : ProbeResult.incompatible("PLUGIN_API_MISMATCH", "Instagram Connector requires Plugin API v1");
    }

    /**
     * 输入：Runtime 和单次执行请求。
     * 输出：Connector 执行结果 JSON。
     * 作用：按 operation 分派 Instagram 原子动作。
     */
    @Override
    public ConnectorResult execute(MobileRuntime runtime, ConnectorExecutionRequest request) {
        InstagramConnectorConsoleLogger logger = InstagramConnectorConsoleLogger.fromSettings(request.jobId());
        MobileRuntime loggedRuntime = logger.wrap(runtime);
        long startedAt = System.currentTimeMillis();
        logger.connectorStart(request.action(), request.inputJson(), request.deadlineEpochMillis());
        ConnectorResult result = executeWithLogging(loggedRuntime, request);
        logger.connectorEnd(result, System.currentTimeMillis() - startedAt);
        return result;
    }

    private ConnectorResult executeWithLogging(MobileRuntime runtime, ConnectorExecutionRequest request) {
        try {
            if (runtime.isCancelled()) return ConnectorResult.cancelled("Execution cancelled before Instagram action");
            JSONObject input = new JSONObject(request.inputJson());
            JSONObject output = switch (request.action()) {
                case "instagram.app.open" -> open(runtime, input);
                case "instagram.debug.snapshot" -> debugSnapshot(runtime, input, request.deadlineEpochMillis());
                case "instagram.debug.ocr" -> require(runtime.ocr("{}"), "INSTAGRAM_OCR_FAILED");
                case "instagram.search.open" -> searchOpen(runtime);
                case "instagram.search.input" -> searchInput(runtime, input);
                case "instagram.search.open_first_reel" -> searchOpenFirstReel(runtime);
                case "instagram.reel.inspect" -> reelInspect(runtime, input);
                case "instagram.reel.collect_signals" -> reelCollectSignals(runtime, input);
                case "instagram.reel.like" -> reelLike(runtime, input);
                case "instagram.reel.comment" -> reelComment(runtime, input);
                case "instagram.reel.next" -> reelNext(runtime);
                case "instagram.reels.engage_workflow" -> reelsEngageWorkflow(
                        runtime, input, request.deadlineEpochMillis());
                case "instagram.profile.update" -> profileUpdate(runtime, input);
                default -> throw new ConnectorFailure("ACTION_UNSUPPORTED", request.action());
            };
            return ConnectorResult.succeeded(output.toString());
        } catch (ConnectorFailure failure) {
            return ConnectorResult.failed(failure.code, failure.getMessage());
        } catch (Exception error) {
            return ConnectorResult.failed("INSTAGRAM_CONNECTOR_ERROR", error.getMessage());
        }
    }

    /**
     * 输入：无。
     * 输出：无。
     * 作用：释放 Connector 自有资源；当前实现无持有资源。
     */
    @Override
    public void shutdown() {}

    /**
     * 输入：可选 packageName。
     * 输出：打开 App 的 Runtime 结果。
     * 作用：打开 Instagram，并限制目标包名。
     */
    private JSONObject open(MobileRuntime runtime, JSONObject input) throws Exception {
        String packageName = input.optString("packageName", PACKAGE_NAME);
        if (!PACKAGE_NAME.equals(packageName)) throw new ConnectorFailure("INSTAGRAM_PACKAGE_DENIED", packageName);
        JSONObject opened = require(
                runtime.openApp(new JSONObject().put("packageName", packageName).toString()),
                "INSTAGRAM_OPEN_FAILED");
        return opened.put("packageName", packageName);
    }

    /**
     * 输入：Runtime。
     * 输出：当前 Instagram 页面快照。
     * 作用：读取页面并确认当前活动 App 是 Instagram。
     */
    private JSONObject snapshot(MobileRuntime runtime) throws Exception {
        JSONObject current = require(runtime.snapshot("{}"), "INSTAGRAM_SNAPSHOT_FAILED");
        assertInstagramActive(current);
        return current;
    }

    /**
     * 输入：Runtime 和可选 includeActivity。
     * 输出：调试快照。
     * 作用：默认只返回 UI 快照；需要时再附带可能较慢的 Activity 状态。
     */
    private JSONObject debugSnapshot(MobileRuntime runtime, JSONObject input, long deadlineEpochMillis) throws Exception {
        ensureWorkflowCanContinue(runtime, deadlineEpochMillis, "debug_snapshot");
        JSONObject snapshotRequest = new JSONObject()
                .put("includeActivity", input.optBoolean("includeActivity", false))
                .put("snapshotDeadlineEpochMs", deadlineEpochMillis);
        JSONObject current;
        try {
            current = require(runtime.snapshot(snapshotRequest.toString()), "INSTAGRAM_SNAPSHOT_FAILED");
        } catch (ConnectorFailure failure) {
            if ("UI_SNAPSHOT_DEADLINE_EXCEEDED".equals(failure.code)) {
                throw new ConnectorFailure("INSTAGRAM_EXECUTION_DEADLINE_EXCEEDED", "stage=debug_snapshot");
            }
            if (!isSnapshotUnavailable(failure)) throw failure;
            ensureWorkflowCanContinue(runtime, deadlineEpochMillis, "debug_snapshot_fallback");
            return debugSnapshotVisualFallback(runtime, failure);
        }
        assertInstagramActive(current);
        return current;
    }

    /**
     * 输入：Runtime。
     * 输出：搜索页页面摘要。
     * 作用：从当前页点击底部 Search 入口并等待搜索框出现。
     */
    private JSONObject searchOpen(MobileRuntime runtime) throws Exception {
        // 进入搜索页，后续输入依赖稳定的搜索框节点。
        JSONObject clicked = clickWithRetry(runtime, "search_tab", List.of(
                selector("resourceId", RID_SEARCH_TAB),
                selector("contentDescription", "Search and explore")));
        JSONObject input = waitForResourceId(runtime, RID_SEARCH_INPUT, "INSTAGRAM_SEARCH_INPUT_NOT_FOUND");
        return new JSONObject()
                .put("performed", true)
                .put("action", "instagram.search.open")
                .put("click", clicked)
                .put("searchInput", input);
    }

    /**
     * 输入：keyword。
     * 输出：搜索结果页摘要。
     * 作用：向搜索框输入关键词并提交搜索。
     */
    private JSONObject searchInput(MobileRuntime runtime, JSONObject input) throws Exception {
        String keyword = required(input, "keyword", "INSTAGRAM_KEYWORD_REQUIRED");
        JSONObject editor = waitForResourceId(runtime, RID_SEARCH_INPUT, "INSTAGRAM_SEARCH_INPUT_NOT_FOUND");
        // 输入绑定当前搜索框页面指纹，避免把关键词写入旧页面节点。
        require(runtime.input(new JSONObject()
                .put("targetPath", editor.getString("path"))
                .put("expectedPageFingerprint", editor.getString("pageFingerprint"))
                .put("text", keyword)
                .toString()), "INSTAGRAM_SEARCH_INPUT_FAILED");
        require(runtime.submit(boundRequest(editor).toString()), "INSTAGRAM_SEARCH_SUBMIT_FAILED");
        JSONObject resultPage = waitForAny(runtime, List.of(
                selector("text", "For you"),
                selector("text", "Accounts"),
                selector("text", "Tags")), "INSTAGRAM_SEARCH_RESULTS_NOT_FOUND");
        return new JSONObject()
                .put("performed", true)
                .put("action", "instagram.search.input")
                .put("keyword", keyword)
                .put("resultPage", resultPage);
    }

    /**
     * 输入：Runtime。
     * 输出：打开的 Reel 页面摘要。
     * 作用：在搜索结果页打开第一个 Reel 或 Video 结果。
     */
    private JSONObject searchOpenFirstReel(MobileRuntime runtime) throws Exception {
        JSONObject target = null;
        JSONObject click;
        try {
            target = findFirstVideoResult(runtime);
            click = require(runtime.click(boundRequest(target).toString()), "INSTAGRAM_REEL_OPEN_FAILED")
                    .put("targetName", "search_result_first_reel")
                    .put("strategy", "locator")
                    .put("fallbackUsed", false);
        } catch (ConnectorFailure failure) {
            click = coordinateClick(runtime, "search_result_first_reel", 0.17d, 0.27d, failure);
        }
        JSONObject viewer;
        try {
            viewer = waitForPageType(runtime, PAGE_REEL_VIEWER, "INSTAGRAM_REEL_VIEWER_NOT_FOUND");
        } catch (ConnectorFailure failure) {
            if (!isSnapshotUnavailable(failure)) throw failure;
            viewer = reelViewerVisualFallback(runtime, failure);
        }
        return new JSONObject()
                .put("performed", true)
                .put("action", "instagram.search.open_first_reel")
                .put("selected", target == null ? JSONObject.NULL : target)
                .put("click", click)
                .put("viewer", viewer);
    }

    /**
     * 输入：Runtime。
     * 输出：当前 Reel 的可见信息。
     * 作用：读取当前 Reel 的作者、文案、点赞评论计数等可见文本。
     */
    private JSONObject reelInspect(MobileRuntime runtime, JSONObject input) throws Exception {
        JSONObject current = snapshot(runtime);
        JSONArray nodes = current.optJSONArray("nodes") == null ? new JSONArray() : current.optJSONArray("nodes");
        JSONObject output = new JSONObject()
                .put("performed", true)
                .put("action", "instagram.reel.inspect")
                .put("packageName", current.optString("packageName"))
                .put("pageFingerprint", current.optString("pageFingerprint"))
                .put("observationId", current.optString("observationId"))
                .put("capturedAtMs", current.optLong("capturedAtMs"))
                .put("pageType", detectPageType(current))
                .put("nodeCount", nodes.length())
                .put("likeState", detectLikeStateFromSnapshot(current).state)
                .put("visibleText", current.optJSONArray("visibleText") == null
                        ? new JSONArray() : current.optJSONArray("visibleText"));
        if (input.optBoolean("includeNodes", false)) {
            output.put("nodes", nodes);
        }
        return output;
    }

    /**
     * 输入：frameCount、intervalMs、includeVisibleText、includeOcr。
     * 输出：当前 Reel 的页面文本、OCR 文本和采样帧。
     * 作用：为 Agent 判断视频内容和生成评论提供原始信号。
     */
    private JSONObject reelCollectSignals(MobileRuntime runtime, JSONObject input) throws Exception {
        int frameCount = input.optInt("frameCount", 1);
        long intervalMs = input.optLong("intervalMs", 0L);
        if (frameCount < 1) throw new ConnectorFailure("INSTAGRAM_FRAME_COUNT_INVALID", "frameCount must be >= 1");
        if (intervalMs < 0) throw new ConnectorFailure("INSTAGRAM_INTERVAL_INVALID", "intervalMs must be >= 0");
        boolean includeVisibleText = input.optBoolean("includeVisibleText", true);
        boolean includeOcr = input.optBoolean("includeOcr", true);
        boolean includeNodes = input.optBoolean("includeNodes", false);

        JSONObject current = null;
        ConnectorFailure snapshotFailure = null;
        try {
            current = snapshot(runtime);
        } catch (ConnectorFailure failure) {
            if (!isSnapshotUnavailable(failure)) throw failure;
            snapshotFailure = failure;
        }
        JSONObject firstCapture = null;
        JSONArray frames = new JSONArray();
        for (int index = 0; index < frameCount; index++) {
            if (runtime.isCancelled()) throw new ConnectorFailure("INSTAGRAM_EXECUTION_CANCELLED", "Execution cancelled");
            if (index > 0 && intervalMs > 0) Thread.sleep(intervalMs);

            // 截取当前播放画面，作为内容判断和评论生成的视觉输入。
            JSONObject capture = require(runtime.capture("{}"), "INSTAGRAM_CAPTURE_FAILED");
            JSONObject frame = new JSONObject()
                    .put("index", index)
                    .put("capturedAtMs", System.currentTimeMillis())
                    .put("capture", capture);
            if (index == 0) firstCapture = capture;
            if (includeOcr) {
                JSONObject ocr = require(runtime.ocr("{}"), "INSTAGRAM_OCR_FAILED");
                frame.put("ocr", ocr).put("ocrText", ocrText(ocr));
            }
            frames.put(frame);
        }

        JSONObject output = new JSONObject()
                .put("performed", true)
                .put("action", "instagram.reel.collect_signals")
                .put("packageName", current == null ? PACKAGE_NAME : current.optString("packageName"))
                .put("pageFingerprint", current == null ? "" : current.optString("pageFingerprint"))
                .put("observationId", current == null ? "" : current.optString("observationId"))
                .put("capturedAtMs", current == null ? 0L : current.optLong("capturedAtMs"))
                .put("pageType", current == null ? "UNKNOWN_VISUAL" : detectPageType(current))
                .put("snapshotAvailable", current != null)
                .put("nodeCount", current == null ? 0 : nodeArray(current).length())
                .put("likeState", current == null ? LIKE_UNKNOWN : detectLikeStateFromSnapshot(current).state)
                .put("screenshotPath", firstCapture == null ? "" : firstCapture.optString("imagePath"))
                .put("frameCount", frameCount)
                .put("intervalMs", intervalMs)
                .put("frames", frames);
        if (snapshotFailure != null) {
            output.put("snapshotFailure", new JSONObject()
                    .put("code", snapshotFailure.code)
                    .put("detail", snapshotFailure.getMessage()));
        }
        if (includeVisibleText) {
            output.put("visibleText", current == null || current.optJSONArray("visibleText") == null
                    ? new JSONArray() : current.optJSONArray("visibleText"));
        }
        if (includeNodes && current != null) {
            output.put("nodes", nodeArray(current));
        }
        return output;
    }

    /**
     * 输入：Runtime。
     * 输出：点赞动作结果。
     * 作用：点击当前 Reel 的 Like 按钮。
     */
    private JSONObject reelLike(MobileRuntime runtime, JSONObject input) throws Exception {
        boolean force = input.optBoolean("force", false);
        LikeState before = detectLikeState(runtime, true);
        JSONObject click = null;
        boolean performed = false;

        if (LIKE_LIKED.equals(before.state)) {
            return new JSONObject()
                    .put("performed", false)
                    .put("action", "instagram.reel.like")
                    .put("alreadyLiked", true)
                    .put("beforeLiked", true)
                    .put("afterLiked", true)
                    .put("likeState", before.toJson())
                    .put("strategy", before.strategy);
        }

        if (LIKE_UNLIKED.equals(before.state) || force) {
            if (before.target != null) {
                click = require(runtime.click(boundRequest(before.target).toString()), "INSTAGRAM_REEL_LIKE_FAILED")
                        .put("targetName", "reel_like_button")
                        .put("strategy", "locator")
                        .put("fallbackUsed", false);
            } else {
                click = coordinateClick(runtime, "reel_like_button", 0.92d, 0.56d, null)
                        .put("stateFallbackUsed", true);
            }
            performed = true;
        }

        if (!performed) {
            return new JSONObject()
                    .put("performed", false)
                    .put("action", "instagram.reel.like")
                    .put("alreadyLiked", false)
                    .put("beforeLiked", JSONObject.NULL)
                    .put("afterLiked", JSONObject.NULL)
                    .put("likeState", before.toJson())
                    .put("strategy", "state_unknown_noop")
                    .put("reason", "Like state could not be confirmed; pass force=true to click anyway.");
        }

        LikeState after = detectLikeState(runtime, true);
        return new JSONObject()
                .put("performed", true)
                .put("action", "instagram.reel.like")
                .put("alreadyLiked", false)
                .put("beforeLiked", LIKE_LIKED.equals(before.state))
                .put("afterLiked", LIKE_LIKED.equals(after.state) ? true : JSONObject.NULL)
                .put("beforeLikeState", before.toJson())
                .put("afterLikeState", after.toJson())
                .put("click", click)
                .put("strategy", click.optString("strategy"));
    }

    /**
     * 输入：commentText。
     * 输出：评论动作结果。
     * 作用：打开评论弹层、输入评论并点击 Post。
     */
    private JSONObject reelComment(MobileRuntime runtime, JSONObject input) throws Exception {
        String text = required(input, "commentText", "INSTAGRAM_COMMENT_TEXT_REQUIRED");
        JSONArray steps = new JSONArray();
        JSONObject directEditor = findAny(runtime, List.of(
                selectorLoose("textContains", "Add comment"),
                selectorLoose("descriptionContains", "Add comment"),
                selector("resourceId", RID_COMMENT_INPUT)));
        if (directEditor != null) {
            steps.put(new JSONObject()
                    .put("action", "comment_entry_ready")
                    .put("strategy", "direct_add_comment_textbox")
                    .put("target", directEditor));
        } else {
            JSONObject opened = clickWithRetry(runtime, "reel_comment_button", List.of(
                    selector("resourceId", RID_COMMENT),
                    selector("contentDescription", "Comment")));
            steps.put(new JSONObject().put("action", "open_comment_entry").put("result", opened));
        }

        JSONObject editor;
        try {
            editor = waitForAny(runtime, List.of(
                    selector("resourceId", RID_COMMENT_INPUT),
                    selectorLoose("textContains", "Add comment"),
                    selectorLoose("descriptionContains", "Add comment")), "INSTAGRAM_COMMENT_INPUT_NOT_FOUND");
        } catch (ConnectorFailure failure) {
            JSONObject clickedInput = coordinateClick(runtime, "comment_input_box", 0.50d, 0.92d, failure);
            steps.put(new JSONObject().put("action", "comment_input_coordinate_open").put("result", clickedInput));
            editor = waitForAny(runtime, List.of(
                    selector("resourceId", RID_COMMENT_INPUT),
                    selectorLoose("textContains", "Add comment"),
                    selectorLoose("descriptionContains", "Add comment")), "INSTAGRAM_COMMENT_INPUT_NOT_FOUND");
        }

        require(runtime.input(new JSONObject()
                .put("targetPath", editor.getString("path"))
                .put("expectedPageFingerprint", editor.getString("pageFingerprint"))
                .put("text", text)
                .toString()), "INSTAGRAM_COMMENT_INPUT_FAILED");
        steps.put(new JSONObject().put("action", "comment_input").put("target", editor));

        JSONObject posted = clickWithRetry(runtime, "comment_post_button", List.of(
                selector("resourceId", RID_COMMENT_POST),
                selector("contentDescription", "Post"),
                selector("text", "Post")));
        steps.put(new JSONObject().put("action", "comment_post").put("result", posted));
        JSONObject closed = closeCommentSheet(runtime);
        steps.put(new JSONObject().put("action", "close_comment_sheet").put("result", closed));
        return new JSONObject()
                .put("performed", true)
                .put("action", "instagram.reel.comment")
                .put("commentText", text)
                .put("steps", steps)
                .put("post", posted)
                .put("close", closed);
    }

    /**
     * 输入：Runtime。
     * 输出：滚动动作结果。
     * 作用：滚动到下一条 Reel。
     */
    private JSONObject reelNext(MobileRuntime runtime) throws Exception {
        JSONObject before = snapshot(runtime);
        JSONObject scrolled = scrollForward(runtime, "INSTAGRAM_REEL_SCROLL_FAILED");
        JSONObject after;
        boolean changed = true;
        try {
            after = waitForPageChange(
                    runtime,
                    before.optString("pageFingerprint"),
                    "INSTAGRAM_REEL_NEXT_NOT_CHANGED");
        } catch (ConnectorFailure failure) {
            if (!"INSTAGRAM_REEL_NEXT_NOT_CHANGED".equals(failure.code)) {
                throw new ConnectorFailure(failure.code, new JSONObject()
                        .put("beforePageFingerprint", before.optString("pageFingerprint"))
                        .put("scroll", scrolled)
                        .toString());
            }
            changed = false;
            after = snapshot(runtime);
        }
        return new JSONObject()
                .put("performed", true)
                .put("action", "instagram.reel.next")
                .put("changed", changed)
                .put("scroll", scrolled)
                .put("beforePageFingerprint", before.optString("pageFingerprint"))
                .put("afterPageFingerprint", after.optString("pageFingerprint"));
    }

    /**
     * 输入：displayName、username、bio 和 avatarUrl。
     * 输出：资料更新步骤和实际更新字段。
     * 作用：按非空字段局部修改当前账号资料。
     */
    private JSONObject profileUpdate(MobileRuntime runtime, JSONObject input) throws Exception {
        String displayName = optionalText(input, "displayName");
        String username = optionalText(input, "username");
        String bio = optionalText(input, "bio");
        String avatarUrl = optionalText(input, "avatarUrl");
        if (displayName.isEmpty() && username.isEmpty() && bio.isEmpty() && avatarUrl.isEmpty()) {
            throw new ConnectorFailure("INSTAGRAM_PROFILE_UPDATE_EMPTY", "At least one profile field is required");
        }

        JSONArray steps = new JSONArray();
        JSONArray updatedFields = new JSONArray();
        String stage = "open_app";
        try {
            steps.put(step("instagram.app.open", open(runtime, input)));
            stage = "open_profile";
            steps.put(step(stage, profileOpen(runtime)));
            stage = "open_edit_profile";
            steps.put(step(stage, profileOpenEditor(runtime)));

            if (!avatarUrl.isEmpty()) {
                stage = "update_avatar";
                steps.put(step(stage, profileUpdateAvatar(runtime, avatarUrl)));
                updatedFields.put("avatar");
            }
            if (!displayName.isEmpty()) {
                stage = "update_display_name";
                steps.put(step(stage, profileUpdateTextField(
                        runtime,
                        "displayName",
                        "Name",
                        displayName,
                        selector("resourceId", RID_PROFILE_FULL_NAME),
                        "INSTAGRAM_PROFILE_NAME_FIELD_NOT_FOUND",
                        true)));
                updatedFields.put("displayName");
            }
            if (!username.isEmpty()) {
                stage = "update_username";
                steps.put(step(stage, profileUpdateTextField(
                        runtime,
                        "username",
                        "Username",
                        username,
                        selectorLoose("resourceId", RID_PROFILE_USERNAME),
                        "INSTAGRAM_PROFILE_USERNAME_FIELD_NOT_FOUND",
                        true)));
                updatedFields.put("username");
            }
            if (!bio.isEmpty()) {
                stage = "update_bio";
                steps.put(step(stage, profileUpdateTextField(
                        runtime,
                        "bio",
                        "Bio",
                        bio,
                        selector("resourceId", RID_PROFILE_BIO),
                        "INSTAGRAM_PROFILE_BIO_FIELD_NOT_FOUND",
                        false)));
                updatedFields.put("bio");
            }

            return new JSONObject()
                    .put("performed", true)
                    .put("action", "instagram.profile.update")
                    .put("updatedFields", updatedFields)
                    .put("steps", steps);
        } catch (ConnectorFailure failure) {
            throw workflowFailure(stage, steps.length(), failure);
        }
    }

    /**
     * 输入：Runtime。
     * 输出：个人主页打开结果。
     * 作用：点击底部 Profile tab，进入当前账号主页。
     */
    private JSONObject profileOpen(MobileRuntime runtime) throws Exception {
        JSONObject clicked = clickWithRetry(runtime, "profile_tab", List.of(
                selector("resourceId", RID_PROFILE_TAB),
                selector("contentDescription", "Profile")));
        JSONObject editProfile = waitForAny(runtime, List.of(
                selector("contentDescription", "Edit profile"),
                selector("text", "Edit profile")), "INSTAGRAM_EDIT_PROFILE_BUTTON_NOT_FOUND");
        return new JSONObject()
                .put("performed", true)
                .put("click", clicked)
                .put("editProfile", editProfile);
    }

    /**
     * 输入：Runtime。
     * 输出：编辑资料页打开结果。
     * 作用：从个人主页点击 Edit profile 并等待编辑资料页标题出现。
     */
    private JSONObject profileOpenEditor(MobileRuntime runtime) throws Exception {
        JSONObject clicked = clickWithRetry(runtime, "edit_profile_button", List.of(
                selector("contentDescription", "Edit profile"),
                selector("text", "Edit profile")));
        JSONObject title = waitForAny(runtime, List.of(
                selector("text", "Edit profile"),
                selector("contentDescription", "Edit profile")), "INSTAGRAM_EDIT_PROFILE_PAGE_NOT_FOUND");
        return new JSONObject()
                .put("performed", true)
                .put("click", clicked)
                .put("title", title);
    }

    /**
     * 输入：Runtime、字段名、新文本、字段入口 selector 和失败码。
     * 输出：字段更新结果。
     * 作用：进入单字段编辑页，输入新文本并点击 Done，必要时处理确认弹窗。
     */
    private JSONObject profileUpdateTextField(
            MobileRuntime runtime,
            String field,
            String editorTitle,
            String value,
            JSONObject fieldSelector,
            String fieldFailureCode,
            boolean confirmNameChangeDialog) throws Exception {
        JSONObject fieldEntry = waitForAny(runtime, List.of(fieldSelector), fieldFailureCode);
        JSONObject opened = require(runtime.click(boundRequest(fieldEntry).toString()), fieldFailureCode);
        JSONObject title = null;
        JSONObject editor = findProfileFormFieldInput(runtime, fieldEntry);
        String editorStrategy = "inline_profile_form";
        if (editor == null) {
            title = waitForProfileFieldEditor(runtime, editorTitle);
            editor = waitForAny(runtime, List.of(
                    selector("resourceId", RID_PROFILE_FIELD_CONTAINER),
                    selectorLoose("className", "android.widget.EditText")), "INSTAGRAM_PROFILE_TEXT_FIELD_INPUT_NOT_FOUND");
            editorStrategy = "single_field_editor";
        }
        JSONObject input = require(runtime.input(new JSONObject()
                .put("targetPath", editor.getString("path"))
                .put("expectedPageFingerprint", editor.getString("pageFingerprint"))
                .put("text", value)
                .put("replace", true)
                .toString()), "INSTAGRAM_PROFILE_TEXT_INPUT_FAILED");
        JSONObject doneTarget = waitForResourceId(runtime, RID_ACTION_DONE, "INSTAGRAM_PROFILE_FIELD_DONE_NOT_FOUND");
        JSONObject done = require(runtime.click(boundRequest(doneTarget).toString()), "INSTAGRAM_PROFILE_FIELD_DONE_FAILED");
        JSONObject output = new JSONObject()
                .put("field", field)
                .put("performed", true)
                .put("opened", opened)
                .put("editorStrategy", editorStrategy)
                .put("editor", editor)
                .put("input", input)
                .put("done", done)
                .put("textLength", value.length());
        if (title != null) output.put("title", title);
        if (confirmNameChangeDialog) {
            output.put("confirmation", profileConfirmNameChangeIfPresent(runtime));
        }
        return output;
    }

    /**
     * 输入：Runtime 和编辑资料页字段入口。
     * 输出：同一字段行内的可输入节点，找不到返回 null。
     * 作用：当前 Edit profile 页会暴露多个相同 resource-id 的输入容器，必须按字段行 bounds 选中目标字段。
     */
    private JSONObject findProfileFormFieldInput(MobileRuntime runtime, JSONObject fieldEntry) throws Exception {
        JSONObject current = snapshot(runtime);
        JSONArray nodes = nodeArray(current);
        JSONObject fallback = null;
        for (int index = 0; index < nodes.length(); index++) {
            JSONObject node = nodes.optJSONObject(index);
            if (node == null || !isProfileTextInputInsideField(node, fieldEntry)) continue;
            JSONObject candidate = new JSONObject(node.toString())
                    .put("pageFingerprint", current.getString("pageFingerprint"));
            if (node.optString("resourceId").isEmpty()) return candidate;
            if (fallback == null) fallback = candidate;
        }
        return fallback;
    }

    /**
     * 输入：候选节点和字段入口。
     * 输出：候选是否是字段入口内部的文本输入节点。
     * 作用：用 bounds 关联外层字段入口和内层 EditText，避免输入到其他资料字段。
     */
    private boolean isProfileTextInputInsideField(JSONObject node, JSONObject fieldEntry) {
        if (!"android.widget.EditText".equals(node.optString("className"))) return false;
        if (!node.optBoolean("clickable", false)) return false;
        JSONObject nodeBounds = node.optJSONObject("bounds");
        JSONObject fieldBounds = fieldEntry.optJSONObject("bounds");
        if (nodeBounds == null || fieldBounds == null) return false;
        int centerY = (nodeBounds.optInt("top") + nodeBounds.optInt("bottom")) / 2;
        int centerX = (nodeBounds.optInt("left") + nodeBounds.optInt("right")) / 2;
        return centerY >= fieldBounds.optInt("top")
                && centerY <= fieldBounds.optInt("bottom")
                && centerX >= fieldBounds.optInt("left")
                && centerX <= fieldBounds.optInt("right");
    }

    /**
     * 输入：Runtime 和字段编辑页标题。
     * 输出：字段编辑页标题节点。
     * 作用：确保字段入口点击后已进入目标单字段编辑页，避免误操作编辑资料表单页第一个输入框。
     */
    private JSONObject waitForProfileFieldEditor(MobileRuntime runtime, String editorTitle) throws Exception {
        return waitForAny(runtime, List.of(
                selector("text", editorTitle),
                selector("contentDescription", editorTitle),
                new JSONObject()
                        .put("resourceId", RID_ACTION_BAR_TITLE)
                        .put("text", editorTitle)), "INSTAGRAM_PROFILE_FIELD_EDITOR_NOT_FOUND");
    }

    /**
     * 输入：Runtime。
     * 输出：username/name 变更确认弹窗处理结果。
     * 作用：兼容 Instagram 在字段 Done 后出现的二次确认弹窗。
     */
    private JSONObject profileConfirmNameChangeIfPresent(MobileRuntime runtime) throws Exception {
        List<JSONObject> confirmSelectors = List.of(
                selector("resourceId", RID_PROFILE_NAME_CONFIRM_PRIMARY),
                selector("text", "Change name"),
                selector("contentDescription", "Confirm"));
        List<JSONObject> editProfileSelectors = List.of(
                selector("text", "Edit profile"),
                selector("contentDescription", "Edit profile"));

        long deadline = System.currentTimeMillis() + WAIT_MS;
        while (System.currentTimeMillis() < deadline) {
            if (runtime.isCancelled()) throw new ConnectorFailure("INSTAGRAM_EXECUTION_CANCELLED", "Execution cancelled");
            JSONObject confirmTarget = findAny(runtime, confirmSelectors);
            if (confirmTarget != null) {
                JSONObject confirmed = require(
                        runtime.click(boundRequest(confirmTarget).toString()),
                        "INSTAGRAM_PROFILE_NAME_CONFIRM_FAILED");
                JSONObject editProfile = waitForAny(
                        runtime,
                        editProfileSelectors,
                        "INSTAGRAM_EDIT_PROFILE_PAGE_NOT_FOUND");
                return new JSONObject()
                        .put("present", true)
                        .put("target", confirmTarget)
                        .put("click", confirmed)
                        .put("editProfile", editProfile);
            }

            JSONObject editProfile = findAny(runtime, editProfileSelectors);
            if (editProfile != null) {
                return new JSONObject()
                        .put("present", false)
                        .put("editProfile", editProfile);
            }
            Thread.sleep(POLL_MS);
        }

        throw new ConnectorFailure("INSTAGRAM_PROFILE_NAME_CONFIRM_STATE_NOT_FOUND", confirmSelectors.toString());
    }

    /**
     * 输入：Runtime 和头像 URL。
     * 输出：头像选择流程结果。
     * 作用：从编辑资料页进入头像相册流程并选择最新图片。
     */
    private JSONObject profileUpdateAvatar(MobileRuntime runtime, String avatarUrl) throws Exception {
        JSONArray steps = new JSONArray();
        JSONObject prepared = prepareAvatarMedia(runtime, avatarUrl);
        steps.put(new JSONObject().put("action", "prepare_avatar_media").put("result", prepared));

        JSONObject avatarEntry = waitForAny(runtime, List.of(
                selector("resourceId", RID_CHANGE_AVATAR),
                selector("resourceId", RID_EDIT_PROFILE_PICTURE),
                selector("contentDescription", "Edit profile picture")), "INSTAGRAM_PROFILE_AVATAR_ENTRY_NOT_FOUND");
        JSONObject opened = require(runtime.click(boundRequest(avatarEntry).toString()), "INSTAGRAM_PROFILE_AVATAR_ENTRY_FAILED");
        steps.put(new JSONObject().put("action", "open_avatar_menu").put("result", opened));

        JSONObject library = waitForAny(runtime, List.of(
                selector("contentDescription", "Choose from library"),
                selector("text", "Choose from library")), "INSTAGRAM_PROFILE_AVATAR_LIBRARY_NOT_FOUND");
        JSONObject libraryClicked = require(runtime.click(boundRequest(library).toString()),
                "INSTAGRAM_PROFILE_AVATAR_LIBRARY_FAILED");
        steps.put(new JSONObject().put("action", "choose_from_library").put("result", libraryClicked));

        JSONObject firstPhoto = waitForResourceId(
                runtime,
                RID_GALLERY_ITEM,
                "INSTAGRAM_PROFILE_AVATAR_GALLERY_ITEM_NOT_FOUND");
        JSONObject photoClicked = require(runtime.click(boundRequest(firstPhoto).toString()),
                "INSTAGRAM_PROFILE_AVATAR_GALLERY_ITEM_FAILED");
        steps.put(new JSONObject().put("action", "select_gallery_item").put("result", photoClicked));

        JSONObject doneTarget = waitForResourceId(runtime, RID_GALLERY_DONE, "INSTAGRAM_PROFILE_AVATAR_DONE_NOT_FOUND");
        JSONObject done = require(runtime.click(boundRequest(doneTarget).toString()), "INSTAGRAM_PROFILE_AVATAR_DONE_FAILED");
        steps.put(new JSONObject().put("action", "avatar_done").put("result", done));

        return new JSONObject()
                .put("performed", true)
                .put("avatarUrl", avatarUrl)
                .put("steps", steps);
    }

    /**
     * 输入：Runtime 和头像来源。
     * 输出：媒体准备结果。
     * 作用：通过 checkpoint 复用本地 Runtime 能力，把头像来源放入模拟器相册。
     */
    private JSONObject prepareAvatarMedia(MobileRuntime runtime, String avatarSource) throws Exception {
        JSONObject request = new JSONObject()
                .put("type", "media.prepare")
                .put("mediaType", "image");
        if (isHttpUrl(avatarSource)) {
            request.put("url", avatarSource);
        } else {
            request.put("localPath", avatarSource);
        }
        return require(runtime.checkpoint(request.toString()), "INSTAGRAM_PROFILE_AVATAR_MEDIA_PREPARE_FAILED");
    }

    /**
     * 输入：keyword、perVideoWatchMs、totalWatchMs 和可选 preOpenScrollCount。
     * 输出：完整搜索、浏览、打开 Reel 和连续观看工作流结果。
     * 作用：把 Agent 常用 Instagram Reel 连续观看路径收敛为一个有边界的 Connector operation。
     */
    private JSONObject reelsEngageWorkflow(
            MobileRuntime runtime, JSONObject input, long deadlineEpochMillis) throws Exception {
        long startedAt = System.currentTimeMillis();
        JSONArray steps = new JSONArray();
        String stage = "start";
        try {
            String keyword = required(input, "keyword", "INSTAGRAM_WORKFLOW_KEYWORD_REQUIRED");
            long perVideoWatchMs = requiredBoundedLong(
                    input,
                    "perVideoWatchMs",
                    1L,
                    60_000L,
                    "INSTAGRAM_PER_VIDEO_WATCH_MS_INVALID");
            long totalWatchMs = requiredBoundedLong(
                    input,
                    "totalWatchMs",
                    1L,
                    3_600_000L,
                    "INSTAGRAM_TOTAL_WATCH_MS_INVALID");
            int preOpenScrollCount = preOpenScrollCount(input);

            ensureWorkflowCanContinue(runtime, deadlineEpochMillis, "open_app");
            stage = "open_app";
            steps.put(step("instagram.app.open", open(runtime, input)));

            ensureWorkflowCanContinue(runtime, deadlineEpochMillis, "search_open");
            stage = "search_open";
            steps.put(step("instagram.search.open", searchOpen(runtime)));

            ensureWorkflowCanContinue(runtime, deadlineEpochMillis, "search_input");
            stage = "search_input";
            steps.put(step("instagram.search.input", searchInput(runtime, new JSONObject().put("keyword", keyword))));

            stage = "pre_open_scroll";
            JSONArray preOpenScrolls = new JSONArray();
            for (int index = 0; index < preOpenScrollCount; index++) {
                ensureWorkflowCanContinue(runtime, deadlineEpochMillis, "pre_open_scroll");
                preOpenScrolls.put(new JSONObject()
                        .put("index", index)
                        .put("result", scrollForward(runtime, "INSTAGRAM_SEARCH_RESULTS_SCROLL_FAILED")));
            }
            steps.put(new JSONObject()
                    .put("action", "instagram.search.results.random_scroll")
                    .put("count", preOpenScrollCount)
                    .put("results", preOpenScrolls));

            ensureWorkflowCanContinue(runtime, deadlineEpochMillis, "open_first_reel");
            stage = "open_first_reel";
            steps.put(step("instagram.search.open_first_reel", searchOpenFirstReel(runtime)));

            JSONObject finalScroll = null;
            long watchedMs = 0L;
            int watchedVideoCount = 0;
            while (watchedMs < totalWatchMs) {
                long currentWatchMs = Math.min(perVideoWatchMs, totalWatchMs - watchedMs);
                stage = "watch_reel";
                ensureWorkflowCanContinue(runtime, deadlineEpochMillis, "watch_reel");
                watch(runtime, currentWatchMs, deadlineEpochMillis);
                watchedMs += currentWatchMs;
                watchedVideoCount++;
                steps.put(new JSONObject()
                        .put("action", "instagram.reel.watch")
                        .put("index", watchedVideoCount - 1)
                        .put("watchMs", currentWatchMs)
                        .put("cumulativeWatchMs", watchedMs)
                        .put("performed", currentWatchMs > 0L));

                if (watchedMs < totalWatchMs) {
                    ensureWorkflowCanContinue(runtime, deadlineEpochMillis, "next_reel");
                    stage = "next_reel";
                    finalScroll = workflowNextReel(runtime);
                    steps.put(step("instagram.reel.next", finalScroll));
                }
            }

            JSONObject output = new JSONObject()
                    .put("workflowStatus", "completed")
                    .put("sourceType", "instagram_reels_engage_workflow")
                    .put("keyword", keyword)
                    .put("preOpenScrollCount", preOpenScrollCount)
                    .put("perVideoWatchMs", perVideoWatchMs)
                    .put("totalWatchMs", totalWatchMs)
                    .put("watchedMs", watchedMs)
                    .put("watchedVideoCount", watchedVideoCount)
                    .put("stopReason", "completed")
                    .put("elapsedMs", System.currentTimeMillis() - startedAt)
                    .put("steps", steps);
            if (finalScroll != null) {
                String finalPageFingerprint = finalScroll.optString("afterPageFingerprint").trim();
                if (!finalPageFingerprint.isEmpty()) {
                    output.put("finalPageFingerprint", finalPageFingerprint);
                }
            }
            return output;
        } catch (ConnectorFailure failure) {
            throw workflowFailure(stage, steps.length(), failure);
        }
    }

    /**
     * 输入：Runtime、目标名和候选 selector。
     * 输出：点击能力返回值和使用策略。
     * 作用：按 locator 重查重试 3 次，失败后进入视觉坐标兜底。
     */
    private JSONObject clickWithRetry(
            MobileRuntime runtime, String targetName, List<JSONObject> selectors) throws Exception {
        ConnectorFailure lastFailure = null;
        for (int attempt = 1; attempt <= LOCATOR_ATTEMPTS; attempt++) {
            JSONObject target = findAny(runtime, selectors);
            if (target == null) {
                lastFailure = new ConnectorFailure("INSTAGRAM_TARGET_NOT_FOUND", targetName);
                continue;
            }
            CapabilityResult result = runtime.click(boundRequest(target).toString());
            if (result.isOk()) {
                return new JSONObject(result.payloadJson())
                        .put("targetName", targetName)
                        .put("strategy", "locator")
                        .put("attempts", attempt)
                        .put("fallbackUsed", false);
            }
            lastFailure = new ConnectorFailure(result.code(), result.detail());
        }
        return fallbackClickByScreenshot(runtime, targetName, lastFailure);
    }

    /**
     * 输入：Runtime、目标名和 locator 失败原因。
     * 输出：当前版本不会返回成功。
     * 作用：明确暴露 Runtime 尚未定义坐标点击协议，避免静默假成功。
     */
    private JSONObject fallbackClickByScreenshot(
            MobileRuntime runtime, String targetName, ConnectorFailure cause) throws Exception {
        if ("reel_comment_button".equals(targetName)) {
            return coordinateClick(runtime, targetName, 0.92d, 0.64d, cause);
        }
        if ("comment_input_box".equals(targetName)) {
            return coordinateClick(runtime, targetName, 0.50d, 0.92d, cause);
        }
        if ("comment_post_button".equals(targetName)) {
            return coordinateClick(runtime, targetName, 0.92d, 0.92d, cause);
        }
        if ("search_result_first_reel".equals(targetName)) {
            return coordinateClick(runtime, targetName, 0.17d, 0.27d, cause);
        }
        JSONObject capture = require(runtime.capture("{}"), "INSTAGRAM_CAPTURE_FAILED");
        throw new ConnectorFailure(
                "INSTAGRAM_VISUAL_COORDINATE_UNSUPPORTED",
                "target=" + targetName
                        + "; capture=" + capture
                        + "; lastCode=" + (cause == null ? "" : cause.code)
                        + "; detail=" + (cause == null ? "" : cause.getMessage()));
    }

    /**
     * 输入：Runtime 和 resource-id。
     * 输出：等待到的控件目标。
     * 作用：等待指定 resource-id 的节点出现，并绑定当前页面指纹。
     */
    private JSONObject waitForResourceId(MobileRuntime runtime, String resourceId, String code) throws Exception {
        return waitForAny(runtime, List.of(selector("resourceId", resourceId)), code);
    }

    /**
     * 输入：Runtime、候选 selector 和失败码。
     * 输出：等待到的第一个控件目标。
     * 作用：在有限时间内轮询候选 selector。
     */
    private JSONObject waitForAny(
            MobileRuntime runtime, List<JSONObject> selectors, String failureCode) throws Exception {
        JSONObject target = waitForAnyOrNull(runtime, selectors, WAIT_MS);
        if (target != null) return target;
        throw new ConnectorFailure(failureCode, selectors.toString());
    }

    /**
     * 输入：Runtime、候选 selector 和超时时间。
     * 输出：等待到的第一个控件目标，超时返回 null。
     * 作用：支持可选弹窗探测，不把“未出现”视为失败。
     */
    private JSONObject waitForAnyOrNull(
            MobileRuntime runtime, List<JSONObject> selectors, long timeoutMs) throws Exception {
        long deadline = System.currentTimeMillis() + timeoutMs;
        while (System.currentTimeMillis() < deadline) {
            if (runtime.isCancelled()) throw new ConnectorFailure("INSTAGRAM_EXECUTION_CANCELLED", "Execution cancelled");
            JSONObject target = findAny(runtime, selectors);
            if (target != null) return target;
            Thread.sleep(POLL_MS);
        }
        return null;
    }

    /**
     * 输入：Runtime 和候选 selector。
     * 输出：第一个匹配控件，找不到返回 null。
     * 作用：按顺序查询多个 locator。
     */
    private JSONObject findAny(MobileRuntime runtime, List<JSONObject> selectors) throws Exception {
        JSONObject result = query(runtime, selectors);
        JSONArray candidates = result.optJSONArray("candidates");
        if (candidates != null && candidates.length() > 0) {
            return new JSONObject(candidates.getJSONObject(0).toString())
                    .put("pageFingerprint", result.getString("pageFingerprint"));
        }
        return null;
    }

    /**
     * 输入：Runtime。
     * 输出：第一个 Reel 或 Video 结果节点。
     * 作用：优先打开视频类结果，避免点击账号头部或普通推荐区。
     */
    private JSONObject findFirstVideoResult(MobileRuntime runtime) throws Exception {
        JSONObject reel = findAny(runtime, List.of(selector("descriptionContains", "Reel by")));
        if (reel != null) return reel;
        JSONObject video = findAny(runtime, List.of(selector("descriptionContains", "Video by")));
        if (video != null) return video;
        JSONObject preview = findAny(runtime, List.of(selector("resourceId", RID_IMAGE_PREVIEW)));
        if (preview != null) return preview;
        JSONObject card = findAny(runtime, List.of(selector("resourceId", RID_RESULT_CARD)));
        if (card != null) return card;
        throw new ConnectorFailure("INSTAGRAM_VIDEO_RESULT_NOT_FOUND", "Reel or Video result not found");
    }

    /**
     * 输入：Runtime、目标名、相对坐标和原因。
     * 输出：点击结果。
     * 作用：使用截图尺寸计算安全区域坐标，作为 XML 节点不稳定时的确定性兜底。
     */
    private JSONObject coordinateClick(
            MobileRuntime runtime, String targetName, double relativeX, double relativeY, ConnectorFailure cause)
            throws Exception {
        JSONObject capture = require(runtime.capture("{}"), "INSTAGRAM_CAPTURE_FAILED");
        int width = Math.max(1, capture.optInt("width", 1080));
        int height = Math.max(1, capture.optInt("height", 2400));
        int x = clamp((int) Math.round(width * relativeX), 1, width - 1);
        int y = clamp((int) Math.round(height * relativeY), 1, height - 1);
        JSONObject request = new JSONObject()
                .put("x", x)
                .put("y", y)
                .put("targetName", targetName)
                .put("coordinateSource", "screenshot_bounds")
                .put("capture", capture);
        JSONObject clicked = require(runtime.click(request.toString()), "INSTAGRAM_COORDINATE_CLICK_FAILED");
        return clicked
                .put("targetName", targetName)
                .put("strategy", "coordinate")
                .put("fallbackUsed", true)
                .put("capture", capture)
                .put("lastCode", cause == null ? "" : cause.code)
                .put("lastDetail", cause == null ? "" : cause.getMessage());
    }

    /**
     * 输入：Runtime、目标页面类型和错误码。
     * 输出：检测到的页面快照摘要。
     * 作用：用多信号页面判定替代单一 resource-id 等待。
     */
    private JSONObject waitForPageType(MobileRuntime runtime, String expectedPageType, String failureCode)
            throws Exception {
        long deadline = System.currentTimeMillis() + WAIT_MS;
        JSONObject last = null;
        while (System.currentTimeMillis() < deadline) {
            if (runtime.isCancelled()) throw new ConnectorFailure("INSTAGRAM_EXECUTION_CANCELLED", "Execution cancelled");
            last = snapshot(runtime);
            String pageType = detectPageType(last);
            if (expectedPageType.equals(pageType)) {
                return new JSONObject()
                        .put("pageType", pageType)
                        .put("pageFingerprint", last.optString("pageFingerprint"))
                        .put("observationId", last.optString("observationId"))
                        .put("visibleText", last.optJSONArray("visibleText") == null
                                ? new JSONArray() : last.optJSONArray("visibleText"));
            }
            Thread.sleep(POLL_MS);
        }
        throw new ConnectorFailure(failureCode, last == null ? expectedPageType
                : new JSONObject()
                        .put("expectedPageType", expectedPageType)
                        .put("actualPageType", detectPageType(last))
                        .put("pageFingerprint", last.optString("pageFingerprint"))
                        .toString());
    }

    /**
     * 输入：Runtime 和 XML 采集失败。
     * 输出：基于截图的 Reel 打开结果。
     * 作用：Reel 播放中 UIAutomator 可能无法等待 idle；打开动作不能只依赖 XML 验证。
     */
    private JSONObject reelViewerVisualFallback(MobileRuntime runtime, ConnectorFailure failure) throws Exception {
        JSONObject capture = require(runtime.capture("{}"), "INSTAGRAM_CAPTURE_FAILED");
        return new JSONObject()
                .put("pageType", PAGE_REEL_VIEWER)
                .put("snapshotAvailable", false)
                .put("verificationStrategy", "capture_after_snapshot_unavailable")
                .put("pageFingerprint", "")
                .put("observationId", "")
                .put("visibleText", new JSONArray())
                .put("capture", capture)
                .put("snapshotFailure", new JSONObject()
                        .put("code", failure.code)
                        .put("detail", failure.getMessage()));
    }

    /**
     * 输入：Runtime 和 XML 采集失败。
     * 输出：基于截图的 debug snapshot 兜底结果。
     * 作用：Reel 等动态页面无法 UIAutomator idle 时，仍返回可诊断的视觉证据。
     */
    private JSONObject debugSnapshotVisualFallback(MobileRuntime runtime, ConnectorFailure failure) throws Exception {
        JSONObject capture = require(runtime.capture("{}"), "INSTAGRAM_CAPTURE_FAILED");
        return new JSONObject()
                .put("performed", true)
                .put("action", "instagram.debug.snapshot")
                .put("snapshotAvailable", false)
                .put("verificationStrategy", "capture_after_snapshot_unavailable")
                .put("packageName", PACKAGE_NAME)
                .put("pageType", "UNKNOWN_VISUAL")
                .put("pageFingerprint", "")
                .put("observationId", "")
                .put("visibleText", new JSONArray())
                .put("nodeCount", 0)
                .put("screenshotPath", capture.optString("imagePath"))
                .put("capture", capture)
                .put("snapshotFailure", new JSONObject()
                        .put("code", failure.code)
                        .put("detail", failure.getMessage()));
    }

    /**
     * 输入：ConnectorFailure。
     * 输出：是否属于动态页面 XML 不可用。
     * 作用：只对 UIAutomator dump/pull 类问题降级，其他业务错误继续失败。
     */
    private boolean isSnapshotUnavailable(ConnectorFailure failure) {
        String detail = failure.getMessage() == null ? "" : failure.getMessage();
        return "UI_SNAPSHOT_FAILED".equals(failure.code)
                || "UI_DUMP_IDLE_TIMEOUT".equals(failure.code)
                || "UI_DUMP_FAILED".equals(failure.code)
                || "UI_XML_PULL_FAILED".equals(failure.code)
                || detail.contains("UI_DUMP_IDLE_TIMEOUT")
                || detail.contains("UI_DUMP_FAILED")
                || detail.contains("UI_XML_PULL_FAILED")
                || detail.contains("could not get idle state");
    }

    /**
     * 输入：Runtime 和按优先级排列的 selectors。
     * 输出：Runtime query 结果 JSON。
     * 作用：按 Runtime 显式能力选择批量查询或兼容的单 selector 查询。
     */
    private JSONObject query(MobileRuntime runtime, List<JSONObject> selectors) throws Exception {
        if (BatchQueryCapability.supports(runtime)) {
            return require(
                    runtime.query(new JSONObject().put("selectors", new JSONArray(selectors)).toString()),
                    "INSTAGRAM_QUERY_FAILED");
        }

        JSONObject result = null;
        for (JSONObject selector : selectors) {
            result = require(
                    runtime.query(new JSONObject().put("selector", selector).toString()),
                    "INSTAGRAM_QUERY_FAILED");
            JSONArray candidates = result.optJSONArray("candidates");
            if (candidates != null && candidates.length() > 0) return result;
        }
        return result;
    }

    /**
     * 输入：Runtime 和失败码。
     * 输出：向前滚动结果。
     * 作用：统一 Reels 和搜索结果页的 forward scroll capability 调用。
     */
    private JSONObject scrollForward(MobileRuntime runtime, String failureCode) throws Exception {
        return require(
                runtime.scroll(new JSONObject().put("direction", "forward").toString()),
                failureCode);
    }

    /**
     * 输入：Runtime 和失败码。
     * 输出：向下滑动结果。
     * 作用：关闭 Instagram 评论 bottom sheet，不扩展 Runtime SDK。
     */
    private JSONObject scrollBackward(MobileRuntime runtime, String failureCode) throws Exception {
        return require(
                runtime.scroll(new JSONObject().put("direction", "backward").toString()),
                failureCode);
    }

    /**
     * 输入：Runtime。
     * 输出：连续观看 workflow 的下一条滚动结果。
     * 作用：连续观看不依赖每条 Reel 的 UI dump 指纹确认，避免动态播放页卡住 workflow。
     */
    private JSONObject workflowNextReel(MobileRuntime runtime) throws Exception {
        JSONObject scrolled = scrollForward(runtime, "INSTAGRAM_REEL_SCROLL_FAILED");
        return new JSONObject()
                .put("performed", true)
                .put("action", "instagram.reel.next")
                .put("verificationStrategy", "scroll_only_after_watch")
                .put("scroll", scrolled);
    }

    /**
     * 输入：Runtime。
     * 输出：评论弹窗关闭结果。
     * 作用：评论发布后关闭 Comments sheet，避免后续 next/like 操作落在评论列表上。
     */
    private JSONObject closeCommentSheet(MobileRuntime runtime) throws Exception {
        JSONObject before = snapshot(runtime);
        String beforePageType = detectPageType(before);
        if (PAGE_REEL_VIEWER.equals(beforePageType)) {
            return new JSONObject()
                    .put("performed", false)
                    .put("strategy", "already_reel_viewer")
                    .put("beforePageType", beforePageType)
                    .put("pageFingerprint", before.optString("pageFingerprint"));
        }

        JSONObject scrolled = scrollBackward(runtime, "INSTAGRAM_COMMENT_SHEET_CLOSE_FAILED");
        JSONObject after = waitForCommentSheetClosed(runtime);
        return new JSONObject()
                .put("performed", true)
                .put("strategy", "sheet_down_swipe")
                .put("beforePageType", beforePageType)
                .put("scroll", scrolled)
                .put("after", after);
    }

    /**
     * 输入：Runtime。
     * 输出：关闭后的 Reel 页面摘要。
     * 作用：确认 Comments sheet 已消失，避免后续动作继续命中评论弹窗。
     */
    private JSONObject waitForCommentSheetClosed(MobileRuntime runtime) throws Exception {
        long deadline = System.currentTimeMillis() + WAIT_MS;
        JSONObject last = null;
        while (System.currentTimeMillis() < deadline) {
            if (runtime.isCancelled()) throw new ConnectorFailure("INSTAGRAM_EXECUTION_CANCELLED", "Execution cancelled");
            last = snapshot(runtime);
            String pageType = detectPageType(last);
            if (PAGE_REEL_VIEWER.equals(pageType)) {
                return new JSONObject()
                        .put("pageType", pageType)
                        .put("pageFingerprint", last.optString("pageFingerprint"))
                        .put("observationId", last.optString("observationId"));
            }
            Thread.sleep(POLL_MS);
        }
        throw new ConnectorFailure("INSTAGRAM_COMMENT_SHEET_NOT_CLOSED", last == null ? PAGE_REEL_VIEWER
                : new JSONObject()
                        .put("actualPageType", detectPageType(last))
                        .put("pageFingerprint", last.optString("pageFingerprint"))
                        .toString());
    }

    /**
     * 输入：Runtime、变化前页面指纹和失败码。
     * 输出：变化后的页面快照。
     * 作用：确认滚动动作真的带来了页面变化，避免只验证命令返回成功。
     */
    private JSONObject waitForPageChange(MobileRuntime runtime, String previousFingerprint, String failureCode)
            throws Exception {
        long deadline = System.currentTimeMillis() + WAIT_MS;
        while (System.currentTimeMillis() < deadline) {
            if (runtime.isCancelled()) throw new ConnectorFailure("INSTAGRAM_EXECUTION_CANCELLED", "Execution cancelled");
            JSONObject current = snapshot(runtime);
            String currentFingerprint = current.optString("pageFingerprint");
            if (!currentFingerprint.isEmpty() && !currentFingerprint.equals(previousFingerprint)) {
                return current;
            }
            Thread.sleep(POLL_MS);
        }
        throw new ConnectorFailure(failureCode, previousFingerprint);
    }

    /**
     * 输入：页面快照。
     * 输出：粗粒度 Instagram 页面类型。
     * 作用：避免只依赖单个 UIAutomator 节点判断页面。
     */
    private String detectPageType(JSONObject snapshot) {
        String fingerprint = snapshot.optString("pageFingerprint").toLowerCase(Locale.ROOT);
        if (fingerprint.contains("comment")) return PAGE_COMMENT_SHEET;
        if (fingerprint.contains("reel")) return PAGE_REEL_VIEWER;
        if (fingerprint.contains("search-results")) return PAGE_SEARCH_RESULTS;

        JSONArray nodes = nodeArray(snapshot);
        boolean hasLike = false;
        boolean hasCommentButton = false;
        boolean hasCommentInput = false;
        boolean hasCommentPost = false;
        boolean hasCommentsTitle = false;
        boolean hasBackgroundDimmer = false;
        boolean hasSearchTab = false;
        for (int index = 0; index < nodes.length(); index++) {
            JSONObject node = nodes.optJSONObject(index);
            if (node == null) continue;
            String resourceId = node.optString("resourceId");
            String text = normalized(node.optString("text"));
            String description = normalized(node.optString("contentDescription"));
            if (RID_LIKE.equals(resourceId)) hasLike = true;
            if (RID_COMMENT.equals(resourceId)) hasCommentButton = true;
            if (RID_COMMENT_INPUT.equals(resourceId) || text.contains("add comment")
                    || description.contains("add comment")) hasCommentInput = true;
            if (RID_COMMENT_POST.equals(resourceId) || "post".equals(text) || "post".equals(description)) {
                hasCommentPost = true;
            }
            if ("comments".equals(text)) hasCommentsTitle = true;
            if (RID_BACKGROUND_DIMMER.equals(resourceId)) hasBackgroundDimmer = true;
            if ("For you".equals(node.optString("text")) || "Accounts".equals(node.optString("text"))
                    || "Tags".equals(node.optString("text"))) hasSearchTab = true;
        }
        if (hasCommentsTitle && (hasCommentInput || hasCommentPost || hasBackgroundDimmer)) {
            return PAGE_COMMENT_SHEET;
        }
        if (hasCommentInput && !hasLike && !hasCommentButton) return PAGE_COMMENT_SHEET;
        if (hasLike || hasCommentButton || hasCommentInput || hasNodeResourceId(snapshot, RID_REELS_TITLE)) {
            return PAGE_REEL_VIEWER;
        }
        if (hasSearchTab) return PAGE_SEARCH_RESULTS;
        return PAGE_UNKNOWN_INSTAGRAM;
    }

    /**
     * 输入：Runtime 和是否允许 OCR 兜底。
     * 输出：当前 Reel Like 状态。
     * 作用：先用 XML 节点判断，状态不明确时采集截图和 OCR 作为兜底证据。
     */
    private LikeState detectLikeState(MobileRuntime runtime, boolean allowVisualFallback) throws Exception {
        JSONObject target = findAny(runtime, List.of(
                selector("resourceId", RID_LIKE),
                selector("contentDescription", "Unlike"),
                selector("contentDescription", "Liked"),
                selector("contentDescription", "Like")));
        if (target != null) {
            LikeState fromXml = detectLikeStateFromNode(target, "xml_state", null, null);
            if (!LIKE_UNKNOWN.equals(fromXml.state)) return fromXml;
        }
        if (!allowVisualFallback) {
            return new LikeState(LIKE_UNKNOWN, "xml_unknown", target, null, null);
        }

        JSONObject capture = require(runtime.capture("{}"), "INSTAGRAM_CAPTURE_FAILED");
        JSONObject ocr = require(runtime.ocr("{}"), "INSTAGRAM_OCR_FAILED");
        String fromText = detectLikeStateFromText(ocrText(ocr));
        String strategy = LIKE_UNKNOWN.equals(fromText) ? "xml_screenshot_ocr_unknown" : "ocr_state";
        return new LikeState(fromText, strategy, target, capture, ocr);
    }

    /**
     * 输入：页面快照。
     * 输出：Like 状态。
     * 作用：供 inspect/collect_signals 在不额外采样时输出精简状态。
     */
    private LikeState detectLikeStateFromSnapshot(JSONObject snapshot) {
        JSONArray nodes = nodeArray(snapshot);
        for (int index = 0; index < nodes.length(); index++) {
            JSONObject node = nodes.optJSONObject(index);
            if (node == null) continue;
            if (RID_LIKE.equals(node.optString("resourceId"))
                    || "like".equals(normalized(node.optString("contentDescription")))
                    || "unlike".equals(normalized(node.optString("contentDescription")))
                    || "liked".equals(normalized(node.optString("contentDescription")))) {
                LikeState state = detectLikeStateFromNode(node, "snapshot_xml_state", null, null);
                if (!LIKE_UNKNOWN.equals(state.state)) return state;
            }
        }
        return new LikeState(detectLikeStateFromText(textArray(snapshot)), "snapshot_text_state", null, null, null);
    }

    /**
     * 输入：Like 节点和证据。
     * 输出：状态对象。
     * 作用：解析 XML 中的 checked/selected/contentDescription 语义。
     */
    private LikeState detectLikeStateFromNode(
            JSONObject node, String strategy, JSONObject capture, JSONObject ocr) {
        if (node.optBoolean("checked", false) || node.optBoolean("selected", false)) {
            return new LikeState(LIKE_LIKED, strategy, node, capture, ocr);
        }
        String description = normalized(node.optString("contentDescription"));
        String text = normalized(node.optString("text"));
        String combined = (description + " " + text).trim();
        String state = detectLikeStateFromText(new JSONArray().put(combined));
        return new LikeState(state, strategy, node, capture, ocr);
    }

    /**
     * 输入：文本数组。
     * 输出：Like 状态。
     * 作用：从 OCR 或可见文本中提取保守的点赞状态。
     */
    private String detectLikeStateFromText(JSONArray lines) {
        for (int index = 0; index < lines.length(); index++) {
            String value = normalized(lines.optString(index));
            if (value.equals("unlike") || value.contains("unlike")
                    || value.equals("liked") || value.contains("liked")) {
                return LIKE_LIKED;
            }
        }
        for (int index = 0; index < lines.length(); index++) {
            String value = normalized(lines.optString(index));
            if (value.equals("like") || value.equals("like button") || value.contains("like button")) {
                return LIKE_UNLIKED;
            }
        }
        return LIKE_UNKNOWN;
    }

    /**
     * 输入：页面快照和 resource-id。
     * 输出：是否存在该节点。
     * 作用：支撑页面类型检测。
     */
    private boolean hasNodeResourceId(JSONObject snapshot, String resourceId) {
        JSONArray nodes = nodeArray(snapshot);
        for (int index = 0; index < nodes.length(); index++) {
            JSONObject node = nodes.optJSONObject(index);
            if (node != null && resourceId.equals(node.optString("resourceId"))) return true;
        }
        return false;
    }

    /**
     * 输入：页面快照。
     * 输出：节点数组。
     * 作用：统一处理缺失 nodes 字段。
     */
    private JSONArray nodeArray(JSONObject snapshot) {
        JSONArray nodes = snapshot.optJSONArray("nodes");
        return nodes == null ? new JSONArray() : nodes;
    }

    /**
     * 输入：页面快照。
     * 输出：可见文本数组。
     * 作用：统一处理缺失 visibleText 字段。
     */
    private JSONArray textArray(JSONObject snapshot) {
        JSONArray text = snapshot.optJSONArray("visibleText");
        return text == null ? new JSONArray() : text;
    }

    /**
     * 输入：文本。
     * 输出：小写规范化文本。
     * 作用：让状态和页面类型判断对大小写更稳健。
     */
    private String normalized(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * 输入：数值和边界。
     * 输出：边界内数值。
     * 作用：避免坐标落到屏幕外。
     */
    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * 输入：OCR 结果。
     * 输出：文本行数组。
     * 作用：从 Runtime OCR 行中提取 Agent 更容易消费的文字。
     */
    private JSONArray ocrText(JSONObject ocr) {
        JSONArray text = new JSONArray();
        JSONArray lines = ocr.optJSONArray("lines");
        if (lines != null) for (int index = 0; index < lines.length(); index++) {
            JSONObject line = lines.optJSONObject(index);
            String value = line == null ? "" : line.optString("text").trim();
            if (!value.isEmpty()) text.put(value);
        }
        return text;
    }

    /**
     * 输入：工作流输入。
     * 输出：打开 Reel 前的搜索结果页随机滚动次数。
     * 作用：默认按 2-6 生成随机滚动，测试可用 preOpenScrollCount 固定。
     */
    private int preOpenScrollCount(JSONObject input) {
        if (input.has("preOpenScrollCount")) {
            int fixed = input.optInt("preOpenScrollCount", -1);
            if (fixed < 0 || fixed > 20) {
                throw new ConnectorFailure("INSTAGRAM_PRE_OPEN_SCROLL_COUNT_INVALID",
                        "preOpenScrollCount must be between 0 and 20");
            }
            return fixed;
        }
        int min = input.optInt("preOpenScrollMin", 2);
        int max = input.optInt("preOpenScrollMax", 6);
        if (min < 0 || max < min || max > 20) {
            throw new ConnectorFailure("INSTAGRAM_PRE_OPEN_SCROLL_RANGE_INVALID",
                    "preOpenScrollMin/preOpenScrollMax must satisfy 0 <= min <= max <= 20");
        }
        return ThreadLocalRandom.current().nextInt(min, max + 1);
    }

    /**
     * 输入：Runtime、观看时长和 deadline。
     * 输出：无。
     * 作用：观看 Reel，同时持续响应取消和截止时间。
     */
    private void watch(MobileRuntime runtime, long watchMs, long deadlineEpochMillis) {
        long deadline = System.currentTimeMillis() + watchMs;
        while (System.currentTimeMillis() < deadline) {
            ensureWorkflowCanContinue(runtime, deadlineEpochMillis, "watch_reel");
            long remaining = deadline - System.currentTimeMillis();
            try {
                Thread.sleep(Math.min(remaining, 100L));
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
                throw new ConnectorFailure("INSTAGRAM_EXECUTION_INTERRUPTED", "Execution interrupted while watching Reel");
            }
        }
    }

    /**
     * 输入：Runtime、deadline 和阶段。
     * 输出：无。
     * 作用：在工作流每个阶段前统一检查取消和 Host deadline。
     */
    private void ensureWorkflowCanContinue(MobileRuntime runtime, long deadlineEpochMillis, String stage) {
        if (runtime.isCancelled()) {
            throw new ConnectorFailure("INSTAGRAM_EXECUTION_CANCELLED", "stage=" + stage);
        }
        if (deadlineEpochMillis > 0L && System.currentTimeMillis() >= deadlineEpochMillis) {
            throw new ConnectorFailure("INSTAGRAM_EXECUTION_DEADLINE_EXCEEDED", "stage=" + stage);
        }
    }

    /**
     * 输入：步骤名和步骤结果。
     * 输出：工作流步骤对象。
     * 作用：让复合 operation 输出可诊断的阶段轨迹。
     */
    private JSONObject step(String action, JSONObject result) throws Exception {
        return new JSONObject()
                .put("action", action)
                .put("result", result);
    }

    /**
     * 输入：字段、默认值和范围。
     * 输出：合法 long 值。
     * 作用：校验工作流数值输入。
     */
    private long boundedLong(
            JSONObject input, String field, long defaultValue, long min, long max, String code) {
        long value = input.optLong(field, defaultValue);
        if (value < min || value > max) {
            throw new ConnectorFailure(code, field + " must be between " + min + " and " + max);
        }
        return value;
    }

    /**
     * 输入：必填字段和范围。
     * 输出：合法 long 值。
     * 作用：校验连续观看 workflow 的显式时长输入。
     */
    private long requiredBoundedLong(JSONObject input, String field, long min, long max, String code) {
        if (!input.has(field)) {
            throw new ConnectorFailure(code, field + " is required and must be between " + min + " and " + max);
        }

        long value = input.optLong(field, Long.MIN_VALUE);
        if (value < min || value > max) {
            throw new ConnectorFailure(code, field + " must be between " + min + " and " + max);
        }
        return value;
    }

    /**
     * 输入：工作流阶段、已完成步骤数和原始错误。
     * 输出：带阶段诊断的 ConnectorFailure。
     * 作用：让复合 workflow 失败结果包含失败阶段和已完成数量。
     */
    private ConnectorFailure workflowFailure(String stage, int completedSteps, ConnectorFailure failure) {
        return new ConnectorFailure(
                failure.code,
                "stage=" + stage
                        + "; completedSteps=" + completedSteps
                        + "; lastCode=" + failure.code
                        + "; detail=" + safeDetail(failure));
    }

    /**
     * 输入：ConnectorFailure。
     * 输出：适合放入分号分隔 detail 的文本。
     * 作用：避免嵌套 detail 破坏阶段诊断格式。
     */
    private String safeDetail(ConnectorFailure failure) {
        String detail = failure.getMessage();
        return detail == null ? "" : detail.replace(';', ',');
    }

    /**
     * 输入：字段和值。
     * 输出：selector JSON。
     * 作用：构造 Runtime query 使用的 selector。
     */
    private JSONObject selector(String field, String value) throws Exception {
        return new JSONObject().put(field, value).put("clickable", true);
    }

    /**
     * 输入：字段和值。
     * 输出：不要求 clickable 的 selector JSON。
     * 作用：查找输入框或状态文本时避免被 clickable 属性误过滤。
     */
    private JSONObject selectorLoose(String field, String value) throws Exception {
        return new JSONObject().put(field, value);
    }

    /**
     * 输入：已绑定目标。
     * 输出：click/submit 请求 JSON。
     * 作用：将目标 path 和页面指纹转换为动作请求。
     */
    private JSONObject boundRequest(JSONObject target) throws Exception {
        return new JSONObject()
                .put("targetPath", target.getString("path"))
                .put("expectedPageFingerprint", target.getString("pageFingerprint"));
    }

    /**
     * 输入：页面快照。
     * 输出：无。
     * 作用：确认当前活动包名是 Instagram。
     */
    private void assertInstagramActive(JSONObject snapshot) {
        String packageName = snapshot.optString("packageName");
        if (!PACKAGE_NAME.equals(packageName)) throw new ConnectorFailure("INSTAGRAM_NOT_ACTIVE", packageName);
    }

    /**
     * 输入：用户输入 JSON、字段名和错误码。
     * 输出：非空字符串字段值。
     * 作用：在 operation 输入边界快速失败。
     */
    private String required(JSONObject input, String field, String code) {
        String value = input.optString(field).trim();
        if (value.isEmpty()) throw new ConnectorFailure(code, field + " is required");
        return value;
    }

    /**
     * 输入：用户输入 JSON 和字段名。
     * 输出：去除首尾空白后的字段值。
     * 作用：实现 profile.update 的局部更新输入规则。
     */
    private String optionalText(JSONObject input, String field) {
        return input.optString(field).trim();
    }

    /**
     * 输入：头像来源字符串。
     * 输出：是否是 HTTP URL。
     * 作用：决定 media.prepare 使用 url 还是 localPath。
     */
    private boolean isHttpUrl(String value) {
        String normalized = value.toLowerCase(Locale.ROOT);
        return normalized.startsWith("http://") || normalized.startsWith("https://");
    }

    /**
     * 输入：Runtime capability 结果和兜底错误码。
     * 输出：payload JSON。
     * 作用：在 Runtime 边界暴露能力调用失败。
     */
    private JSONObject require(CapabilityResult result, String fallbackCode) throws Exception {
        if (!result.isOk()) {
            String code = result.code().isBlank() ? fallbackCode : result.code();
            throw new ConnectorFailure(code, result.detail());
        }
        return new JSONObject(result.payloadJson());
    }

    private static final class LikeState {
        private final String state;
        private final String strategy;
        private final JSONObject target;
        private final JSONObject capture;
        private final JSONObject ocr;

        /**
         * 输入：状态、策略、XML 目标、截图和 OCR。
         * 输出：LikeState。
         * 作用：把点赞状态判断和证据绑定在一起。
         */
        private LikeState(String state, String strategy, JSONObject target, JSONObject capture, JSONObject ocr) {
            this.state = state;
            this.strategy = strategy;
            this.target = target;
            this.capture = capture;
            this.ocr = ocr;
        }

        /**
         * 输入：无。
         * 输出：状态判断 JSON。
         * 作用：让 action 输出包含可诊断证据。
         */
        private JSONObject toJson() throws Exception {
            JSONObject value = new JSONObject()
                    .put("state", state)
                    .put("strategy", strategy);
            if (target != null) value.put("target", target);
            if (capture != null) value.put("capture", capture);
            if (ocr != null) value.put("ocrText", ocrTextStatic(ocr));
            return value;
        }

        private static JSONArray ocrTextStatic(JSONObject ocr) {
            JSONArray text = new JSONArray();
            JSONArray lines = ocr.optJSONArray("lines");
            if (lines != null) for (int index = 0; index < lines.length(); index++) {
                JSONObject line = lines.optJSONObject(index);
                String value = line == null ? "" : line.optString("text").trim();
                if (!value.isEmpty()) text.put(value);
            }
            return text;
        }
    }

    private static final class ConnectorFailure extends RuntimeException {
        private final String code;

        /**
         * 输入：错误码和错误详情。
         * 输出：ConnectorFailure。
         * 作用：携带稳定错误码向 execute 返回失败。
         */
        private ConnectorFailure(String code, String detail) {
            super(detail);
            this.code = code;
        }
    }
}
