# instagram-profile-setup 包设计与实现方案

## 目标

`instagram-profile-setup` 是账号基础建设业务能力包，负责根据提示词和素材生成 Instagram 账号资料方案，并输出资料编辑计划和工具参数草案。

第一版目标是跑通：

```text
生成账号资料
  → 人工或上层确认
  → 生成资料编辑计划和参数草案
  → agent 服务调用 provider/tool 执行更新
  → agent 服务回传执行结果
```

## 定位

`instagram-profile-setup` 属于业务 skill/tool 层。

```text
instagram-profile-setup
  → 生成资料方案 / 编辑计划 / 参数草案
  → agent 服务
  → InstagramClient / HTTP provider / MCP tool
```

它只处理账号资料生成和资料编辑计划，不处理底层 Instagram API 请求，也不直接提交正式资料更新。

## 职责

* 根据名称提示词生成账号用户名或展示名
* 根据简介提示词生成个人简介
* 根据参考素材生成或选择头像引用
* 注册账号资料生成 tool
* 注册账号资料编辑计划 tool
* 生成待人工或上层审批的资料方案
* 根据审批后的资料生成 provider/tool 参数草案

## 非职责

* 不直接调用 aiograpi-rest
* 不直接调用 `ctx.instagram`
* 不直接调用 `InstagramClient.profile.updateProfile`
* 不实现 Instagram provider
* 不提交正式资料编辑
* 不管理登录态、proxy、设备信息或网络出口
* 不做多账号批量调度
* 不做完整素材库管理
* 不做完整图片生成系统
* 不做自动审批工作流
* 不处理每日互动或内容发布

## 包依赖

### 允许依赖

* tool 注册能力
* 底座已有 LLM 能力
* 底座已有图片生成能力，第一版可选
* `@instagram-skills/instagram-core`，仅作为可选类型依赖

### 不允许依赖

* `instagram-aiograpi-rest`
* `instagram-official-api`
* `instagram-connector`
* `@instagram-skills/instagram`
* `instagram-video-interaction`
* `instagram-content-publish`
* `instagram-warmup-orchestrator`
* 浏览器自动化、移动端自动化 SDK

## 包路径建议

采用第三方 monorepo 方式开发，建议放在：

```text
instagram-skills/packages/instagram-profile-setup
```

包名建议：

```text
@instagram-skills/instagram-profile-setup
```

## 注册工具

第一版只注册两个工具。

| 工具名 | 作用 |
| --- | --- |
| `instagram_profile_generate` | 根据提示词和素材生成用户名、展示名、简介、头像引用 |
| `instagram_profile_edit_plan` | 根据人工或上层审批后的资料生成编辑计划和工具参数草案 |

生成和执行分开，方便人工或上层 agent 在正式写入前检查资料内容。

## 文件结构建议

```text
instagram-skills/packages/instagram-profile-setup/
  SKILL.md
  package.json
  tsconfig.json
  src/
    index.ts
    tools.ts
    generate.ts
    edit-plan.ts
    schema.ts
```

## 模块职责

| 文件 | 职责 |
| --- | --- |
| `index.ts` | 插件入口，注册本包 tools |
| `tools.ts` | 定义并注册 `instagram_profile_generate`、`instagram_profile_edit_plan` |
| `generate.ts` | 实现账号资料生成逻辑 |
| `edit-plan.ts` | 校验审批后的资料字段，生成编辑计划和工具参数草案 |
| `schema.ts` | 定义 tool 输入输出 schema |

## SKILL.md 设计

包根目录必须提供 `SKILL.md`，作为普通 skills 底座和插件底座共同可读的能力说明。

`SKILL.md` 需要明确：

* 本 skill 只生成账号资料方案、编辑计划和参数草案
* 本 skill 不直接调用 Instagram provider、MCP tool 或 `ctx.instagram`
* 生成结果必须经过人工或上层 agent 审批后，才能进入正式资料编辑流程
* 正式资料更新由 agent 服务调用 provider/tool 执行
* 当底座没有图片生成能力且没有头像参考素材时，头像生成应直接拒绝

## 工具设计

### instagram_profile_generate

输入：

```ts
export interface InstagramProfileGenerateRequest {
  accountId: string;
  targets: InstagramProfileGenerateTarget[];
  namePrompt?: string;
  biographyPrompt?: string;
  referenceAssets?: string[];
  targetLanguage?: string;
}

export type InstagramProfileGenerateTarget =
  | "username"
  | "displayName"
  | "biography"
  | "avatar";
```

输出：

```ts
export interface InstagramProfileGenerateResult {
  username?: string;
  displayName?: string;
  biography?: string;
  avatarAsset?: {
    uri: string;
    mediaType: "image";
  };
}
```

说明：

* `username` 表示 Instagram 用户名建议
* `displayName` 表示主页展示名建议
* `biography` 表示个人简介建议
* `avatarAsset` 第一版只返回素材引用，不强制生成新图片
* `targets` 用于声明本次需要生成的字段，支持单独生成头像、用户名、展示名或简介
* 只生成头像时不需要传 `namePrompt` 和 `biographyPrompt`
* 只生成名字时不需要传 `biographyPrompt`
* 只生成简介时不需要传 `namePrompt`

生成字段要求：

| target | 必需输入 |
| --- | --- |
| `username` | `namePrompt` |
| `displayName` | `namePrompt` |
| `biography` | `biographyPrompt` |
| `avatar` | `referenceAssets` 或底座图片生成能力 |

字段限制第一版直接在代码中写死，不做配置项。

| 字段 | 长度上限 | 支持字符 |
| --- | --- | --- |
| `displayName` / `full_name` | 64 字符 | 字母、数字、空格、中文等 Unicode 文字、Emoji、大多数标点/特殊符号 |
| `biography` | 150 字符 | Unicode 文字、数字、空格、换行、Emoji、标点、`@mention`、`#hashtag` 等 |

## 生成提示词模板

### 名字生成提示词

用途：生成 `username / displayName`。

```text
你是 Instagram 账号定位与命名助手。

根据以下信息生成 Instagram 账号名字：
- 名称约束提示词：{{namePrompt}}
- 目标语言：{{targetLanguage}}
- 产品/账号定位：{{accountPositioning}}
- 参考素材说明：{{assetSummary}}

要求：
1. 输出 username 和 displayName。
2. username 使用小写字母、数字、下划线或点，尽量简短易记。
3. displayName 可以使用 Unicode 文字、数字、空格、Emoji 和常见标点。
4. displayName 最多 64 字符。
5. 不要使用夸大、敏感、冒充官方或无法验证的表达。
6. 只返回 JSON，不要解释。

输出格式：
{
  "username": "string",
  "displayName": "string"
}
```

### 简介生成提示词

用途：生成 `biography`。

```text
你是 Instagram 主页简介文案助手。

根据以下信息生成 Instagram 个人简介：
- 简介约束提示词：{{biographyPrompt}}
- 目标语言：{{targetLanguage}}
- 产品/账号定位：{{accountPositioning}}
- 参考素材说明：{{assetSummary}}

要求：
1. biography 最多 150 字符。
2. 可以使用 Unicode 文字、数字、空格、换行、Emoji、标点、@mention、#hashtag。
3. 表达要自然，符合目标语言用户习惯。
4. 不要生成夸大、虚假、敏感或无法验证的承诺。
5. 不要添加未提供的联系方式、网址或认证身份。
6. 只返回 JSON，不要解释。

输出格式：
{
  "biography": "string"
}
```

### 头像生成提示词

用途：`targets` 包含 `avatar` 且底座已接入图片生成服务时，生成头像素材。

```text
为 Instagram 账号生成一张头像图片。

账号/产品信息：
{{accountPositioning}}

参考素材说明：
{{assetSummary}}

视觉要求：
- 头像应清晰、简洁，适合小尺寸圆形裁切
- 主体居中，不贴边
- 背景干净，不喧宾夺主
- 风格符合账号定位和目标受众
- 不要添加品牌未提供的 logo
- 不要生成虚假文字、价格、促销信息
- 不要生成敏感、夸张或误导性元素

输出要求：
- 生成一张正方形图片
- 适合 Instagram 头像使用
- 不要生成额外解释文本
```

头像生成第一版行为：

* 已接入图片生成服务时，可以生成头像素材
* 未接入图片生成服务但存在 `referenceAssets` 时，返回头像素材引用
* 未接入图片生成服务且没有 `referenceAssets` 时，直接拒绝生成，不返回假头像

### tool 边界 id 处理

tool 输入来自 JSON，`accountId` 和 `sessionRef` 在本包 schema 中保持为普通 `string`。

本包只生成编辑计划和参数草案，不在包内构造 `InstagramAccountId`、`InstagramSessionRef` 或调用 `InstagramClient`。如果 agent 服务后续选择 TS `InstagramClient` 执行资料更新，应在执行层调用 `instagram-core` 提供的构造函数转换 branded type。

### instagram_profile_edit_plan

输入：

```ts
export interface InstagramProfileEditPlanRequest {
  accountId: string;
  sessionRef?: string;
  approved: boolean;
  username?: string;
  displayName?: string;
  biography?: string;
  avatarAsset?: {
    uri: string;
    mediaType: "image";
  };
  preferredProvider?: "instagram-client" | "mcp-tool" | "http-provider";
}
```

输出：

```ts
export interface InstagramProfileEditPlanResult {
  action: "update_profile";
  approvalRequired: false;
  targetTool: "InstagramClient.profile.updateProfile" | "instagram.profile.update";
  requestDraft: {
    accountId: string;
    sessionRef?: string;
    username?: string;
    displayName?: string;
    biography?: string;
    avatarAsset?: {
      uri: string;
      mediaType: "image";
    };
  };
  fieldsToUpdate: Array<"username" | "displayName" | "biography" | "avatarAsset">;
  warnings: string[];
}
```

说明：

* `instagram_profile_edit_plan` 支持部分字段更新，只把需要修改的字段写入 `requestDraft`
* 如果没有传入任何可更新字段，直接失败，不生成空更新计划
* `approved=false` 时直接失败，不生成正式编辑参数草案
* `instagram_profile_generate` 的输出必须经过人工或上层审批后，才允许生成正式编辑计划
* `targetTool` 只用于提示 agent 服务可选择的执行目标，不表示本包会直接调用该工具

## 调用方式

`instagram-profile-setup` 的调用方式是计划型调用：

```text
agent 服务
  → 调用 instagram_profile_generate 生成资料草案
  → 人工或上层 agent 审批
  → 调用 instagram_profile_edit_plan 生成编辑计划和参数草案
  → agent 服务选择 provider/tool 执行正式更新
  → agent 服务把执行结果写入日志或返回给用户
```

在 Cordis 插件底座中，agent 服务可以读取计划后调用 `ctx.instagram.profile.updateProfile`。在无插件底座中，agent 服务可以读取计划后调用普通 `InstagramClient`、HTTP provider 或 MCP tool。

## 实现边界

第一版只实现能跑通的正确路线。

* 资料生成只输出结构化建议，不自动写入
* 资料编辑计划只输出结构化参数草案，不自动写入
* 头像可以使用已有素材引用
* 背景图不做，Instagram 个人主页没有通用封面背景能力
* 内容安全、品牌一致性检查先由提示词约束，不单独做审核系统
* 生成结果必须经过人工或上层审批后，才允许生成正式资料编辑计划

## 错误处理

* 资料生成失败时直接返回失败，不生成假资料
* `targets` 对应的必需提示词或素材缺失时直接失败
* 名称或简介超过内置长度上限时直接失败
* 编辑计划没有任何可更新字段时直接失败
* `approved=false` 时直接失败，不生成正式编辑参数草案
* 不在本包内调用 provider
* 不在本包内重试 provider 调用
* 不在本包内切换 provider
* 不吞掉计划生成阶段的校验错误

## 实现步骤

1. 新建 `@instagram-skills/instagram-profile-setup` 包。
2. 定义两个 tool 的输入输出 schema。
3. 实现 `instagram_profile_generate`。
4. 实现 `instagram_profile_edit_plan`。
5. 编写包根目录 `SKILL.md`，明确 skill 职责和执行边界。
6. 在插件入口注册两个 tools。
7. 验证计划工具不会调用 provider 或 MCP tool。
8. 用 fake LLM 或固定生成器验证生成工具返回结构化结果。

## 验收场景

| 场景 | 用例 | 预期 |
| --- | --- | --- |
| 资料生成 | 输入名称提示词和简介提示词 | 返回结构化 `username / displayName / biography` |
| 单独生成名字 | 输入 `targets: ["username", "displayName"]` 和名称提示词 | 只返回名字相关字段 |
| 单独生成简介 | 输入 `targets: ["biography"]` 和简介提示词 | 只返回 `biography` |
| 单独生成头像 | 输入 `targets: ["avatar"]` 和参考图片路径 | 只返回 `avatarAsset` |
| 必需输入检查 | `targets` 包含 `biography` 但缺少 `biographyPrompt` | 直接失败，不生成假简介 |
| 字段长度限制 | 生成或编辑的 `displayName / biography` 超过上限 | 直接失败，不调用 provider |
| 素材引用 | 输入参考图片路径 | 返回 `avatarAsset` 引用，不直接上传 |
| 编辑计划生成 | 输入 `accountId`、`approved=true` 和资料字段 | 返回 `action`、`targetTool`、`requestDraft`、`fieldsToUpdate` |
| 空更新失败 | 编辑计划请求没有任何资料字段 | 直接失败，不生成空更新计划 |
| 未审批失败 | `approved=false` | 直接失败，不生成正式编辑参数草案 |
| 计划不执行 | 调用 `instagram_profile_edit_plan` | 不触发 Instagram 资料更新 |
| provider 解耦 | 不注入 `InstagramClient` 或 MCP tool | 计划工具仍可生成结构化计划 |
| 计划错误 | 输入缺少 `accountId` 或字段超限 | 直接返回校验失败 |
| 依赖边界 | 编译本包 | 不依赖 `instagram-aiograpi-rest` |
| 工具注册 | 插件启动后查看 tool 列表 | 存在 `instagram_profile_generate` 和 `instagram_profile_edit_plan` |
| 生成写入分离 | 只调用 `instagram_profile_generate` | 不触发 Instagram 资料更新 |
| `SKILL.md` 职责 | 阅读包根目录 `SKILL.md` | 明确本 skill 只生成资料方案和编辑计划，不执行资料更新 |

## 验证标准

* 能注册 `instagram_profile_generate`
* 能注册 `instagram_profile_edit_plan`
* 包根目录存在职责明确的 `SKILL.md`
* 生成工具返回结构化 JSON
* 编辑计划工具返回结构化计划和参数草案
* 本包不直接调用 `InstagramClient.profile.updateProfile`
* 本包不直接调用 `ctx.instagram`、HTTP provider 或 MCP tool
* 本包不直接依赖任何 provider
* skill 职责符合最新标准：只生成计划、内容、参数草案或校验结果

## 第一版不做

* 不做完整头像生成系统
* 不做素材库管理
* 不做多账号批量资料设置
* 不做自动审批工作流
* 不做 Instagram 背景图能力
* 不做资料历史版本管理
* 不做账号风控恢复
