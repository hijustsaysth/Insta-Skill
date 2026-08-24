# instagram-content-publish 包设计与实现方案

## 目标

`instagram-content-publish` 是内容生成与发布业务能力包，负责根据产品信息、参考素材和目标语言生成 Instagram 发布草稿、发布计划、状态查询计划和工具参数草案。

第一版目标是跑通：

```text
生成发布草稿
  → 人工或上层确认
  → 生成发布计划和参数草案
  → agent 服务调用 provider/tool 执行发布
  → agent 服务回传结构化执行日志
  → 按需生成状态查询计划
```

## 定位

`instagram-content-publish` 属于业务 skill/tool 层。

```text
instagram-content-publish
  → 生成发布草稿 / 发布计划 / 状态查询计划
  → agent 服务
  → InstagramClient / HTTP provider / MCP tool
```

它只处理内容草稿生成、发布计划和状态查询计划，不处理底层 Instagram API 请求，也不直接提交正式发布或查询真实发布状态。

## 职责

* 根据产品信息生成发布正文
* 根据目标市场语言生成本地化文案
* 根据发布类型生成对应内容草稿
* 输出 tag 和素材引用
* 注册内容生成 tool
* 注册内容发布计划 tool
* 注册发布状态查询计划 tool
* 生成待人工或上层审批的发布草稿
* 根据审批后的草稿生成 provider/tool 参数草案
* 生成可用于结构化日志、benchmark 和 agent eval 的计划字段

## 非职责

* 不直接调用 aiograpi-rest
* 不直接调用 `ctx.instagram`
* 不直接调用 `InstagramClient.publish.publishContent`
* 不直接调用 `InstagramClient.publish.getPublishStatus`
* 不实现 Instagram provider
* 不提交正式发布
* 不查询真实发布状态
* 不管理登录态、proxy、设备信息或网络出口
* 不做内容日历后台
* 不做自动排程系统
* 不做完整图片/视频生成系统
* 不做自动审批工作流
* 不做失败重发或补偿任务
* 不处理账号资料建设或每日互动

## 包依赖

### 允许依赖

* tool 注册能力
* 底座已有 LLM 能力
* 底座已有图片/视频生成能力，后续可选接入
* `@instagram-skills/instagram-core`，仅作为可选类型依赖

### 不允许依赖

* `instagram-aiograpi-rest`
* `instagram-official-api`
* `instagram-connector`
* `@instagram-skills/instagram`
* `instagram-profile-setup`
* `instagram-video-interaction`
* `instagram-warmup-orchestrator`
* 浏览器自动化、移动端自动化 SDK

## 包路径建议

采用第三方 monorepo 方式开发，建议放在：

```text
instagram-skills/packages/instagram-content-publish
```

包名建议：

```text
@instagram-skills/instagram-content-publish
```

## 注册工具

第一版注册三个工具。

| 工具名 | 作用 |
| --- | --- |
| `instagram_content_generate` | 根据素材、产品说明、目标市场语言生成正文、tag、图片/视频引用 |
| `instagram_content_publish_plan` | 根据人工或上层审批后的草稿生成发布计划和工具参数草案 |
| `instagram_publish_status_plan` | 根据发布记录或 `publishId` 生成状态查询计划和工具参数草案 |

生成、发布计划、状态查询计划分开，避免生成后自动发布，也方便记录结构化日志和做 agent eval。

## 文件结构建议

```text
instagram-skills/packages/instagram-content-publish/
  SKILL.md
  package.json
  tsconfig.json
  src/
    index.ts
    tools.ts
    generate.ts
    publish-plan.ts
    status-plan.ts
    schema.ts
    limits.ts
```

## 模块职责

| 文件 | 职责 |
| --- | --- |
| `index.ts` | 插件入口，注册本包 tools |
| `tools.ts` | 定义并注册三个工具 |
| `generate.ts` | 实现发布草稿生成 |
| `publish-plan.ts` | 校验审批后的草稿，生成发布计划和工具参数草案 |
| `status-plan.ts` | 根据发布记录或 `publishId` 生成状态查询计划和工具参数草案 |
| `schema.ts` | 定义 tool 输入输出 schema |
| `limits.ts` | 定义第一版写死的发布限制 |

## SKILL.md 设计

包根目录必须提供 `SKILL.md`，作为普通 skills 底座和插件底座共同可读的能力说明。

`SKILL.md` 需要明确：

* 本 skill 只生成发布草稿、发布计划、状态查询计划和参数草案
* 本 skill 不直接调用 Instagram provider、MCP tool 或 `ctx.instagram`
* 发布草稿必须经过人工或上层 agent 审批后，才能生成正式发布计划
* 正式发布和真实状态查询由 agent 服务调用 provider/tool 执行
* 定时发布第一版只返回未实现说明占位符，不生成可执行排程任务
* 当底座没有图片/视频生成能力且缺少必需素材时，直接拒绝生成
* 输出必须保留可用于结构化日志、benchmark 和 agent eval 的稳定字段

## 工具设计

### instagram_content_generate

输入：

```ts
export interface InstagramContentGenerateRequest {
  accountId: string;
  type: InstagramContentType;
  productDescription: string;
  targetLanguage: string;
  referenceAssets: string[];
  generateMedia?: boolean;
}

export type InstagramContentType = "post" | "story" | "reel";
```

输出：

```ts
import type { InstagramAssetRef } from "@instagram-skills/instagram-core";

export interface InstagramContentDraft {
  type: InstagramContentType;
  caption?: string;
  tags?: string[];
  assets: InstagramAssetRef[];
}
```

说明：

* `instagram_content_generate` 只生成发布草稿，不自动发布
* `generateMedia` 依赖 agent 底座是否接入图片/视频模型服务
* `generateMedia` 未传或为 `false` 时，只使用 `referenceAssets` 生成草稿
* `generateMedia` 为 `true` 且底座未接入对应图片/视频生成服务时，直接拒绝生成，不返回假素材
* `type: "reel"` 需要视频素材；如果要求生成视频但底座未接入视频生成服务，直接拒绝生成
* 生成草稿必须经过人工或上层审批后，才允许提交给 `instagram_content_publish_plan`
* `story` 不使用普通 post caption；文字应作为画面内容或后续贴纸/叠加能力处理，第一版不做 Story 文字叠加

### instagram_content_publish_plan

输入：

```ts
export interface InstagramContentPublishPlanRequest {
  accountId: string;
  sessionRef?: string;
  draft: InstagramContentDraft;
  approved: boolean;
  scheduledAt?: string;
  preferredProvider?: "instagram-client" | "mcp-tool" | "http-provider";
}
```

输出：

```ts
export interface InstagramContentPublishPlanResult {
  action: "publish_content";
  approvalRequired: false;
  targetTool: "InstagramClient.publish.publishContent" | "instagram.publish.content";
  requestDraft: {
    accountId: string;
    sessionRef?: string;
    type: InstagramContentType;
    caption?: string;
    tags?: string[];
    assets: InstagramContentDraft["assets"];
  };
  evaluationTags: string[];
  logFields: {
    planId: string;
    contentType: InstagramContentType;
    assetCount: number;
    hasCaption: boolean;
    hasTags: boolean;
    scheduled: boolean;
  };
  warnings: string[];
}
```

定时发布占位输出：

```ts
export interface InstagramScheduledPublishPlaceholder {
  action: "scheduled_publish";
  implemented: false;
  reason: "scheduled_publish_not_implemented";
  scheduledAt: string;
}
```

说明：

* `instagram_content_publish_plan` 不生成内容，只基于已确认草稿生成发布计划
* `approved=false` 时直接失败，不生成正式发布参数草案
* 第一版不实现真正定时发布
* 如果传入 `scheduledAt`，返回未实现说明占位符，不生成可执行 provider 参数
* `targetTool` 只用于提示 agent 服务可选择的执行目标，不表示本包会直接调用该工具
* `logFields` 是稳定结构，供 agent 服务写结构化日志、benchmark 和 agent eval 使用

### instagram_publish_status_plan

输入：

```ts
export interface InstagramPublishStatusPlanRequest {
  accountId: string;
  sessionRef?: string;
  publishId: string;
  preferredProvider?: "instagram-client" | "mcp-tool" | "http-provider";
}
```

输出：

```ts
export interface InstagramPublishStatusPlanResult {
  action: "get_publish_status";
  targetTool: "InstagramClient.publish.getPublishStatus" | "instagram.publish.status";
  requestDraft: {
    accountId: string;
    sessionRef?: string;
    publishId: string;
  };
  logFields: {
    planId: string;
    publishId: string;
  };
  warnings: string[];
}
```

说明：

* `instagram_publish_status_plan` 只生成状态查询计划，不查询真实状态
* 不做失败重发
* 不做发布补偿任务
* provider 是否支持稳定状态查询，由 agent 服务执行时处理

## tool 边界 id 处理

tool 输入来自 JSON 时，`accountId`、`sessionRef`、`publishId` 在本包 schema 中保持为普通 `string`。

本包只生成发布计划、状态查询计划和参数草案，不在包内构造 `InstagramAccountId`、`InstagramSessionRef`、`InstagramPublishId` 或调用 `InstagramClient`。如果 agent 服务后续选择 TS `InstagramClient` 执行发布或查询，应在执行层调用 `instagram-core` 提供的构造函数转换 branded type。

## 生成提示词模板

### 文案生成提示词

用途：生成 `caption / tags`。

```text
你是 Instagram 社媒运营文案助手。

根据以下信息生成 Instagram 发布文案：
- 发布类型：{{type}}，只能是 post、story、reel
- 产品说明：{{productDescription}}
- 目标语言：{{targetLanguage}}
- 目标受众：{{audience}}
- 参考素材说明：{{assetSummary}}

要求：
1. post 和 reel 可以生成 caption；story 不生成普通 caption。
2. caption 最多 2200 字符。
3. tags 最多 30 个。
4. 文案要符合目标语言的自然表达，不要机器翻译腔。
5. 不要生成夸大、虚假、敏感或无法验证的承诺。
6. 只返回 JSON，不要解释。

输出格式：
{
  "caption": "string | null",
  "tags": ["string"]
}
```

### 图片生成提示词

用途：`generateMedia=true` 且底座已接入图片生成服务时，生成 post / story 图片素材。

```text
为 Instagram {{type}} 生成一张产品展示图片。

产品信息：
{{productDescription}}

视觉要求：
- 目标市场语言：{{targetLanguage}}
- 风格：真实、清晰、适合社媒发布
- 画面主体必须突出产品或使用场景
- 不要添加品牌未提供的 logo
- 不要生成虚假文字、价格、促销信息
- 不要生成敏感、夸张或误导性元素

构图要求：
{{compositionRequirement}}

输出要求：
- 生成一张图片
- 图片应适合 Instagram {{type}} 使用
- 如果 type 是 story，优先竖版 9:16
- 如果 type 是 post，优先 4:5
```

`compositionRequirement` 按发布类型填充：

```text
post：产品居中或使用场景清晰，保留少量留白。
story：竖版全屏构图，主体不要贴边，预留顶部和底部安全区。
```

### 视频生成提示词

用途：`generateMedia=true` 且底座已接入视频生成服务时，生成 reel / story / post video 素材。

```text
为 Instagram {{type}} 生成一段短视频。

产品信息：
{{productDescription}}

视频目标：
- 展示产品核心卖点
- 呈现真实使用场景
- 节奏适合 Instagram 短视频
- 不要添加未提供的品牌 logo、价格或促销承诺
- 不要出现敏感、夸张或误导性内容

画面要求：
- 主体清晰
- 光线自然
- 镜头稳定
- 适合移动端观看

时长要求：
{{durationRequirement}}

比例要求：
{{aspectRatioRequirement}}

输出要求：
- 返回一个视频素材
- 不要生成额外解释文本
```

`durationRequirement` 和 `aspectRatioRequirement` 按发布类型填充：

| 类型 | 时长要求 | 比例要求 |
| --- | --- | --- |
| `reel` | 15 到 45 秒，第一版优先短视频 | 竖版 9:16 |
| `story` | 单条 3 到 15 秒 | 竖版 9:16 |
| `post` | 3 到 60 秒 | 4:5 到 1.91:1，优先 4:5 |

## 发布限制

第一版业务前置限制直接在代码中写死，不做配置项。

| 规则 | 限制 |
| --- | --- |
| `post` 素材 | 至少 1 个图片或视频素材 |
| `story` 素材 | 至少 1 个图片或视频素材 |
| `reel` 素材 | 至少 1 个视频素材 |
| `caption` 长度 | 最多 2200 字符 |
| `tags` 数量 | 最多 30 个 |
| `story` caption | 不接收普通 caption |

文件大小、视频时长、格式、推荐比例由 provider 在 agent 服务执行阶段校验。业务包不解析文件、不读取视频元信息、不判断图片比例。具体限制查看对应 provider 文档，例如 `instagram-aiograpi-rest包设计与实现方案.md`。

provider 校验失败、发布失败或状态查询失败属于执行阶段结果，由 agent 服务记录到结构化日志中。本包不伪造发布结果或查询状态。

## 调用方式

`instagram-content-publish` 的调用方式是计划型调用：

```text
agent 服务
  → 调用 instagram_content_generate 生成发布草稿
  → 人工或上层 agent 审批
  → 调用 instagram_content_publish_plan 生成发布计划和参数草案
  → agent 服务选择 provider/tool 执行正式发布
  → agent 服务记录结构化执行日志
  → 按需调用 instagram_publish_status_plan 生成状态查询计划
  → agent 服务选择 provider/tool 查询真实状态
```

在 Cordis 插件底座中，agent 服务可以读取计划后调用 `ctx.instagram.publish.publishContent` 或 `ctx.instagram.publish.getPublishStatus`。在无插件底座中，agent 服务可以读取计划后调用普通 `InstagramClient`、HTTP provider 或 MCP tool。

## 实现边界

第一版只实现能跑通的正确路线。

* 内容生成只输出结构化草稿，不自动发布
* 发布计划工具只接收已确认草稿并输出参数草案
* 状态查询计划工具只输出查询计划和参数草案
* 不做内容日历后台
* 不做真正定时发布
* 不做完整图片/视频生成系统
* 不做自动审批工作流系统
* 不做失败重发或补偿

## 错误处理

* 内容生成失败时直接失败，不生成假草稿
* `generateMedia=true` 但底座未接入对应图片/视频生成服务时，直接拒绝生成
* 发布草稿未确认时不生成正式发布参数草案
* 传入 `scheduledAt` 时返回未实现说明占位符，不生成可执行 provider 参数
* 状态查询计划缺少 `publishId` 时直接失败
* 素材文件大小、时长、格式、比例校验失败属于执行阶段错误，由 provider 和 agent 服务处理
* 发布失败和状态查询失败属于执行阶段错误，由 agent 服务记录
* 不在本包内调用 provider
* 不在本包内重试 provider 调用
* 不在本包内切换 provider

## 实现步骤

1. 新建 `@instagram-skills/instagram-content-publish` 包。
2. 定义三个 tool 的输入输出 schema。
3. 在 `limits.ts` 写死第一版业务前置限制。
4. 实现 `instagram_content_generate`。
5. 实现 `instagram_content_publish_plan`。
6. 实现 `instagram_publish_status_plan`。
7. 编写包根目录 `SKILL.md`，明确 skill 职责和执行边界。
8. 在插件入口注册三个 tools。
9. 验证计划工具不会调用 provider 或 MCP tool。
10. 用 fake LLM 或固定生成器验证生成工具返回结构化草稿。

## 验收场景

| 场景 | 用例 | 预期 |
| --- | --- | --- |
| 内容生成 | 输入产品说明、目标语言、素材 | 返回结构化草稿 |
| post 草稿 | `type: "post"` | 返回 caption、tags、assets |
| story 草稿 | `type: "story"` | 返回 assets，不返回普通 caption |
| reel 草稿 | `type: "reel"` 且有视频素材 | 返回视频 assets |
| 图片生成服务缺失 | `generateMedia=true` 且需要图片生成，但底座未接入图片生成服务 | 直接拒绝生成，不返回假素材 |
| 视频生成服务缺失 | `generateMedia=true` 且需要视频生成，但底座未接入视频生成服务 | 直接拒绝生成，不返回假素材 |
| 缺少素材 | post/story/reel 无有效素材 | 直接失败 |
| reel 素材限制 | reel 没有 video 素材 | 直接失败 |
| caption 长度限制 | caption 超过 2200 字符 | 直接失败，不调用 provider |
| tags 数量限制 | tags 超过 30 个 | 直接失败，不调用 provider |
| story caption 限制 | story 草稿包含普通 caption | 直接失败，不调用 provider |
| provider 素材校验边界 | 文件大小、时长、格式或比例需要校验 | 本包不校验，计划中提示查看 provider 文档 |
| 未审批失败 | `approved=false` | 直接失败，不生成正式发布参数草案 |
| 定时发布占位 | 发布计划请求传入 `scheduledAt` | 返回未实现说明占位符，不生成可执行 provider 参数 |
| 发布计划生成 | 输入已确认草稿和账号 | 返回 `action`、`targetTool`、`requestDraft`、`logFields` |
| 状态查询计划生成 | 输入 `publishId` | 返回状态查询计划和参数草案 |
| 状态查询缺少 ID | 缺少 `publishId` | 直接失败，不生成查询计划 |
| 计划不执行 | 调用 `instagram_content_publish_plan` 或 `instagram_publish_status_plan` | 不触发 Instagram 发布或状态查询 |
| provider 解耦 | 不注入 `InstagramClient` 或 MCP tool | 计划工具仍可生成结构化计划 |
| 计划错误 | 输入缺少 `accountId`、素材为空或字段超限 | 直接返回校验失败 |
| 依赖边界 | 编译本包 | 不依赖 `instagram-aiograpi-rest` |
| 工具注册 | 插件启动后查看 tool 列表 | 存在三个发布相关工具 |
| 生成发布分离 | 只调用 `instagram_content_generate` | 不触发 Instagram 发布 |
| `SKILL.md` 职责 | 阅读包根目录 `SKILL.md` | 明确本 skill 只生成草稿、计划和参数草案，不执行发布或查询 |
| 结构化日志字段 | 生成发布计划 | 输出稳定 `logFields`，可被 agent 服务写入 benchmark / eval 数据 |

## 验证标准

* 能注册 `instagram_content_generate`
* 能注册 `instagram_content_publish_plan`
* 能注册 `instagram_publish_status_plan`
* 包根目录存在职责明确的 `SKILL.md`
* 生成工具返回结构化 JSON
* 发布计划工具返回结构化计划和参数草案
* 状态查询计划工具返回结构化计划和参数草案
* 计划输出包含稳定 `logFields`，可用于结构化日志、benchmark 和 agent eval
* 本包不直接调用 `InstagramClient.publish.publishContent`
* 本包不直接调用 `InstagramClient.publish.getPublishStatus`
* 本包不直接调用 `ctx.instagram`、HTTP provider 或 MCP tool
* 本包不直接依赖任何 provider
* skill 职责符合最新标准：只生成计划、内容、参数草案或校验结果

## 第一版不做

* 不做完整图片/视频生成系统
* 不做内容日历后台
* 不做真正定时发布
* 不做自动审批工作流
* 不做失败重发或补偿任务
* 不做多账号批量发布
* 不做账号风控恢复
