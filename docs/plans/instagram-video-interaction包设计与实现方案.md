# instagram-video-interaction 包设计与实现方案

## 目标

`instagram-video-interaction` 是同类型短视频互动的业务决策包，负责根据搜索关键词、视频信号、目标说明和互动上限，判断当前 Reel / 短视频是否值得互动，并生成评论内容和行为日志。

第一版目标是跑通单条视频互动决策：

```text
connector MCP tools 采集当前 Reel 信号
  → instagram-video-interaction 判断是否匹配
  → instagram-video-interaction 生成评论
  → agent 服务调用 connector MCP tools 执行点赞 / 评论 / 下一条
  → instagram-video-interaction 汇总日志
```

## 定位

`instagram-video-interaction` 属于业务 skill/tool 层。

它不直接操作 Instagram，也不封装 Android UI 自动化。移动端操作由 `instagram-connector` MCP Server 提供。

```text
instagram-video-interaction
  → 互动策略、单条视频判断、评论生成、日志汇总

instagram-connector
  → App 打开、搜索、采集信号、点赞、评论、滑动

instagram-warmup-orchestrator
  → 生成养号阶段计划和视频互动任务建议

agent 服务
  → 执行半小时循环、等待、超时、中断和状态管理
```

## 职责

* 根据关键词、互动上限和停留时间生成互动计划
* 根据视频可见文本、OCR 文本、截图引用判断视频是否符合目标
* 判断是否点赞
* 判断是否评论
* 生成自然、轻量、非营销化评论
* 为每条视频生成结构化决策结果
* 汇总观看、点赞、评论、跳过等行为日志

## 非职责

* 不直接调用 Instagram API
* 不直接调用 aiograpi-rest
* 不直接调用 official-api
* 不直接执行 MCP tool
* 不注册搜索、点赞、评论、滑动等底层执行工具
* 不实现 Android selector、ADB、截图坐标点击
* 不实现自动半小时循环 runner
* 不做多账号调度
* 不做复杂风控恢复

## 包依赖

### 允许依赖

* tool 注册能力
* 底座已有 LLM 能力
* 可选视觉模型能力，用于分析 `reel.collect_signals` 返回的截图

### 不允许依赖

* `instagram-aiograpi-rest`
* `instagram-official-api`
* `instagram-connector` 源码或 Android SDK
* `local-mobile-runtime`
* ADB、Playwright、浏览器自动化 SDK
* `instagram-profile-setup`
* `instagram-content-publish`
* `instagram-warmup-orchestrator`

## 包路径建议

采用 monorepo 方式开发，建议放在：

```text
instagram-skills/packages/instagram-video-interaction
```

包名建议：

```text
@instagram-skills/instagram-video-interaction
```

## 文件结构建议

```text
instagram-skills/packages/instagram-video-interaction/
  SKILL.md
  package.json
  tsconfig.json
  src/
    index.ts
    tools.ts
    plan.ts
    evaluate.ts
    comment.ts
    log.ts
    schema.ts
    limits.ts
```

## 模块职责

| 文件 | 职责 |
| --- | --- |
| `SKILL.md` | skill 主入口，说明适用场景、调用流程、工具边界和降级策略 |
| `index.ts` | 插件入口，注册本包 tools |
| `tools.ts` | 定义并注册互动决策相关 tools |
| `plan.ts` | 生成本次互动计划 |
| `evaluate.ts` | 判断单条视频是否匹配、是否点赞、是否评论 |
| `comment.ts` | 根据视频信号生成评论 |
| `log.ts` | 汇总行为日志 |
| `schema.ts` | 定义 tool 输入输出 schema |
| `limits.ts` | 定义第一版写死的业务限制 |

## 注册工具

第一版注册四个工具。

| 工具名 | 作用 |
| --- | --- |
| `instagram_video_interaction_plan` | 根据关键词、互动上限、停留时间生成本次互动计划 |
| `instagram_video_evaluate` | 根据视频信号判断是否符合目标、是否点赞、是否评论 |
| `instagram_video_comment_generate` | 根据视频信号和评论风格生成评论 |
| `instagram_video_log_summarize` | 汇总观看、点赞、评论、跳过记录 |

不注册以下工具：

| 不注册工具 | 原因 |
| --- | --- |
| `instagram_video_search` | 由 `instagram-connector` MCP tools 执行搜索 |
| `instagram_video_like` | 由 `instagram.reel.like` 执行 |
| `instagram_video_comment` | 由 `instagram.reel.comment` 执行 |
| `instagram_video_next` | 由 `instagram.reel.next` 执行 |

## 工具设计

### instagram_video_interaction_plan

输入：

```ts
export interface InstagramVideoInteractionPlanRequest {
  accountId: string;
  sessionRef: string;
  keywords: string[];
  targetDescription: string;
  maxLikes: number;
  maxComments: number;
  minDwellMs: number;
  maxDwellMs: number;
  commentStylePrompt?: string;
}
```

输出：

```ts
export interface InstagramVideoInteractionPlan {
  accountId: string;
  sessionRef: string;
  keywords: string[];
  targetDescription: string;
  maxLikes: number;
  maxComments: number;
  minDwellMs: number;
  maxDwellMs: number;
  commentStylePrompt?: string;
  startedAt: string;
}
```

说明：

* 只生成计划，不打开 Instagram
* 不执行半小时循环
* `sessionRef` 只透传给后续 connector MCP tools 使用

### instagram_video_evaluate

输入：

```ts
export interface InstagramVideoEvaluateRequest {
  accountId: string;
  keyword: string;
  targetDescription: string;
  visibleText?: string[];
  ocrText?: string[];
  frameAssets?: string[];
  visionModelAvailable?: boolean;
  remainingLikeCount: number;
  remainingCommentCount: number;
  minDwellMs: number;
  maxDwellMs: number;
}
```

输出：

```ts
export interface InstagramVideoEvaluateResult {
  matched: boolean;
  shouldLike: boolean;
  shouldComment: boolean;
  commentIntent?: string;
  dwellMs: number;
  skipReason?: string;
}
```

说明：

* `visibleText`、`ocrText`、`frameAssets` 来自 `instagram.reel.collect_signals`
* `visionModelAvailable=false` 或底座未接入视觉模型时，不分析 `frameAssets`
* `shouldLike` 和 `shouldComment` 只能在剩余次数大于 0 时返回 `true`
* 没有足够信号判断时返回 `matched=false` 和 `skipReason`
* 本工具只输出决策，不执行点赞或评论

### instagram_video_comment_generate

输入：

```ts
export interface InstagramVideoCommentGenerateRequest {
  accountId: string;
  targetDescription: string;
  visibleText?: string[];
  ocrText?: string[];
  commentIntent?: string;
  commentStylePrompt?: string;
  targetLanguage?: string;
}
```

输出：

```ts
export interface InstagramVideoCommentGenerateResult {
  commentText: string;
}
```

说明：

* 评论应自然、轻量、像真实用户反馈
* 不输出解释文本
* 不自动调用 `instagram.reel.comment`

### instagram_video_log_summarize

输入：

```ts
export interface InstagramVideoInteractionLogItem {
  action: "watch" | "like" | "comment" | "skip";
  keyword: string;
  matched: boolean;
  commentText?: string;
  dwellMs: number;
  resultStatus: "succeeded" | "failed" | "skipped";
  reason?: string;
  actedAt: string;
}

export interface InstagramVideoLogSummarizeRequest {
  accountId: string;
  startedAt: string;
  endedAt: string;
  items: InstagramVideoInteractionLogItem[];
}
```

输出：

```ts
export interface InstagramVideoLogSummary {
  accountId: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  watchedCount: number;
  likedCount: number;
  commentedCount: number;
  skippedCount: number;
  items: InstagramVideoInteractionLogItem[];
}
```

## 提示词模板

### 视频判断提示词

用途：`instagram_video_evaluate` 判断当前 Reel 是否符合目标、是否点赞、是否评论。

```text
你是 Instagram 轻量互动判断助手。

根据以下信息判断当前短视频是否适合互动：
- 搜索关键词：{{keyword}}
- 目标说明：{{targetDescription}}
- 页面可见文本：{{visibleText}}
- OCR 文本：{{ocrText}}
- 剩余点赞次数：{{remainingLikeCount}}
- 剩余评论次数：{{remainingCommentCount}}

要求：
1. 只在内容和目标说明明显相关时，matched 才返回 true。
2. 不要为了完成数量强行点赞或评论。
3. 如果剩余点赞次数为 0，shouldLike 必须为 false。
4. 如果剩余评论次数为 0，shouldComment 必须为 false。
5. 评论只适合真实、有上下文、不会打扰对方的视频。
6. 没有足够信息时跳过。
7. dwellMs 必须在 {{minDwellMs}} 到 {{maxDwellMs}} 之间。
8. 只返回 JSON，不要解释。

输出格式：
{
  "matched": true,
  "shouldLike": true,
  "shouldComment": false,
  "commentIntent": "string | null",
  "dwellMs": 8000,
  "skipReason": "string | null"
}
```

### 评论生成提示词

用途：`instagram_video_comment_generate` 生成评论文本。

```text
你是 Instagram 普通用户评论助手。

根据以下信息生成一条自然、轻量的 Instagram 评论：
- 目标说明：{{targetDescription}}
- 页面可见文本：{{visibleText}}
- OCR 文本：{{ocrText}}
- 评论意图：{{commentIntent}}
- 评论风格要求：{{commentStylePrompt}}
- 目标语言：{{targetLanguage}}

要求：
1. 评论要短，像真实用户随手评论。
2. 不要硬广，不要推销，不要引导私信。
3. 不要包含链接、邮箱、电话、WhatsApp、价格或促销话术。
4. 不要夸大承诺，不要冒充官方或专业身份。
5. 不要使用与视频无关的模板化夸赞。
6. 只返回 JSON，不要解释。

输出格式：
{
  "commentText": "string"
}
```

## SKILL.md 设计

`SKILL.md` 是本包作为 skill 被 agent 使用时的主入口。TS 代码只负责可执行实现，`SKILL.md` 负责告诉 agent 何时使用本 skill、如何组合本包 tools 和 `instagram-connector` MCP tools。

`SKILL.md` 第一版应包含：

* 适用场景：同类型 Reels / 短视频观看、轻量点赞、轻量评论
* 必需输入：账号、`sessionRef`、关键词、目标说明、互动上限、停留时间、评论风格
* 推荐流程：先由 connector MCP tools 搜索和采集信号，再由本包判断和生成评论
* 工具边界：本包不执行搜索、点赞、评论、滑动
* 无视觉模型降级策略
* 评论安全限制
* 行为日志输出要求
* 自动半小时 runner 不在本包内执行

## 无视觉模型降级策略

`instagram-video-interaction` 不能把截图当成已经理解的视频内容。agent 服务没有接入视觉模型时，按以下策略降级：

| 能力状态 | 可用信号 | 策略 |
| --- | --- | --- |
| 有视觉模型 | `frameAssets`、`visibleText`、`ocrText` | 可结合截图、OCR 和页面文本判断 |
| 无视觉模型，有文本信号 | `visibleText` 或 `ocrText` | 只基于文本信号判断，互动决策更保守 |
| 无视觉模型，文本信号不足 | 无有效 `visibleText` / `ocrText` | 只观看和停留，不点赞、不评论 |

降级规则：

* 未接入视觉模型时，不分析 `frameAssets`
* 文本信号足够时，可以基于 `visibleText` / `ocrText` 判断 `matched`
* 文本信号不足时，返回 `matched=false`
* 文本信号不足时，`shouldLike=false`
* 文本信号不足时，`shouldComment=false`
* 文本信号不足时，`skipReason="insufficient_signals_without_vision_model"`
* 评论生成必须有足够文本上下文；否则直接失败，不返回空评论或模板评论
* 后续 runner 可以继续执行观看、停留和下一条，但不能强行互动

## 第一版写死限制

| 规则 | 限制 |
| --- | --- |
| `keywords` | 至少 1 个关键词 |
| `maxLikes` | 大于等于 0 |
| `maxComments` | 大于等于 0 |
| `minDwellMs` | 大于 0 |
| `maxDwellMs` | 必须大于等于 `minDwellMs` |
| 评论文本 | 不能为空 |
| 评论内容 | 不允许包含链接、联系方式、硬广、价格、促销承诺 |
| 信号不足 | 默认跳过，不生成点赞或评论动作 |
| 无视觉模型 | 不分析截图，只使用文本和 OCR 信号 |

## 与 instagram-connector 的关系

`instagram-video-interaction` 不执行移动端动作。

移动端动作由 `instagram-connector` MCP tools 提供：

```text
instagram.app.open
instagram.search.open
instagram.search.input
instagram.search.open_first_reel
instagram.reel.collect_signals
instagram.reel.like
instagram.reel.comment
instagram.reel.next
```

在 `deepseek-harness` 中，这些工具由 `@deepseek-ai/dsh-mcp-client` 接入后注册到 `ctx.tools`。其他支持 MCP 的 agent 底座也可以直接连接 `instagram-connector` MCP Server。

## 与 instagram-warmup-orchestrator 的关系

自动半小时循环 runner 由 agent 服务实现，不放在 `instagram-video-interaction` 或 `instagram-warmup-orchestrator` 中。

`instagram-warmup-orchestrator` 只负责生成视频互动任务计划和工具参数草案。agent 服务可按计划执行以下流程：

```text
agent 服务
  → 读取 instagram_warmup_plan 输出的视频互动任务
  → instagram.app.open
  → instagram.search.open
  → instagram.search.input
  → instagram.search.open_first_reel
  → while 未超过目标时长且未达到互动上限:
      → instagram.reel.collect_signals
      → instagram_video_evaluate
      → instagram_video_comment_generate
      → instagram.reel.like / instagram.reel.comment
      → 等待 dwellMs
      → instagram.reel.next
      → 记录日志
  → instagram_video_log_summarize
```

第一版 `instagram-video-interaction` 不实现 runner，`instagram-warmup-orchestrator` 也不实现 runner。

## 与 instagram-core 的关系

第一版不强依赖 `instagram-core`。

原因是当前 connector 路线已经确定为直接 MCP 方案，`instagram-connector` 第一版不包装成 `InstagramClient`。因此本包第一版只依赖 MCP connector 输出的普通 JSON 信号。

如果后续新增 MCP-backed `InstagramClient` 适配包，再评估是否让本包统一切回 `instagram-core`。

## 错误处理

* 输入字段不符合限制时直接失败
* 视频信号不足时返回跳过决策，不抛 provider 错误
* LLM 或视觉模型生成失败时直接失败，不返回假决策
* 评论生成失败时直接失败，不返回空评论
* 不吞掉底座模型错误
* 不伪造点赞、评论执行结果

## 实现步骤

1. 新建 `@instagram-skills/instagram-video-interaction` 包。
2. 在包根目录创建 `SKILL.md`。
3. 定义四个 tool 的输入输出 schema。
4. 在 `limits.ts` 写死第一版业务限制。
5. 实现 `instagram_video_interaction_plan`。
6. 实现 `instagram_video_evaluate`。
7. 实现 `instagram_video_comment_generate`。
8. 实现 `instagram_video_log_summarize`。
9. 在插件入口注册四个 tools。
10. 用固定视频信号样例验证判断逻辑。
11. 用无视觉模型样例验证降级策略。
12. 用 fake LLM 验证评论生成和日志汇总。

## 验收场景

| 场景 | 用例 | 预期 |
| --- | --- | --- |
| 计划生成 | 输入关键词、互动上限和停留时间 | 返回结构化互动计划 |
| 关键词缺失 | `keywords=[]` | 直接失败 |
| 停留时间非法 | `maxDwellMs < minDwellMs` | 直接失败 |
| 匹配视频判断 | 输入与目标相关的文本信号 | `matched=true` |
| 不匹配视频判断 | 输入明显无关的文本信号 | `matched=false`，返回 `skipReason` |
| 剩余点赞为 0 | `remainingLikeCount=0` | `shouldLike=false` |
| 剩余评论为 0 | `remainingCommentCount=0` | `shouldComment=false` |
| 信号不足 | 无 `visibleText`、`ocrText`、`frameAssets` | 返回跳过决策 |
| 无视觉模型但有文本 | `visionModelAvailable=false` 且存在 `visibleText` / `ocrText` | 只基于文本判断，不读取截图 |
| 无视觉模型且文本不足 | `visionModelAvailable=false` 且无有效文本 | `matched=false`、不点赞、不评论，返回 `insufficient_signals_without_vision_model` |
| 评论生成 | 输入评论意图和视频信号 | 返回非空 `commentText` |
| 评论上下文不足 | 无足够文本上下文 | 直接失败，不返回模板评论 |
| 评论安全限制 | 生成内容包含链接、联系方式或硬广 | 直接失败或重新生成 |
| 日志汇总 | 输入多条行为日志 | 返回观看数、点赞数、评论数、跳过数 |
| SKILL.md 入口 | 检查包根目录 | 存在 `SKILL.md`，说明使用流程、工具边界和降级策略 |
| 依赖边界 | 编译本包 | 不依赖 connector 源码、ADB、aiograpi-rest、official-api |
| 工具注册 | 插件启动后查看 tool 列表 | 存在四个互动决策工具 |

## 验证标准

* 能注册 `instagram_video_interaction_plan`
* 能注册 `instagram_video_evaluate`
* 能注册 `instagram_video_comment_generate`
* 能注册 `instagram_video_log_summarize`
* 包根目录存在 `SKILL.md`
* `SKILL.md` 明确说明本包不执行 Instagram UI 操作
* 单条视频判断返回结构化 JSON
* 无视觉模型时能按文本信号保守降级
* 无视觉模型且文本不足时不点赞、不评论
* 评论生成不包含链接、联系方式和硬广
* 本包不执行 Instagram UI 操作
* 本包不依赖 `instagram-connector` 源码
* 自动半小时循环 runner 不在本包实现

## 第一版不做

* 不做自动半小时循环 runner
* 不做点赞、评论、滑动执行
* 不做搜索执行
* 不做多账号调度
* 不做复杂行为节奏策略系统
* 不做风控恢复
* 不做完整视频理解平台
* 不做 MCP Server
* 不做 MCP-backed `InstagramClient`
