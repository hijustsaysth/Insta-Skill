---
name: instagram-video-interaction
description: 当需要规划 Instagram Reel 原子动作组合、判断单条视频是否适合点赞或评论，并形成真实用户轨迹时使用；连续观看固定时长的视频任务应交给 instagram-connector 的 engage_workflow。
---

# instagram-video-interaction

## 职责边界

本 skill 只负责生成原子动作组合流程的视频动作计划、单条视频判断和日志汇总，不直接执行 Instagram 操作；换句话说，本 skill 不负责执行 Instagram 操作。

真实操作，例如：打开 App、搜索、打开 Reel、截图/OCR 采集、观看等待、点赞、评论和滑动，由 agent 服务调用 `instagram-connector` CLI 完成。

## 任务路由

* 如果任务要求点赞、评论或按内容判断是否互动，使用本 skill 生成原子动作组合流程的视频动作计划，再由 agent 服务逐步调用 `instagram-connector` 的原子动作。例如：“帮我在 ins 上看几个美食视频，并点赞评论”。
* 如果任务只要求连续观看一定时间的视频，不点赞、不评论，直接调用 `instagram-connector` 的 `instagram.reels.engage_workflow`，由 `perVideoWatchMs` 和 `totalWatchMs` 控制每条视频观看时长和总观看时长。例如：“帮我在 ins 上连续看 20 分钟美食视频”。

## 推荐调用流程

1. 使用 `instagram_video_interaction_plan` 生成原子动作组合流程的视频动作计划，支持观看、点赞和评论决策。
   该工具只生成结构化计划，不执行连续观看 runner。
2. agent 服务按计划调用 `instagram-connector` CLI 搜索、打开 Reel，并采集 `visibleText`、`ocrText`、`frameAssets` 和 `alreadyLiked`。
3. 使用 `instagram_video_evaluate` 判断当前 Reel 是否匹配目标，以及是否建议点赞或评论。
4. 观看2-3秒后再点赞或评论，点赞和评论这两个动作之间不需要停顿
5. 如果建议评论，agent 服务根据当前视频信号和下方评论建议自行起草评论文本。
6. agent 服务在取得副作用确认后，再调用 `instagram-connector` CLI 执行点赞或评论。
7. 需要继续看下一条时，agent 服务调用 `instagram.reel.next`；这是独立动作链路，不等同于 `instagram.reels.engage_workflow`。
8. 每次真实动作完成后记录日志，任务结束时使用 `instagram_video_log_summarize` 汇总真实用户轨迹。
9. 如果遇到 `UI_DUMP_IDLE_TIMEOUT: ERROR: could not get idle state.`这一类错误两次以上，改用截图的形式观察内容。

## 注册工具

* `instagram_video_interaction_plan`
* `instagram_video_evaluate`
* `instagram_video_log_summarize`

## 工具输入

`instagram_video_interaction_plan` 必填：

```text
accountId
sessionRef
keywords
targetDescription
maxLikes
maxComments
minDwellMs
maxDwellMs
```

`instagram_video_evaluate` 必填：

```text
accountId
keyword
targetDescription
remainingLikeCount
remainingCommentCount
minDwellMs
maxDwellMs
```

`instagram_video_evaluate` 可选：

```text
visibleText
ocrText
frameAssets
visionModelAvailable
alreadyLiked
```

`instagram_video_log_summarize` 必填：

```text
accountId
startedAt
endedAt
items
```

## 点赞规则

agent 服务调用 `instagram_video_evaluate` 时，如果 connector 已返回当前 Reel 的点赞状态，应传入 `alreadyLiked`。

* `alreadyLiked=true` 时，`shouldLike` 必须为 `false`。
* `alreadyLiked=false` 且剩余点赞次数大于 0 时，才允许根据内容匹配结果建议点赞。
* 如果无法确认点赞状态，agent 服务应在真正调用 `instagram.reel.like` 前再次通过 connector 确认，避免误取消已点赞内容。

## 评论规则

本包不提供评论生成函数，评论文本由 agent 服务根据视频信号临场起草。

评论建议：

* 评论要短，像真实用户随手评论。
* 优先结合当前 Reel 的账号名、文案、画面或 `commentIntent`，避免无上下文模板。
* 同一轮多条评论应使用不同句式，不要只替换关键词。
* 不要硬广，不要推销，不要引导私信。
* 不要包含链接、邮箱、电话、WhatsApp、价格或促销话术。
* 不要夸大承诺，不要冒充官方或专业身份。

评论草案不能包含链接、联系方式、促销、折扣、价格、私信引导或硬广话术。

agent 服务执行评论前必须检查 `instagram-connector` 返回的评论输入结果：

* 中文、Emoji 或其他非 ASCII 评论依赖 connector 的 ADB Keyboard 输入能力。
* 如果 connector 返回 `UI_INPUT_UNICODE_UNSUPPORTED`，记录降级并停止本次评论，不重新生成替代评论，除非用户明确允许改成 ASCII 评论。
* ASCII 评论可以在 ADB Keyboard 不可用时由 connector 使用 `adb input text` 兜底。

## 无视觉模型降级

如果 agent 服务没有接入视觉模型：

* 不分析 `frameAssets`。
* 只使用 `visibleText` 和 `ocrText`。
* 文本信号不足时返回停留时长建议或跳过原因。
* 文本信号不足时不建议点赞。
* 文本信号不足时不建议评论。
