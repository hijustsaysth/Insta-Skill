---
name: instagram-warmup-orchestrator
description: 根据注册日期，生成 Instagram 每日养号计划和执行结果汇总。
---

# instagram-warmup-orchestrator

仅生成养号计划并汇总真实执行日志，不执行计划或调用其他 skill/provider/MCP/`ctx.instagram`。不生成资料、头像、文案或媒体，不判断单条视频；runner、等待、超时、中断和状态由 agent 服务管理，无需传模型名。

前置条件二选一：已用 `instagram-aiograpi-rest` 取得注册日期，则调用 `instagram_warmup_plan`；或本日计划已全部完成，则调用 `instagram_warmup_result_summarize`。

## CLI

```powershell
node .\dist\cli.bundle.js list-tools
node .\dist\cli.bundle.js invoke --action instagram_warmup_plan --input-json '{"accountId":"ig-account-001","sessionRef":"session-ref-001","registeredAt":"2026-08-01","currentDate":"2026-08-03","keywords":["fitness"]}'
node .\dist\cli.bundle.js invoke --action instagram_warmup_result_summarize --input-json warmup-summary.json
```

`bin` 暴露时可用 `instagram-warmup-orchestrator`。`--input-json` 支持内联 JSON、文件、stdin `-`。输出为 `{ "ok": true, "result": ... }`；失败为 `{ "ok": false, "error": { "code": "...", "message": "..." } }`。

## `instagram_warmup_plan`

必需：`accountId`、`sessionRef`、`registeredAt`、`currentDate`；可选：`targetLanguage`、`materialLibraryPath`、`keywords`。输出：`accountId`、`sessionRef`、`date`、`stage`、`tasks`、`nextSuggestedRunAt`。每个 task 含 `taskId`、`type`、`skill`、`toolHints`、`suggestedInput`、`reason`。

```json
{"accountId":"ig-account-001","sessionRef":"session-ref-001","registeredAt":"2026-08-01","currentDate":"2026-08-03","targetLanguage":"zh","materialLibraryPath":"materials/instagram","keywords":["fitness","food"]}
```

| `stage` | 条件 | 任务倾向 |
| --- | --- | --- |
| `day_1_5` | 注册第 1-5 天 | 资料建设、视频互动 |
| `day_6_14` | 第 6-14 天 | 视频互动 |
| `stable` | 第 15 天起 | 常规视频互动 |

`registeredAt`、`currentDate` 必须由 agent 以 `YYYY-MM-DD` 传入，本 skill 不读系统时间；必填缺失、日期格式错误或当前日期早于注册日直接失败，且不以空计划规避失败。空/缺失 `keywords` 使用默认草案，agent 可替换。

`toolHints` 仅是建议，不表示已执行或必须全部调用；agent 依据页面、权限、确认和结果决定后续。本期 5 个 skills 不含 `instagram-content-publish`，故不生成 `content_publish`；用户要求发布时须明确能力缺失，不得用互动、资料或 connector 冒充发布。

## `instagram_warmup_result_summarize`

必需：`accountId`、`date`、`stage`、`items`。每项含 `taskId`、`type`、`status`、`startedAt`、`endedAt`、`toolResults`、`reason`；`status` 仅 `succeeded`、`failed`、`skipped`。

```json
{"accountId":"ig-account-001","date":"2026-08-03","stage":"day_1_5","items":[{"taskId":"video-interaction-001","type":"video_interaction","status":"failed","startedAt":"2026-08-03T01:03:00.000Z","endedAt":"2026-08-03T01:05:00.000Z","toolResults":[],"reason":"页面采集失败"}]}
```

输出含 `accountId`、`date`、`stage`、`totalTaskCount`、`succeededTaskCount`、`failedTaskCount`、`skippedTaskCount`、原始 `items`。只统计真实日志，不补跑或把失败改为成功。

agent 负责调用 `instagram-profile-setup`、`instagram-video-interaction` 或 `instagram-connector`，管理执行状态，对点赞/评论/发布/资料编辑取得明确确认，记录每步真实日志并传入汇总工具。
