---
name: instagram-warmup-orchestrator
description: 根据注册日期，生成 Instagram 每日养号计划和执行结果汇总。
---

# instagram-warmup-orchestrator

## 职责

本 skill 只生成 Instagram 养号总计划和执行结果汇总，不执行计划。

适用于需要根据账号注册日期、当前日期、关键词、素材库路径和语言要求，生成当天 Instagram 养号任务结构化建议的场景。

## 使用边界

* 可以根据账号注册日期和当前日期判断养号阶段。
* 可以生成今日任务计划和工具参数草案。
* 可以汇总 agent 服务回传的真实执行日志。
* 可以给出下一次建议执行时间。
* 不执行点赞、评论、发帖或资料编辑。
* 不调用其他 skill tool、provider、MCP tool 或 `ctx.instagram`。
* runner、循环、等待、超时、中断和状态管理由 agent 服务负责。
* 不生成头像、名字、简介。
* 不生成发布文案、图片、视频。
* 不判断单条视频是否点赞或评论。
* 不需要传入模型名称；模型能力由 agent 底座自行管理。

## 前置条件（满足以下其一）
* 使用`instagram-aiograpi-rest` skill获取账号注册日期
  * 满足此条件时，需要使用`instagram_warmup_plan`工具生成养号计划
* 已完成本日养号计划的所有步骤
  * 满足此条件时，需要使用`instagram_warmup_result_summarize`工具生成执行汇总日志

## 注册工具

* `instagram_warmup_plan`
* `instagram_warmup_result_summarize`

## CLI 命令入口

发布后的 skill 包提供 CLI 入口，agent 可以在 skill 目录内直接调用：

```powershell
node .\dist\cli.bundle.js list-tools
node .\dist\cli.bundle.js invoke --action instagram_warmup_plan --input-json '{"accountId":"ig-account-001","sessionRef":"session-ref-001","registeredAt":"2026-08-01","currentDate":"2026-08-03","targetLanguage":"zh","keywords":["fitness","food"]}'
node .\dist\cli.bundle.js invoke --action instagram_warmup_result_summarize --input-json warmup-summary.json
```

如果 agent runtime 已把本 skill 的 `bin` 暴露到 `PATH`，也可以使用：

```powershell
instagram-warmup-orchestrator list-tools
instagram-warmup-orchestrator invoke --action instagram_warmup_plan --input-json warmup-plan.json
instagram-warmup-orchestrator invoke --action instagram_warmup_result_summarize --input-json -
```

`--input-json` 支持内联 JSON、JSON 文件路径和 stdin `-`。CLI 输出固定为 `{ "ok": true, "result": ... }`，失败时输出 `{ "ok": false, "error": { "code": "...", "message": "..." } }`。

## instagram_warmup_plan

必需输入：

```text
accountId
sessionRef
registeredAt
currentDate
```

可选输入：

```text
targetLanguage
materialLibraryPath
keywords
```

输出：

```text
accountId
sessionRef
date
stage
tasks
nextSuggestedRunAt
```

`stage` 只会是：

```text
day_1_5
day_6_14
stable
```

`tasks` 中的 `toolHints` 只是建议 agent 服务后续可调用的工具名称，本 skill 不会调用这些工具。

输入示例：

```json
{
  "accountId": "ig-account-001",
  "sessionRef": "session-ref-001",
  "registeredAt": "2026-08-01",
  "currentDate": "2026-08-03",
  "targetLanguage": "zh",
  "materialLibraryPath": "materials/instagram",
  "keywords": ["fitness", "food"]
}
```

输出中的每个任务都包含：

```text
taskId
type
skill
toolHints
suggestedInput
reason
```

输出示例：

```json
{
  "accountId": "ig-account-001",
  "sessionRef": "session-ref-001",
  "date": "2026-08-03",
  "stage": "day_1_5",
  "tasks": [
    {
      "taskId": "profile-setup-001",
      "type": "profile_setup",
      "skill": "instagram-profile-setup",
      "toolHints": ["instagram_profile_generate", "instagram_profile_edit_plan"],
      "suggestedInput": {
        "accountId": "ig-account-001",
        "sessionRef": "session-ref-001",
        "targets": ["displayName", "biography", "avatar"],
        "materialLibraryPath": "materials/instagram",
        "targetLanguage": "zh"
      },
      "reason": "账号处于早期养号阶段，需要完善基础资料，提高账号可信度"
    },
    {
      "taskId": "video-interaction-001",
      "type": "video_interaction",
      "skill": "instagram-video-interaction",
      "toolHints": [
        "instagram.app.open",
        "instagram.search.open",
        "instagram.search.input",
        "instagram.search.open_first_reel",
        "instagram.reel.collect_signals",
        "instagram_video_evaluate",
        "instagram_video_comment_generate",
        "instagram.reel.like",
        "instagram.reel.comment",
        "instagram.reel.next",
        "instagram_video_log_summarize"
      ],
      "suggestedInput": {
        "accountId": "ig-account-001",
        "sessionRef": "session-ref-001",
        "keywords": ["fitness", "food"],
        "durationMs": 1800000,
        "maxLikes": 5,
        "maxComments": 2,
        "minDwellMs": 5000,
        "maxDwellMs": 15000,
        "targetLanguage": "zh"
      },
      "reason": "账号需要持续浏览同类型短视频并进行轻量互动，形成稳定用户轨迹"
    }
  ],
  "nextSuggestedRunAt": "2026-08-04T09:00:00.000Z"
}
```

如果 `keywords` 未传入或为空，计划会使用默认关键词草案。agent 服务可以根据业务上下文替换这些关键词后再执行。

`toolHints` 只是后续执行建议，不代表工具已经执行，也不代表这些工具必须全部调用。agent 服务必须根据当前页面状态、权限、用户确认和工具返回结果自行决定是否继续执行。

## 内容发布边界

本期只发布 5 个 skills，不包含 `instagram-content-publish`。

因此 `instagram_warmup_plan` 不生成 `content_publish` 任务，也不会建议 agent 调用内容发布 skill。

如果用户要求内容发布，agent 服务应明确说明当前已安装 skills 不包含内容发布能力；不得把视频互动、资料生成或 connector 操作伪装成发布流程。

## instagram_warmup_result_summarize

必需输入：

```text
accountId
date
stage
items
```

`items` 必须是 agent 服务真实执行后的日志列表，状态只能是：

```text
succeeded
failed
skipped
```

本工具只统计真实日志，不补跑失败任务，不把失败任务改写为成功。

`items` 中的每一项包含：

```text
taskId
type
status
startedAt
endedAt
toolResults
reason
```

汇总输入示例：

```json
{
  "accountId": "ig-account-001",
  "date": "2026-08-03",
  "stage": "day_1_5",
  "items": [
    {
      "taskId": "profile-setup-001",
      "type": "profile_setup",
      "status": "succeeded",
      "startedAt": "2026-08-03T01:00:00.000Z",
      "endedAt": "2026-08-03T01:02:00.000Z",
      "toolResults": []
    },
    {
      "taskId": "video-interaction-001",
      "type": "video_interaction",
      "status": "failed",
      "startedAt": "2026-08-03T01:03:00.000Z",
      "endedAt": "2026-08-03T01:05:00.000Z",
      "toolResults": [
        {
          "tool": "instagram.search.open_first_reel",
          "status": "FAILED",
          "code": "UI_DUMP_IDLE_TIMEOUT"
        }
      ],
      "reason": "连续两次无法稳定采集页面，停止当前视频任务"
    }
  ]
}
```

汇总输出示例：

```json
{
  "accountId": "ig-account-001",
  "date": "2026-08-03",
  "stage": "day_1_5",
  "totalTaskCount": 2,
  "succeededTaskCount": 1,
  "failedTaskCount": 1,
  "skippedTaskCount": 0,
  "items": []
}
```

实际输出会保留输入的 `items` 原文，不会清空或改写失败项。

## 阶段规则

| 阶段 | 条件 | 任务倾向 |
| --- | --- | --- |
| `day_1_5` | 注册第 1 到 5 天 | 资料建设、视频互动 |
| `day_6_14` | 注册第 6 到 14 天 | 视频互动 |
| `stable` | 注册第 15 天及以后 | 常规视频互动 |

`registeredAt` 和 `currentDate` 必须由 agent 服务传入明确的 `YYYY-MM-DD` 日期。本 skill 不读取系统当前时间。

失败规则：

* `accountId`、`sessionRef`、`registeredAt` 或 `currentDate` 缺失时直接失败。
* `registeredAt` 或 `currentDate` 不是 `YYYY-MM-DD` 时直接失败。
* `currentDate` 早于 `registeredAt` 时直接失败。
* 本 skill 不会为了避免失败而返回空计划。

## agent 服务执行责任

agent 服务拿到计划后，负责：

* 调用 `instagram-profile-setup`、`instagram-video-interaction` 或 `instagram-connector`。
* 控制循环、等待、超时、中断和恢复。
* 对点赞、评论、发布、资料编辑等副作用动作取得明确确认。
* 记录每一步真实执行日志。
* 把执行日志传回 `instagram_warmup_result_summarize`。
