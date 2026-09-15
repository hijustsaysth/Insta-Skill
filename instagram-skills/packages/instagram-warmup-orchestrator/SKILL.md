---
name: instagram-warmup-orchestrator
description: 根据注册日期，生成 Instagram 每日养号计划和执行结果汇总。
---

# instagram-warmup-orchestrator

## 职责与边界

本 skill 只生成养号计划、工具参数草案和真实执行结果汇总，不执行计划。它可判断养号阶段、给出下次建议时间，但不调用其他 skill tool、provider、MCP tool 或 `ctx.instagram`，不执行点赞、评论、发帖、资料编辑，也不生成头像、资料、文案、图片或视频，不判断单条视频是否互动。runner、循环、等待、超时、中断、状态和模型由 agent 服务管理。

前置条件满足其一：

* 已用 `instagram-aiograpi-rest` 取得注册日期：调用 `instagram_warmup_plan`。
* 本日计划全部完成：调用 `instagram_warmup_result_summarize`。

注册工具：`instagram_warmup_plan`、`instagram_warmup_result_summarize`。

## CLI

在当前 skill 目录运行：

```powershell
node .\dist\cli.bundle.js list-tools
node .\dist\cli.bundle.js invoke --action instagram_warmup_plan --input-json '{"accountId":"ig-account-001","sessionRef":"session-ref-001","registeredAt":"2026-08-01","currentDate":"2026-08-03","targetLanguage":"zh","keywords":["fitness"]}'
node .\dist\cli.bundle.js invoke --action instagram_warmup_result_summarize --input-json warmup-summary.json
```

也支持 PATH bin。`--input-json` 接受内联 JSON、文件或 stdin `-`；CLI 返回 `{ "ok": true, "result": ... }`，失败返回 `{ "ok": false, "error": { "code": "...", "message": "..." } }`。

## `instagram_warmup_plan`

* 必填：`accountId`、`sessionRef`、`registeredAt`、`currentDate`。
* 可选：`targetLanguage`、`materialLibraryPath`、`keywords`。
* 输出：`accountId`、`sessionRef`、`date`、`stage`、`tasks`、`nextSuggestedRunAt`。
* 每个 task：`taskId`、`type`、`skill`、`toolHints`、`suggestedInput`、`reason`。
* `stage`：`day_1_5`、`day_6_14` 或 `stable`。

`keywords` 缺失或为空时使用默认草案，agent 服务可按上下文替换。`toolHints` 仅是后续工具建议，不代表已执行或必须全部调用；agent 服务须按页面、权限、用户确认和返回结果决定是否执行。

计划可建议的执行工具包括：`instagram_profile_generate`、`instagram_profile_edit_plan`、`instagram.app.open`、`instagram.search.open`、`instagram.search.input`、`instagram.search.open_first_reel`、`instagram.reel.collect_signals`、`instagram_video_evaluate`、`instagram.reel.like`、`instagram.reel.comment`、`instagram.reel.next`、`instagram_video_log_summarize`。

评论文本由 agent 根据当前 Reel 信号和下方评论临场起草，不是工具调用，不得写入 `toolHints`。

### 阶段规则

| 阶段 | 条件 | 任务倾向 |
| --- | --- | --- |
| `day_1_5` | 注册第 1 到 5 天 | 资料建设、视频互动 |
| `day_6_14` | 注册第 6 到 14 天 | 视频互动 |
| `stable` | 注册第 15 天及以后 | 常规视频互动 |

`registeredAt` 和 `currentDate` 必须由 agent 服务以 `YYYY-MM-DD` 传入；本 skill 不读取系统时间。以下情况直接失败且不返回空计划：任一必填字段缺失、日期格式错误、`currentDate` 早于 `registeredAt`。

### 发布边界

当前发布的 5 个 skills 不含 `instagram-content-publish`，因此不生成 `content_publish` 任务。用户要求发布时，应说明能力未安装，不得用视频互动、资料生成或 connector 操作伪装发布。

## `instagram_warmup_result_summarize`

* 必填：`accountId`、`date`、`stage`、`items`。
* 每个 item：`taskId`、`type`、`status`、`startedAt`、`endedAt`、`toolResults`、`reason`。
* `status` 只能是 `succeeded`、`failed`、`skipped`。
* 输出：`accountId`、`date`、`stage`、`totalTaskCount`、`succeededTaskCount`、`failedTaskCount`、`skippedTaskCount`、`items`。

`items` 必须来自 agent 服务的真实执行日志。本工具只统计并原样保留日志，不补跑失败任务、不清空或改写失败项，也不把失败改为成功。

## agent 服务责任

agent 服务负责调用 `instagram-profile-setup`、`instagram-video-interaction` 或 `instagram-connector`；控制循环、等待、超时、中断和恢复；对点赞、评论、发布、资料编辑等副作用取得明确确认；记录每步真实日志并传给汇总工具。`sessionRef` 只由 agent 服务或 provider 执行层处理，本 skill 不解析、不打印。
