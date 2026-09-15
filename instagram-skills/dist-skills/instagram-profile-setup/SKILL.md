---
name: instagram-profile-setup
description: >
  基于名称提示、业务说明、联系方式和参考素材生成 Instagram 账号资料草案；
  涉及头像时要求先取得新生成头像素材；审批通过后只生成资料编辑计划和参数草案。
  本 skill 不直接修改 Instagram。
---

# instagram-profile-setup

## 职责与工具

本 skill 生成 `username`、`displayName`、`biography`、`avatar` 草案，并在明确审批后生成编辑计划；不登录、不管理 session/proxy/设备、不调用 provider、MCP tool、`InstagramClient` 或 `ctx.instagram`，不执行 Instagram 修改。

工具：`instagram_profile_generate`、`instagram_profile_edit_plan`。

```powershell
node .\dist\cli.bundle.js list-tools
node .\dist\cli.bundle.js invoke --action instagram_profile_generate --input-json profile-generate.json
node .\dist\cli.bundle.js invoke --action instagram_profile_edit_plan --input-json profile-edit-plan.json
```

也支持 PATH bin。`--input-json` 接受内联 JSON、文件或 stdin `-`；更多示例见 [references/approval-and-cli.md](references/approval-and-cli.md)。

## 生成与审批流程

1. 确定 `targets`，只校验对应输入并调用 `instagram_profile_generate`。
2. 将草案交给用户或上层 agent 明确审批。
3. 仅审批后调用 `instagram_profile_edit_plan`；后续修改由执行层/其他 skill 完成。
4. 目标含 `avatar` 时，先按 [references/avatar-generation.md](references/avatar-generation.md) 生成头像或明确降级。

### `instagram_profile_generate`

必填 `accountId`、`targets`；按目标额外必填：`username → namePrompt`，`displayName → brandPrefix, englishName`，`biography → businessPrompt` 或 `biographyPrompt` 且须 `contactPrompt`，`avatar → referenceAssets`。头像另支持 `generatedAvatarAssets`、`avatarCount`、`avatarOutputDir`、`avatarGenerationSupported`。只返回请求的草案字段和必要审核证据；字段规则见 [references/profile-fields.md](references/profile-fields.md)。

### `instagram_profile_edit_plan`

必填 `accountId`、`approved`；可选 `sessionRef`、`username`、`displayName`、`biography`、`avatarAsset`、`preferredProvider`。

* `approved` 必须为 `true`，且至少一个待更新字段，否则失败。
* `requestDraft` 只含实际修改字段，不含审核证据。
* 缺少 `sessionRef` 时返回 warning，由执行层补齐。
* `preferredProvider` 只影响建议的 `targetTool`，本 skill 不调用它。

审批细则见 [references/approval-and-cli.md](references/approval-and-cli.md)。

## 硬约束

* `username`：最多 30 字符，仅 `a-z`、`0-9`、`_`、`.`；超限失败。
* `displayName`：最多 64 字符，固定 `{brandPrefix}-{englishName}`。
* `biography`：最多 150 字符，默认 `Selling {业务说明}. Contact & WhatsAPP: {联系方式}`；原始联系方式中的数字、邮箱、账号不得改写。
* 头像：`referenceAssets` 至少一个有效路径/URL；`avatarCount` 仅 `2` 或 `3`，默认 `3`；有图片生成能力时须先生成新头像，且 `generatedAvatarAssets.length === avatarCount`。
* `avatarGeneration.status=generated` 时，`avatarAsset` 必须来自 `generatedAvatarAssets`；参考素材不得作为最终头像。
* `avatarGeneration.status=degraded` 仅限环境确实无任何图片生成能力，须返回 `fallbackReason`，且不得返回 `avatarAsset`。

以下情况直接失败：缺少目标所需输入、字段超限、`avatarCount` 非 `2/3`、有生成能力但头像数量不等、未审批却请求编辑计划、编辑计划无更新字段。

## 成功条件

* `targets` 不含 `avatar`（仅 `username`、`displayName`、`biography`）时，只验证并输出请求的普通资料字段，不要求 `referenceAssets`、`generatedAvatarAssets` 或 `avatarGeneration.status`。
* `targets` 含 `avatar` 且确认具备图片生成能力时，要求 `referenceAssets.length >= 1`、`generatedAvatarAssets.length === avatarCount`、`avatarGeneration.status === generated`，并返回来自 `generatedAvatarAssets` 的 `avatarAsset`；不得使用 degraded 结果。
* `targets` 含 `avatar` 且确认环境没有图片生成能力时，允许 `avatarGeneration.status === degraded`，但须有非空 `fallbackReason`，输入 `generatedAvatarAssets` 和输出 `avatarGeneration.generatedAssets` 均为空，且不返回 `avatarAsset`；这是合法降级结果，不是失败，也不得与 generated 分支混用。
* 编辑计划须 `approved=true`、有更新字段、`requestDraft` 无审核证据，且本 skill 未执行修改。
