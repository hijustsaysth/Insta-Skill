---
name: instagram-video-interaction
description: 当需要规划 Instagram Reel 原子动作组合、判断单条视频是否适合点赞或评论，并形成真实用户轨迹时使用；连续观看固定时长的视频任务应交给 instagram-connector 的 engage_workflow。
---

# instagram-video-interaction

本 skill 仅生成原子动作计划、单条视频判断和日志汇总，不执行 Instagram。App 打开、搜索、Reel、截图/OCR、等待、点赞、评论、滑动均由 agent 服务调用 `instagram-connector` CLI。

## 路由与流程

需按内容决定点赞/评论时，调用 `instagram_video_interaction_plan`，由 agent 逐步执行 connector 原子动作；只需定时连续观看且不互动时，直接调用 `instagram.reels.engage_workflow`，以 `perVideoWatchMs`、`totalWatchMs` 控时。

原子流程：生成计划；搜索并采集 `visibleText`、`ocrText`、`frameAssets`、`alreadyLiked`；用 `instagram_video_evaluate` 判断；观看 2-3 秒再互动（点赞与评论间无需停顿）；取得副作用确认后执行；以 `instagram.reel.next` 切换（不等于 engage workflow）；逐步记录并用 `instagram_video_log_summarize` 汇总。`UI_DUMP_IDLE_TIMEOUT: ERROR: could not get idle state.` 出现两次以上时改用截图观察。

若计划来自 `instagram_warmup_plan` 或用户要求养号汇总，所有任务均为 `succeeded`/`failed`/`skipped`、无重试/确认等待/调用/恢复且日志齐全后，使用 `instagram-warmup-orchestrator` 汇总。

## 工具与 CLI

工具：`instagram_video_interaction_plan`、`instagram_video_evaluate`、`instagram_video_log_summarize`。

```powershell
node .\dist\cli.bundle.js list-tools
node .\dist\cli.bundle.js invoke --action instagram_video_interaction_plan --input-json '{"accountId":"ig-account-001","sessionRef":"session-ref-001","keywords":["fitness"],"targetDescription":"fitness reels","maxLikes":5,"maxComments":2,"minDwellMs":5000,"maxDwellMs":15000}'
node .\dist\cli.bundle.js invoke --action instagram_video_evaluate --input-json video-evaluate.json
node .\dist\cli.bundle.js invoke --action instagram_video_log_summarize --input-json -
```

`--input-json` 支持内联 JSON、文件、stdin `-`；`bin` 暴露时可用 `instagram-video-interaction`。输出为 `{ "ok": true, "result": ... }`；失败为 `{ "ok": false, "error": { "code": "...", "message": "..." } }`。

## 输入

- `instagram_video_interaction_plan` 必填：`accountId`、`sessionRef`、`keywords`、`targetDescription`、`maxLikes`、`maxComments`、`minDwellMs`、`maxDwellMs`。
- `instagram_video_evaluate` 必填：`accountId`、`keyword`、`targetDescription`、`remainingLikeCount`、`remainingCommentCount`、`minDwellMs`、`maxDwellMs`；可选 `visibleText`、`ocrText`、`frameAssets`、`visionModelAvailable`、`alreadyLiked`。
- `instagram_video_log_summarize` 必填：`accountId`、`startedAt`、`endedAt`、`items`。

## 互动约束

已知点赞状态必须传 `alreadyLiked`：为 `true` 时 `shouldLike=false`；为 `false` 且剩余额度 > 0 才可按匹配建议点赞。未知时，调用 `instagram.reel.like` 前再次确认，避免取消点赞。

评论由 agent 依据账号名、文案、画面或 `commentIntent` 临场生成：短、自然、同轮句式不同；禁止硬广、推销、私信引导、链接、邮箱、电话、WhatsApp、价格、促销及虚假身份/承诺。中文、Emoji、非 ASCII 依赖 ADB Keyboard；收到 `UI_INPUT_UNICODE_UNSUPPORTED` 时记录降级并停止，除非用户明确允许 ASCII 替代。ASCII 可由 connector 以 `adb input text` 兜底。

无视觉模型时不分析 `frameAssets`，只用 `visibleText`、`ocrText`；文本不足则仅给停留建议或跳过原因，不建议点赞或评论。
