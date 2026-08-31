---
name: instagram-profile-setup
description: >
  基于名称提示、业务说明、联系方式和参考素材生成 Instagram 账号资料草案；
  涉及头像时要求先取得新生成头像素材；审批通过后只生成资料编辑计划和参数草案。
  本 skill 不直接修改 Instagram。
---

# instagram-profile-setup

## 职责

本 skill 用于生成 Instagram 资料草案，以及在资料草案被明确审批后生成编辑计划。

支持字段：

* `username`
* `displayName`
* `biography`
* `avatar`

本 skill 不执行 Instagram 副作用操作：不登录、不管理 session/proxy/设备、不调用 Instagram provider、MCP tool、`InstagramClient` 或 `ctx.instagram`，也不直接提交资料修改。

## 工具

注册工具：

```text
instagram_profile_generate
instagram_profile_edit_plan
```

CLI 入口：

```powershell
node .\dist\cli.bundle.js list-tools
node .\dist\cli.bundle.js invoke --action instagram_profile_generate --input-json profile-generate.json
node .\dist\cli.bundle.js invoke --action instagram_profile_edit_plan --input-json profile-edit-plan.json
```

如果 agent runtime 已把本 skill 的 `bin` 暴露到 `PATH`，也可以使用：

```powershell
instagram-profile-setup list-tools
instagram-profile-setup invoke --action instagram_profile_generate --input-json -
```

`--input-json` 支持内联 JSON、JSON 文件路径和 stdin `-`。更多示例见 [references/approval-and-cli.md](references/approval-and-cli.md)。

## 资料生成流程

普通资料草案：

1. 从用户请求确定 `targets`。
2. 只校验本次 `targets` 需要的输入。
3. 调用 `instagram_profile_generate` 生成草案。
4. 把草案交给用户或上层 agent 审批。
5. 只有明确审批后，才调用 `instagram_profile_edit_plan` 生成编辑计划。
6. 后续 Instagram 修改由执行层或其他 skill 完成。

涉及 `avatar` 时，先阅读 [references/avatar-generation.md](references/avatar-generation.md)，并在调用 `instagram_profile_generate` 前完成头像生成或明确降级。

## `instagram_profile_generate`

必填：

```text
accountId
targets
```

按目标字段额外必填：

```text
username: namePrompt
displayName: brandPrefix, englishName
biography: businessPrompt 或 biographyPrompt；同时必须有 contactPrompt
avatar: referenceAssets
```

头像字段还支持：

```text
generatedAvatarAssets
avatarCount
avatarOutputDir
avatarGenerationSupported
```

返回字段只包含本次 `targets` 请求的草案字段和必要审核证据。

字段规则详见 [references/profile-fields.md](references/profile-fields.md)。

## `instagram_profile_edit_plan`

必填：

```text
accountId
approved
```

可选：

```text
sessionRef
username
displayName
biography
avatarAsset
preferredProvider
```

规则：

* `approved` 必须为 `true`，否则直接失败。
* 至少提供一个待更新字段。
* `requestDraft` 只包含实际准备修改的字段。
* 缺少 `sessionRef` 时返回 warning，由执行层补齐认证 session。
* `preferredProvider` 只影响建议的 `targetTool`，本 skill 不调用该工具。

审批和编辑计划细节见 [references/approval-and-cli.md](references/approval-and-cli.md)。

## 头像硬约束

当 `targets` 包含 `avatar`：

1. `referenceAssets` 至少包含一个有效路径或 URL。
2. `avatarCount` 只允许 `2` 或 `3`，默认 `3`。
3. 如果图片生成能力可用，agent 必须先生成 `avatarCount` 张新头像，再调用 `instagram_profile_generate`。
4. `generatedAvatarAssets.length` 必须严格等于 `avatarCount`。
5. `avatarGeneration.status=generated` 时，`avatarAsset` 必须来自 `generatedAvatarAssets`。
6. `avatarGeneration.status=degraded` 只允许在执行环境确实没有图片生成能力时出现，且不得返回 `avatarAsset`。
7. `referenceAssets` 只能作为生成参考，不能作为最终头像。

## 字段硬约束

* `username` 最多 30 字符，只允许 `a-z`、`0-9`、`_`、`.`，生成后超限直接失败。
* `displayName` 最多 64 字符，格式固定为 `{brandPrefix}-{englishName}`。
* `biography` 最多 150 字符，默认模板为 `Selling {业务说明}. Contact & WhatsAPP: {联系方式}`。
* `contactPrompt` 必须保留用户提供的原始联系方式，不得改写数字、邮箱或账号。

## 失败与降级

以下情况直接失败：

* 缺少本次目标字段的必需输入。
* 字段超出长度限制。
* `avatarCount` 不是 `2` 或 `3`。
* 图片生成能力可用但 `generatedAvatarAssets.length !== avatarCount`。
* 未审批却请求编辑计划。
* 编辑计划没有任何待更新字段。

以下情况才允许头像降级：

```text
当前执行环境确实没有任何图片生成能力
```

降级时必须返回 `avatarGeneration.status=degraded` 和 `fallbackReason`，不得把参考素材作为 `avatarAsset`。

## 成功标准

普通资料生成成功标准：

* 输出只包含 `targets` 请求的字段。
* 字段格式和长度符合 [references/profile-fields.md](references/profile-fields.md)。
* 未经审批不生成正式编辑计划。

头像生成成功标准：

```text
referenceAssets.length >= 1
avatarCount in [2, 3]
generatedAvatarAssets.length === avatarCount
avatarGeneration.status === generated
avatarAsset 来自 generatedAvatarAssets
```

编辑计划成功标准：

* `approved=true`。
* 至少有一个待更新字段。
* `requestDraft` 不包含审核证据字段。
* 本 skill 没有执行 Instagram 修改。
