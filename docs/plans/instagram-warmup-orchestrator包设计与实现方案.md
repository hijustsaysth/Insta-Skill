# instagram-warmup-orchestrator 包设计与实现方案

## 目标

`instagram-warmup-orchestrator` 是 Instagram 养号总编排 skill 包，负责根据账号注册日期、当前日期和业务输入生成今日养号计划，并在 agent 服务执行完成后汇总执行结果。

第一版目标：

```text
判断养号阶段
  → 生成今日任务计划
  → 指定应调用的 skills / MCP tools
  → 给出工具参数草案
  → 汇总 agent 服务回传的执行日志
```

本包只生成计划，不执行计划。

## 定位

`instagram-warmup-orchestrator` 属于业务 skill/tool 层中的总编排能力。

它不实现具体能力，也不直接操作 Instagram。

```text
instagram-warmup-orchestrator
  → 生成养号阶段和今日任务计划
  → 输出工具调用建议和参数草案
  → 汇总执行结果

agent 服务
  → 执行计划
  → 调用 skill tools / MCP tools
  → 控制循环、等待、超时、中断和状态

具体能力包
  → profile / video / publish 的生成、判断和汇总

instagram-connector MCP Server
  → 移动端搜索、采集、点赞、评论、滑动
```

## 职责

* 根据账号注册日期和当前日期判断养号阶段
* 根据阶段生成今日任务计划
* 指定任务应使用的 skill 包
* 指定任务可调用的 tool / MCP tool
* 为任务生成参数草案
* 给出每个任务的生成原因
* 给出下一次建议执行时间
* 汇总 agent 服务回传的执行日志

## 非职责

* 不直接调用 Instagram
* 不直接调用 MCP tools
* 不直接调用 aiograpi-rest 或 official-api
* 不实现半小时循环 runner
* 不等待 `dwellMs`
* 不处理超时、中断、重试、恢复
* 不生成头像、名字、简介
* 不生成发布文案、图片、视频
* 不判断单条视频是否点赞或评论
* 不执行点赞、评论、发帖或资料编辑
* 不做多账号调度

## 包依赖

### 允许依赖

* tool 注册能力
* 底座已有 LLM 能力，按需用于计划说明生成

### 不允许依赖

* `instagram-core`
* `instagram`
* `instagram-aiograpi-rest`
* `instagram-official-api`
* `instagram-connector` 源码
* `local-mobile-runtime`
* ADB、Playwright、浏览器自动化 SDK
* `instagram-profile-setup`
* `instagram-video-interaction`
* `instagram-content-publish`

说明：第一版只输出计划和 tool 名称，不直接 import 具体能力包。

## 包路径建议

采用 monorepo 方式开发，建议放在：

```text
instagram-skills/packages/instagram-warmup-orchestrator
```

包名建议：

```text
@instagram-skills/instagram-warmup-orchestrator
```

## 文件结构建议

```text
instagram-skills/packages/instagram-warmup-orchestrator/
  SKILL.md
  package.json
  tsconfig.json
  src/
    index.ts
    tools.ts
    plan.ts
    stage.ts
    summarize.ts
    schema.ts
    limits.ts
```

## 模块职责

| 文件 | 职责 |
| --- | --- |
| `SKILL.md` | skill 主入口，说明适用场景、计划生成规则、工具边界和执行责任归属 |
| `index.ts` | 插件入口，注册本包 tools |
| `tools.ts` | 定义并注册养号编排 tools |
| `plan.ts` | 生成今日养号任务计划 |
| `stage.ts` | 根据注册日期计算养号阶段 |
| `summarize.ts` | 汇总 agent 服务回传的执行日志 |
| `schema.ts` | 定义 tool 输入输出 schema |
| `limits.ts` | 定义第一版写死的阶段和任务限制 |

## SKILL.md 设计

`SKILL.md` 是本包作为 skill 被 agent 使用时的主入口。它必须明确说明：本包只生成计划和汇总结果，不执行计划。

`SKILL.md` 第一版应包含：

* 适用场景：Instagram 养号阶段判断和今日任务计划生成
* 必需输入：账号、`sessionRef`、注册日期、当前日期、语言要求、素材库路径、关键词
* 输出内容：阶段、任务列表、工具提示、参数草案、下一次建议执行时间
* 阶段判断规则
* 本包只生成计划，不调用任何工具执行计划
* agent 服务负责执行、循环、等待、超时、中断、状态管理
* 具体能力由 `instagram-profile-setup`、`instagram-video-interaction`、`instagram-content-publish` 和 `instagram-connector` MCP tools 承接
* 执行完成后，agent 服务把日志传回本包做汇总
* 失败时不伪造执行结果

## 注册工具

第一版注册两个工具。

| 工具名 | 作用 |
| --- | --- |
| `instagram_warmup_plan` | 根据账号信息生成今日养号结构化计划 |
| `instagram_warmup_result_summarize` | 汇总 agent 服务执行后的任务日志 |

## 工具设计

### instagram_warmup_plan

输入：

```ts
export interface InstagramWarmupPlanRequest {
  accountId: string;
  sessionRef: string;
  registeredAt: string;
  currentDate: string;
  targetLanguage?: string;
  materialLibraryPath?: string;
  keywords?: string[];
}
```

输出：

```ts
export type InstagramWarmupStage = "day_1_5" | "day_6_14" | "stable";

export interface InstagramWarmupPlan {
  accountId: string;
  sessionRef: string;
  date: string;
  stage: InstagramWarmupStage;
  tasks: InstagramWarmupTask[];
  nextSuggestedRunAt?: string;
}

export interface InstagramWarmupTask {
  taskId: string;
  type: "profile_setup" | "video_interaction" | "content_publish";
  skill: string;
  toolHints: string[];
  suggestedInput: Record<string, unknown>;
  reason: string;
}
```

说明：

* `instagram_warmup_plan` 只输出计划
* `toolHints` 只表示建议 agent 服务调用哪些 tools
* `suggestedInput` 只提供参数草案
* 本工具不调用 `toolHints` 中的任何 tool
* 本工具不返回执行结果

### instagram_warmup_result_summarize

输入：

```ts
export interface InstagramWarmupExecutionLogItem {
  taskId: string;
  type: "profile_setup" | "video_interaction" | "content_publish";
  status: "succeeded" | "failed" | "skipped";
  startedAt: string;
  endedAt: string;
  toolResults?: Record<string, unknown>[];
  reason?: string;
}

export interface InstagramWarmupResultSummarizeRequest {
  accountId: string;
  date: string;
  stage: InstagramWarmupStage;
  items: InstagramWarmupExecutionLogItem[];
}
```

输出：

```ts
export interface InstagramWarmupResultSummary {
  accountId: string;
  date: string;
  stage: InstagramWarmupStage;
  totalTaskCount: number;
  succeededTaskCount: number;
  failedTaskCount: number;
  skippedTaskCount: number;
  items: InstagramWarmupExecutionLogItem[];
}
```

说明：

* 本工具只汇总 agent 服务已经执行完成的日志
* 不补跑失败任务
* 不伪造工具执行结果

## 阶段规则

第一版阶段规则直接写死，不做配置项。

| 阶段 | 条件 | 主要任务 |
| --- | --- | --- |
| `day_1_5` | 注册第 1 到 5 天 | 资料建设、同类型视频观看互动 |
| `day_6_14` | 注册第 6 到 14 天 | 同类型视频互动、少量内容发布建议 |
| `stable` | 注册第 15 天及以后 | 常规互动、内容发布建议 |

日期计算以自然日为单位。`registeredAt` 和 `currentDate` 必须由 agent 服务传入明确日期，本包不读取系统当前时间。

## 计划示例

### 视频互动任务

```json
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
    "durationMs": 1800000,
    "maxLikes": 5,
    "maxComments": 2,
    "minDwellMs": 5000,
    "maxDwellMs": 15000
  },
  "reason": "账号处于早期养号阶段，需要轻量浏览同类型短视频并少量互动"
}
```

### 资料建设任务

```json
{
  "taskId": "profile-setup-001",
  "type": "profile_setup",
  "skill": "instagram-profile-setup",
  "toolHints": [
    "instagram_profile_generate",
    "instagram_profile_edit_plan"
  ],
  "suggestedInput": {
    "targets": ["displayName", "biography", "avatar"],
    "materialLibraryPath": "materials/instagram"
  },
  "reason": "账号早期需要完善基础资料，提高账号可信度"
}
```

### 内容发布任务

```json
{
  "taskId": "content-publish-001",
  "type": "content_publish",
  "skill": "instagram-content-publish",
  "toolHints": [
    "instagram_content_generate",
    "instagram_content_publish_plan",
    "instagram_publish_status_plan"
  ],
  "suggestedInput": {
    "type": "post",
    "targetLanguage": "en"
  },
  "reason": "账号进入稳定阶段后可进行常规内容发布"
}
```

## agent 服务执行责任

计划执行交给 agent 服务。

agent 服务负责：

* 按计划调用 skill tools / MCP tools
* 控制循环
* 等待 `dwellMs`
* 管理超时
* 处理中断
* 记录每一步执行状态
* 把执行日志传给 `instagram_warmup_result_summarize`

本包不提供 runner，也不实现工具调用工具。

## 与其他包的关系

| 包 | 关系 |
| --- | --- |
| `instagram-profile-setup` | 本包只生成资料建设任务，不生成头像、名字、简介 |
| `instagram-video-interaction` | 本包只生成互动任务，不判断单条视频、不生成评论 |
| `instagram-content-publish` | 本包只生成发布任务，不生成或发布内容 |
| `instagram-connector` | 本包只在 `toolHints` 中引用 MCP tools，不直接调用 connector |
| `instagram-core` | 第一版不依赖 |
| `instagram-aiograpi-rest` | 第一版不依赖 |
| `instagram-official-api` | 第一版不依赖 |

## 第一版写死限制

| 规则 | 限制 |
| --- | --- |
| `registeredAt` | 必须传入明确日期 |
| `currentDate` | 必须传入明确日期 |
| `keywords` | 视频互动任务至少需要 1 个关键词；未传时使用通用同类内容关键词草案 |
| 视频互动时长 | 计划草案默认 30 分钟 |
| 点赞上限 | 计划草案默认 5 次 |
| 评论上限 | 计划草案默认 2 次 |
| 停留时间 | 计划草案默认 5 到 15 秒 |

## 错误处理

* 输入日期缺失或格式非法时直接失败
* `currentDate` 早于 `registeredAt` 时直接失败
* 任务计划生成失败时直接失败，不返回空计划
* 执行日志汇总只统计输入日志，不补造缺失日志
* 不吞掉 agent 服务传入的失败状态
* 不把失败任务改写为成功

## 实现步骤

1. 新建 `@instagram-skills/instagram-warmup-orchestrator` 包。
2. 在包根目录创建 `SKILL.md`。
3. 定义两个 tool 的输入输出 schema。
4. 在 `stage.ts` 实现阶段判断。
5. 在 `limits.ts` 写死第一版计划限制。
6. 实现 `instagram_warmup_plan`。
7. 实现 `instagram_warmup_result_summarize`。
8. 在插件入口注册两个 tools。
9. 用固定日期样例验证阶段判断。
10. 用 mock 执行日志验证结果汇总。

## 验收场景

| 场景 | 用例 | 预期 |
| --- | --- | --- |
| SKILL.md 入口 | 检查包根目录 | 存在 `SKILL.md`，说明计划职责和执行责任归属 |
| 第 1 到 5 天阶段 | 注册日期到当前日期落在第 1 到 5 天 | `stage=day_1_5` |
| 第 6 到 14 天阶段 | 注册日期到当前日期落在第 6 到 14 天 | `stage=day_6_14` |
| 稳定阶段 | 注册日期到当前日期大于等于 15 天 | `stage=stable` |
| 生成今日计划 | 输入账号、session、日期、关键词 | 返回阶段、任务列表、工具提示和参数草案 |
| 计划不执行工具 | 调用 `instagram_warmup_plan` | 不调用任何 skill tool 或 MCP tool |
| 视频互动任务 | 早期阶段生成视频互动任务 | 包含 connector MCP tools 和 video-interaction tools 的 `toolHints` |
| 资料建设任务 | 早期阶段生成资料建设任务 | 包含 profile setup tools 的 `toolHints` |
| 发布任务 | 稳定阶段生成发布任务建议 | 包含 content publish tools 的 `toolHints` |
| 当前日期早于注册日期 | `currentDate < registeredAt` | 直接失败 |
| 汇总成功日志 | 输入多条成功执行日志 | 返回成功任务数量 |
| 汇总失败日志 | 输入成功、失败、跳过混合日志 | 按状态正确统计，不改写失败 |
| 依赖边界 | 编译本包 | 不依赖 core、provider、connector 源码或具体能力包 |

## 验证标准

* 包根目录存在 `SKILL.md`
* `SKILL.md` 明确说明本包只生成计划，不执行计划
* `SKILL.md` 明确说明 agent 服务负责执行、循环、等待、超时、中断和状态管理
* `instagram_warmup_plan` 能输出阶段、任务列表、工具提示和参数草案
* `instagram_warmup_result_summarize` 能汇总执行日志
* 本包不直接调用任何 skill tool
* 本包不直接调用任何 MCP tool
* 本包不实现 runner
* 本包职责符合最新 skill 标准

## 第一版不做

* 不做计划执行
* 不做半小时循环 runner
* 不做定时任务系统
* 不做多账号调度
* 不做工具调用工具
* 不做失败补偿
* 不做 provider fallback
* 不做资料生成
* 不做内容生成
* 不做视频判断和评论生成
