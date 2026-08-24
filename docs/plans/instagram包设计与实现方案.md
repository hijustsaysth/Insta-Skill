# instagram 包设计与实现方案

## 目标

`instagram` 是插件底座适配包，负责把 `instagram-core` 中定义的 `InstagramClient` 接入 Cordis 上下文，让 agent 服务或 provider 执行层可以通过 `ctx.instagram` 调用 Instagram 能力。

## 定位

`instagram` 属于底座适配层。

```text
agent 服务 / provider 执行层
  → ctx.instagram
  → instagram-core 定义的 InstagramClient
  → provider/client 实现包
```

它只服务支持插件机制的底座，例如 `deepseek-harness` 或其他 Cordis 应用。

## 职责

* 声明 `ctx.instagram` 服务接口
* 复用 `instagram-core` 的 `InstagramClient` 类型
* 提供 provider 注册入口
* 让 agent 服务或 provider 执行层通过统一上下文访问 Instagram 能力

## 非职责

* 不调用 Instagram API
* 不实现 aiograpi-rest、官方 API 或 connector
* 不注册模型可见 tool
* 不生成账号名称、简介、头像、评论或发布内容
* 不做资料编辑、点赞、评论、发布等业务流程
* 不服务无插件 Python agent

## 包依赖

### 允许依赖

* `@instagram-skills/instagram-core`
* Cordis 类型包

### 不允许依赖

* `instagram-aiograpi-rest`
* `instagram-official-api`
* `instagram-connector`
* `instagram-profile-setup`
* `instagram-video-interaction`
* `instagram-content-publish`
* HTTP client、浏览器自动化、移动端自动化 SDK

## 包路径建议

采用第三方 monorepo 方式开发，建议放在：

```text
instagram-skills/packages/instagram
```

包名建议：

```text
@instagram-skills/instagram
```

## 文件结构建议

```text
instagram-skills/packages/instagram/
  package.json
  tsconfig.json
  src/
    index.ts
    context.ts
    provider.ts
```

## 模块职责

| 文件 | 职责 |
| --- | --- |
| `index.ts` | 统一导出公开类型和注册函数 |
| `context.ts` | 声明 `ctx.instagram` 类型 |
| `provider.ts` | 提供 `provideInstagram` 注册函数 |

## 核心接口设计

`instagram` 不重新定义 Instagram 能力，只把 `instagram-core` 的 `InstagramClient` 声明到 Cordis 上下文。

```ts
import type { Context } from "@deepseek-ai/cordis";
import type { InstagramClient } from "@instagram-skills/instagram-core";

declare module "@deepseek-ai/cordis" {
  interface Context {
    instagram: InstagramClient;
  }
}
```

provider 包通过 `provideInstagram` 挂载具体实现。第一版只使用 `registration.client` 挂载默认 provider，`registration.id` 仅作为后续多个 provider 并存的扩展点。

```ts
import type { Context } from "@deepseek-ai/cordis";
import type { InstagramClient } from "@instagram-skills/instagram-core";

export interface InstagramProviderRegistration {
  id: string;
  client: InstagramClient;
}

export function provideInstagram(ctx: Context, registration: InstagramProviderRegistration): void {
  ctx.provide("instagram", registration.client);
}
```

## provider 使用方式

`instagram-aiograpi-rest` 等 provider 包负责创建真实 client，然后调用 `provideInstagram`。

```ts
import { provideInstagram } from "@instagram-skills/instagram";

export function apply(ctx: Context, config: Config): void {
  const client = createAiograpiRestClient(config);
  provideInstagram(ctx, {
    id: "aiograpi-rest",
    client,
  });
}
```

## 执行层使用方式

业务 skill 包不直接声明依赖 `instagram` 服务，也不直接通过 `ctx.instagram` 执行 Instagram 动作。

业务 skill 包只输出计划、内容、决策、参数草案或汇总结果。agent 服务读取这些输出后，再通过 `ctx.instagram` 调用 provider 能力。

```ts
export const inject = ["instagram"];

export async function executeProfileUpdate(ctx: Context, requestDraft: RequestDraft) {
  // agent 服务读取 skill 产出的 requestDraft 后执行
  return ctx.instagram.profile.updateProfile(requestDraft);
}
```

## 实现步骤

1. 新建 `@instagram-skills/instagram` 包。
2. 配置 ESM、strict TypeScript、workspace tsconfig。
3. 在 `context.ts` 声明 `ctx.instagram` 类型。
4. 在 `provider.ts` 实现 `provideInstagram`。
5. 在 `index.ts` 导出上下文声明和注册函数。
6. 增加 mock provider 测试，验证 `ctx.instagram` 可被注册和消费。

## 验收场景

| 场景 | 用例 | 预期 |
| --- | --- | --- |
| 类型声明 | agent 服务访问 `ctx.instagram` | TypeScript 能识别为 `InstagramClient` |
| provider 注册 | mock provider 调用 `provideInstagram(ctx, registration)` | `ctx.instagram` 可被 agent 服务或执行层使用 |
| 依赖边界 | 编译 `@instagram-skills/instagram` | 不依赖 provider 或业务包 |
| 空实现检查 | 只安装 `instagram` 不安装 provider | 不产生真实 Instagram 能力 |
| 执行层消费 | agent 服务声明 `inject = ["instagram"]` | provider 存在时可正常调用 |
| 生命周期释放 | mock provider 注册后卸载插件 | `ctx.instagram` 随 provider 卸载失效或回到未提供状态 |
| provider id 保留 | provider 传入 `id: "aiograpi-rest"` | 注册成功；第一版不做选择逻辑，但类型和调用签名稳定 |
| provider 错误透传 | mock client 方法抛出 `InstagramProviderError` | 错误原样向 agent 服务抛出，`instagram` 不包装、不吞错 |

## 验证标准

* `instagram` 能声明 `ctx.instagram`
* `ctx.instagram` 类型来自 `instagram-core`
* provider 包能通过 `provideInstagram` 注册实现
* `provideInstagram` 接收 provider id，为后续多个 provider 并存保留入口
* agent 服务或执行层能通过 `ctx.instagram` 调用能力
* 业务 skill 包不直接依赖 `ctx.instagram`
* `instagram` 不直接依赖任何 provider 或业务包

## 第一版不做

* 不做 provider 自动发现
* 不做 provider 优先级管理
* 不做 provider 自动切换
* 不做模型可见 tool 注册
* 不做无插件底座兼容
* 不做真实 Instagram 请求

## 兼容说明

当前包只适用于支持 Cordis 插件机制的 TS/Node 底座。无插件或 Python agent 不需要使用本包，应直接调用 provider client，后续跨语言兼容由 `instagram-protocol` 承担。
