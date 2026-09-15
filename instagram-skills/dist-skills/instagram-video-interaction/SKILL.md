---
name: instagram-video-interaction
description: 当需要规划 Instagram Reel 原子动作组合、判断单条视频是否适合点赞或评论，并形成真实用户轨迹时使用；连续观看固定时长的视频任务应交给 instagram-connector 的 engage_workflow。
---

# instagram-video-interaction

## 边界与路由

本 skill 只生成原子视频动作计划、单条视频判断和真实日志汇总，不执行 Instagram 操作。打开 App、搜索/Reel、截图/OCR、等待、点赞、评论、滑动由 agent 服务调用 `instagram-connector` CLI。

需要按内容判断点赞/评论时使用本 skill 并逐步执行 connector 原子动作；只连续观看固定时长且不互动时，直接调用 `instagram.reels.engage_workflow`，用 `perVideoWatchMs`、`totalWatchMs` 控制时长。

计划来自 `instagram_warmup_plan` 或用户要求养号汇总，且所有任务已进入 `succeeded`、`failed`、`skipped` 终态、当前不在重试/确认等待/工具调用/恢复中、日志已收齐时，调用 `instagram-warmup-orchestrator` 汇总。

## 工具与 CLI

工具：`instagram_video_interaction_plan`、`instagram_video_evaluate`、`instagram_video_log_summarize`。

```powershell
node .\dist\cli.bundle.js list-tools
node .\dist\cli.bundle.js invoke --action instagram_video_interaction_plan --input-json '{"accountId":"ig-account-001","sessionRef":"session-ref-001","keywords":["fitness"],"targetDescription":"fitness reels","maxLikes":5,"maxComments":2,"minDwellMs":5000,"maxDwellMs":15000}'
node .\dist\cli.bundle.js invoke --action instagram_video_evaluate --input-json video-evaluate.json
```

也支持 PATH bin。`--input-json` 接受内联 JSON、文件或 stdin `-`；CLI 返回 `{ "ok": true, "result": ... }`，失败返回 `{ "ok": false, "error": { "code": "...", "message": "..." } }`。

## 输入

* `instagram_video_interaction_plan` 必填：`accountId`、`sessionRef`、`keywords`、`targetDescription`、`maxLikes`、`maxComments`、`minDwellMs`、`maxDwellMs`。
* `instagram_video_evaluate` 必填：`accountId`、`keyword`、`targetDescription`、`remainingLikeCount`、`remainingCommentCount`、`minDwellMs`、`maxDwellMs`；可选：`visibleText`、`ocrText`、`frameAssets`、`visionModelAvailable`、`alreadyLiked`。
* `instagram_video_log_summarize` 必填：`accountId`、`startedAt`、`endedAt`、`items`。

## 执行流程

1. 用 `instagram_video_interaction_plan` 生成观看/点赞/评论决策计划；它不执行连续观看 runner。
2. agent 服务按计划搜索、打开 Reel，采集 `visibleText`、`ocrText`、`frameAssets`、`alreadyLiked`，再用 `instagram_video_evaluate` 判断。
3. 观看 2-3 秒后再点赞或评论；两动作之间无需停顿。评论由 agent 根据当前信号和下方评论临场起草。
4. 取得副作用确认后才调用 connector 点赞/评论；下一条用独立的 `instagram.reel.next`，不等同于 engage workflow。
5. 每次真实动作后记录日志，结束时用 `instagram_video_log_summarize` 汇总真实轨迹。
6. `UI_DUMP_IDLE_TIMEOUT: ERROR: could not get idle state.` 类错误超过两次后改用截图观察。

## 点赞与评论

connector 已返回点赞状态时必须传 `alreadyLiked`：`alreadyLiked=true` 时 `shouldLike=false`；`alreadyLiked=false` 且剩余额度大于 0 时才可按匹配结果建议点赞。状态未知时，真正调用 `instagram.reel.like` 前再次确认，避免取消已有点赞。

评论应简短、结合账号名/文案/画面/`commentIntent`，同轮句式不同；禁止硬广、推销、私信引导、链接、邮箱、电话、WhatsApp、价格、促销、折扣、夸大承诺及冒充官方/专业身份。

执行前检查 connector 输入结果：中文、Emoji、非 ASCII 依赖 ADB Keyboard。返回 `UI_INPUT_UNICODE_UNSUPPORTED` 时记录降级并停止，不生成替代评论；仅用户明确允许才改 ASCII。ASCII 可由 `adb input text` 兜底。

## 无视觉模型降级

无视觉模型时不分析 `frameAssets`，仅用 `visibleText`、`ocrText`；文本不足时只返回停留建议或跳过原因，不建议点赞或评论。
