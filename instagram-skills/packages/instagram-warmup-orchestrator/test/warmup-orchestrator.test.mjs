import assert from "node:assert/strict";
import test from "node:test";
import {
  createWarmupPlan,
  instagramWarmupPlan,
  instagramWarmupResultSummarize,
  resolveWarmupStage,
  summarizeWarmupResult,
  warmupDayNumber
} from "../dist/index.js";

const baseRequest = {
  accountId: "ig-account-1",
  sessionRef: "session-ref-1",
  registeredAt: "2026-08-01",
  currentDate: "2026-08-01",
  targetLanguage: "zh",
  materialLibraryPath: "materials/instagram",
  keywords: ["fitness", "food"]
};

test("阶段判断覆盖第 1 到 5 天、第 6 到 14 天和稳定阶段", () => {
  assert.equal(warmupDayNumber("2026-08-01", "2026-08-01"), 1);
  assert.equal(resolveWarmupStage("2026-08-01", "2026-08-05"), "day_1_5");
  assert.equal(resolveWarmupStage("2026-08-01", "2026-08-06"), "day_6_14");
  assert.equal(resolveWarmupStage("2026-08-01", "2026-08-15"), "stable");
});

test("当前日期早于注册日期时直接失败", () => {
  assert.throws(() => resolveWarmupStage("2026-08-02", "2026-08-01"), /currentDate/);
});

test("day_1_5 计划包含资料建设和视频互动任务", () => {
  const plan = createWarmupPlan(baseRequest);
  assert.equal(plan.stage, "day_1_5");
  assert.equal(plan.accountId, "ig-account-1");
  assert.equal(plan.sessionRef, "session-ref-1");
  assert.deepEqual(
    plan.tasks.map((task) => task.type),
    ["profile_setup", "video_interaction"]
  );
  assert.equal(plan.tasks[0].skill, "instagram-profile-setup");
  assert.equal(plan.tasks[1].skill, "instagram-video-interaction");
  assert.equal(plan.tasks[1].suggestedInput.durationMs, 1800000);
  assert.deepEqual(plan.tasks[1].suggestedInput.keywords, ["fitness", "food"]);
});

test("day_6_14 计划只包含视频互动任务", () => {
  const plan = createWarmupPlan({ ...baseRequest, currentDate: "2026-08-06" });
  assert.equal(plan.stage, "day_6_14");
  assert.deepEqual(
    plan.tasks.map((task) => task.type),
    ["video_interaction"]
  );
});

test("stable 计划只包含常规互动任务", async () => {
  const plan = await instagramWarmupPlan({ ...baseRequest, currentDate: "2026-08-15", keywords: [] });
  assert.equal(plan.stage, "stable");
  assert.deepEqual(
    plan.tasks.map((task) => task.type),
    ["video_interaction"]
  );
  assert.deepEqual(plan.tasks[0].suggestedInput.keywords, ["same niche reels"]);
});

test("计划只返回 toolHints，不返回执行结果字段", () => {
  const plan = createWarmupPlan(baseRequest);
  for (const task of plan.tasks) {
    assert.equal(Array.isArray(task.toolHints), true);
    assert.equal("toolResults" in task, false);
    assert.equal("status" in task, false);
  }
});

test("汇总真实执行日志并保留失败状态", async () => {
  const summary = await instagramWarmupResultSummarize({
    accountId: "ig-account-1",
    date: "2026-08-01",
    stage: "day_1_5",
    items: [
      {
        taskId: "profile-setup-001",
        type: "profile_setup",
        status: "succeeded",
        startedAt: "2026-08-01T01:00:00.000Z",
        endedAt: "2026-08-01T01:01:00.000Z"
      },
      {
        taskId: "video-interaction-001",
        type: "video_interaction",
        status: "failed",
        startedAt: "2026-08-01T01:02:00.000Z",
        endedAt: "2026-08-01T01:03:00.000Z",
        reason: "connector failed"
      }
    ]
  });
  assert.equal(summary.totalTaskCount, 2);
  assert.equal(summary.succeededTaskCount, 1);
  assert.equal(summary.failedTaskCount, 1);
  assert.equal(summary.skippedTaskCount, 0);
  assert.equal(summary.items[1].status, "failed");
});

test("汇总输入非法状态时直接失败", () => {
  assert.throws(
    () =>
      summarizeWarmupResult({
        accountId: "ig-account-1",
        date: "2026-08-01",
        stage: "day_1_5",
        items: [
          {
            taskId: "bad-001",
            type: "video_interaction",
            status: "unknown",
            startedAt: "2026-08-01T01:00:00.000Z",
            endedAt: "2026-08-01T01:01:00.000Z"
          }
        ]
      }),
    /unsupported item.status/
  );
});
