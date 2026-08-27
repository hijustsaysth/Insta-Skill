import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildVideoEvaluatePrompt,
  createVideoInteractionToolRegistry,
  instagramVideoEvaluate,
  instagramVideoInteractionPlan,
  instagramVideoLogSummarize,
  registerVideoInteractionTools,
  videoInteractionTools
} from "../dist/index.js";
import { apply } from "../dist/plugin.js";

const basePlanRequest = {
  accountId: "account_001",
  sessionRef: "connector:runtime_001",
  keywords: ["coffee shop"],
  targetDescription: "coffee lifestyle reels",
  maxLikes: 2,
  maxComments: 1,
  minDwellMs: 6000,
  maxDwellMs: 10000
};

test("creates a structured video interaction plan without executing connector tools", async () => {
  const plan = await instagramVideoInteractionPlan(basePlanRequest);

  assert.equal(plan.action, "video.interaction");
  assert.equal(plan.requestDraft.accountId, "account_001");
  assert.equal(plan.requestDraft.keywords[0], "coffee shop");
  assert.equal(plan.logFields.maxLikes, 2);
  assert.ok(plan.connectorTools.includes("instagram.reel.collect_signals"));
  assert.ok(plan.connectorTools.includes("instagram.reels.engage_workflow"));
  assert.match(plan.startedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("rejects plan without keywords", async () => {
  await assert.rejects(
    () => instagramVideoInteractionPlan({ ...basePlanRequest, keywords: [] }),
    /INSTAGRAM_VIDEO_KEYWORDS_REQUIRED/
  );
});

test("rejects invalid dwell range", async () => {
  await assert.rejects(
    () => instagramVideoInteractionPlan({ ...basePlanRequest, minDwellMs: 10000, maxDwellMs: 5000 }),
    /INSTAGRAM_VIDEO_MAX_DWELL_MS_INVALID/
  );
});

test("evaluates matched video and respects remaining interaction counts", async () => {
  const result = await instagramVideoEvaluate({
    accountId: "account_001",
    keyword: "coffee shop",
    targetDescription: "coffee lifestyle reels",
    visibleText: ["A quiet coffee shop morning routine"],
    remainingLikeCount: 1,
    remainingCommentCount: 1,
    minDwellMs: 6000,
    maxDwellMs: 10000
  });

  assert.equal(result.matched, true);
  assert.equal(result.shouldLike, true);
  assert.equal(result.shouldComment, true);
  assert.equal(result.dwellMs, 8000);
  assert.equal(typeof result.commentIntent, "string");
});

test("evaluates unrelated video as skipped", async () => {
  const result = await instagramVideoEvaluate({
    accountId: "account_001",
    keyword: "coffee shop",
    targetDescription: "coffee lifestyle reels",
    visibleText: ["Football highlights and match recap"],
    remainingLikeCount: 1,
    remainingCommentCount: 1,
    minDwellMs: 6000,
    maxDwellMs: 10000
  });

  assert.deepEqual(result, {
    matched: false,
    shouldLike: false,
    shouldComment: false,
    dwellMs: 8000,
    skipReason: "not_matched_target"
  });
});

test("does not suggest exhausted like or comment actions", async () => {
  const result = await instagramVideoEvaluate({
    accountId: "account_001",
    keyword: "coffee shop",
    targetDescription: "coffee lifestyle reels",
    ocrText: ["coffee lifestyle tips"],
    remainingLikeCount: 0,
    remainingCommentCount: 0,
    minDwellMs: 6000,
    maxDwellMs: 10000
  });

  assert.equal(result.matched, true);
  assert.equal(result.shouldLike, false);
  assert.equal(result.shouldComment, false);
  assert.equal(result.commentIntent, undefined);
});

test("does not suggest like when current reel is already liked", async () => {
  const result = await instagramVideoEvaluate({
    accountId: "account_001",
    keyword: "coffee shop",
    targetDescription: "coffee lifestyle reels",
    visibleText: ["coffee shop counter"],
    alreadyLiked: true,
    remainingLikeCount: 1,
    remainingCommentCount: 1,
    minDwellMs: 6000,
    maxDwellMs: 10000
  });

  assert.equal(result.matched, true);
  assert.equal(result.shouldLike, false);
  assert.equal(result.shouldComment, true);
});

test("skips when vision model is unavailable and text signals are missing", async () => {
  const result = await instagramVideoEvaluate({
    accountId: "account_001",
    keyword: "coffee shop",
    targetDescription: "coffee lifestyle reels",
    frameAssets: ["frame_001.png"],
    visionModelAvailable: false,
    remainingLikeCount: 1,
    remainingCommentCount: 1,
    minDwellMs: 6000,
    maxDwellMs: 10000
  });

  assert.equal(result.matched, false);
  assert.equal(result.shouldLike, false);
  assert.equal(result.shouldComment, false);
  assert.equal(result.skipReason, "insufficient_signals_without_vision_model");
});

test("uses text signals when vision model is unavailable", async () => {
  const result = await instagramVideoEvaluate({
    accountId: "account_001",
    keyword: "coffee shop",
    targetDescription: "coffee lifestyle reels",
    visibleText: ["coffee shop counter"],
    frameAssets: ["frame_001.png"],
    visionModelAvailable: false,
    remainingLikeCount: 1,
    remainingCommentCount: 1,
    minDwellMs: 6000,
    maxDwellMs: 10000
  });

  assert.equal(result.matched, true);
  assert.equal(result.shouldLike, true);
});

test("treats empty text arrays as insufficient signals", async () => {
  const result = await instagramVideoEvaluate({
    accountId: "account_001",
    keyword: "coffee shop",
    targetDescription: "coffee lifestyle reels",
    visibleText: [" "],
    ocrText: [],
    visionModelAvailable: false,
    remainingLikeCount: 1,
    remainingCommentCount: 1,
    minDwellMs: 6000,
    maxDwellMs: 10000
  });

  assert.equal(result.matched, false);
  assert.equal(result.skipReason, "insufficient_signals_without_vision_model");
});

test("uses injected vision model to convert frames into text signals", async () => {
  const result = await instagramVideoEvaluate(
    {
      accountId: "account_001",
      keyword: "coffee shop",
      targetDescription: "coffee lifestyle reels",
      frameAssets: ["frame_001.png"],
      visionModelAvailable: true,
      remainingLikeCount: 1,
      remainingCommentCount: 1,
      minDwellMs: 6000,
      maxDwellMs: 10000
    },
    {
      visionModel: {
        async analyzeFrames(request) {
          assert.deepEqual(request.frameAssets, ["frame_001.png"]);

          return { description: "A coffee shop brewing routine" };
        }
      }
    }
  );

  assert.equal(result.matched, true);
  assert.equal(result.shouldComment, true);
});

test("uses injected text model for video evaluation and enforces remaining counts", async () => {
  const result = await instagramVideoEvaluate(
    {
      accountId: "account_001",
      keyword: "coffee shop",
      targetDescription: "coffee lifestyle reels",
      visibleText: ["coffee shop routine"],
      remainingLikeCount: 0,
      remainingCommentCount: 0,
      minDwellMs: 6000,
      maxDwellMs: 10000
    },
    {
      textModel: {
        async generateJson(request) {
          assert.equal(request.schemaName, "InstagramVideoEvaluateResult");
          assert.equal(request.prompt.includes("coffee shop"), true);

          return {
            matched: true,
            shouldLike: true,
            shouldComment: true,
            commentIntent: "positive",
            dwellMs: 7000
          };
        }
      }
    }
  );

  assert.equal(result.matched, true);
  assert.equal(result.shouldLike, false);
  assert.equal(result.shouldComment, false);
});

test("model evaluation cannot suggest like when current reel is already liked", async () => {
  const result = await instagramVideoEvaluate(
    {
      accountId: "account_001",
      keyword: "coffee shop",
      targetDescription: "coffee lifestyle reels",
      visibleText: ["coffee shop routine"],
      alreadyLiked: true,
      remainingLikeCount: 1,
      remainingCommentCount: 1,
      minDwellMs: 6000,
      maxDwellMs: 10000
    },
    {
      textModel: {
        async generateJson() {
          return {
            matched: true,
            shouldLike: true,
            shouldComment: true,
            commentIntent: "positive",
            dwellMs: 7000
          };
        }
      }
    }
  );

  assert.equal(result.matched, true);
  assert.equal(result.shouldLike, false);
  assert.equal(result.shouldComment, true);
});

test("rejects invalid dwell time returned by text model", async () => {
  await assert.rejects(
    () =>
      instagramVideoEvaluate(
        {
          accountId: "account_001",
          keyword: "coffee shop",
          targetDescription: "coffee lifestyle reels",
          visibleText: ["coffee shop routine"],
          remainingLikeCount: 1,
          remainingCommentCount: 1,
          minDwellMs: 6000,
          maxDwellMs: 10000
        },
        {
          textModel: {
            async generateJson() {
              return {
                matched: true,
                shouldLike: true,
                shouldComment: true,
                dwellMs: 12000
              };
            }
          }
        }
      ),
    /INSTAGRAM_VIDEO_MODEL_DWELL_MS_INVALID/
  );
});

test("builds prompt templates with request values", () => {
  const evaluatePrompt = buildVideoEvaluatePrompt({
    accountId: "account_001",
    keyword: "coffee shop",
    targetDescription: "coffee lifestyle reels",
    visibleText: ["visible coffee"],
    ocrText: ["ocr coffee"],
    remainingLikeCount: 1,
    remainingCommentCount: 0,
    minDwellMs: 6000,
    maxDwellMs: 10000
  });

  assert.equal(evaluatePrompt.includes("visible coffee"), true);
  assert.equal(evaluatePrompt.includes("当前是否已点赞：false"), true);
  assert.equal(evaluatePrompt.includes("剩余评论次数：0"), true);
});

test("summarizes real interaction logs", async () => {
  const summary = await instagramVideoLogSummarize({
    accountId: "account_001",
    startedAt: "2026-08-25T00:00:00.000Z",
    endedAt: "2026-08-25T00:01:00.000Z",
    items: [
      {
        action: "watch",
        keyword: "coffee shop",
        matched: true,
        dwellMs: 8000,
        resultStatus: "succeeded",
        actedAt: "2026-08-25T00:00:10.000Z"
      },
      {
        action: "like",
        keyword: "coffee shop",
        matched: true,
        dwellMs: 8000,
        resultStatus: "succeeded",
        actedAt: "2026-08-25T00:00:12.000Z"
      },
      {
        action: "comment",
        keyword: "coffee shop",
        matched: true,
        commentText: "这个分享很自然。",
        dwellMs: 8000,
        resultStatus: "succeeded",
        actedAt: "2026-08-25T00:00:13.000Z"
      },
      {
        action: "skip",
        keyword: "coffee shop",
        matched: false,
        dwellMs: 8000,
        resultStatus: "skipped",
        reason: "not_matched_target",
        actedAt: "2026-08-25T00:00:30.000Z"
      }
    ]
  });

  assert.equal(summary.durationMs, 60000);
  assert.equal(summary.watchedCount, 1);
  assert.equal(summary.likedCount, 1);
  assert.equal(summary.commentedCount, 1);
  assert.equal(summary.skippedCount, 1);
});

test("exposes the three video interaction tool definitions", () => {
  assert.deepEqual(
    videoInteractionTools.map((tool) => tool.name),
    [
      "instagram_video_interaction_plan",
      "instagram_video_evaluate",
      "instagram_video_log_summarize"
    ]
  );
});

test("creates and registers executable tool definitions", async () => {
  const registered = [];
  const registry = createVideoInteractionToolRegistry();
  const disposers = registerVideoInteractionTools({
    register(tool) {
      registered.push(tool.name);

      return () => undefined;
    }
  });
  const result = await registry.execute("instagram_video_interaction_plan", basePlanRequest);

  assert.equal(registry.schemas()[0].execute, undefined);
  assert.equal(registry.schemas()[0].output, undefined);
  assert.equal(registry.schemas()[0].parameters.type, "object");
  assert.equal(result.action, "video.interaction");
  assert.equal(disposers.length, 3);
  assert.deepEqual(registered, [
    "instagram_video_interaction_plan",
    "instagram_video_evaluate",
    "instagram_video_log_summarize"
  ]);
});

test("plugin entry registers executable tools through ctx.tools", () => {
  const registered = [];
  const result = apply({
    tools: {
      register(tool) {
        registered.push(tool.name);

        return `dispose:${tool.name}`;
      }
    }
  });

  assert.equal(result.length, 3);
  assert.deepEqual(registered, [
    "instagram_video_interaction_plan",
    "instagram_video_evaluate",
    "instagram_video_log_summarize"
  ]);
});

test("keeps package independent from connector and provider implementations", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const srcFiles = ["evaluate.ts", "index.ts", "limits.ts", "log.ts", "plan.ts", "plugin.ts", "prompts.ts", "runtime.ts", "schema.ts", "tool-registry.ts", "tools.ts"];
  const source = srcFiles.map((file) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8")).join("\n");

  assert.equal(packageJson.dependencies, undefined);
  assert.equal(source.includes("@instagram-skills/instagram-connector"), false);
  assert.equal(source.includes("@instagram-skills/instagram-aiograpi-rest"), false);
  assert.equal(source.includes("@instagram-skills/instagram-official-api"), false);
  assert.equal(source.includes("adb"), false);
  assert.equal(source.includes("playwright"), false);
});

test("SKILL.md states execution boundary and visual downgrade", () => {
  const skill = readFileSync(new URL("../SKILL.md", import.meta.url), "utf8");

  assert.equal(skill.includes("不负责执行 Instagram 操作"), true);
  assert.equal(skill.includes("连续观看固定时长的视频任务应交给 instagram-connector 的 engage_workflow"), true);
  assert.equal(skill.includes("无视觉模型降级"), true);
});
