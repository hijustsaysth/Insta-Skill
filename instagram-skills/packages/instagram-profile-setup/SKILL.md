---
name: instagram-profile-setup
description: >
  基于名称提示、业务说明、联系方式和参考素材生成 Instagram 账号资料草案；
  涉及头像时要求先取得新生成头像素材；审批通过后只生成资料编辑计划和参数草案。
  本 skill 不直接修改 Instagram。
---

# instagram-profile-setup

生成 `username`、`displayName`、`biography`、`avatar` 草案；审批后生成编辑计划。绝不登录、管理 session/proxy/设备、调用 provider、MCP、`InstagramClient` 或 `ctx.instagram`，也不提交修改。

工具：`instagram_profile_generate`、`instagram_profile_edit_plan`。

```powershell
node .\dist\cli.bundle.js list-tools
node .\dist\cli.bundle.js invoke --action instagram_profile_generate --input-json profile-generate.json
node .\dist\cli.bundle.js invoke --action instagram_profile_edit_plan --input-json profile-edit-plan.json
```

`--input-json` 支持内联 JSON、文件路径和 stdin `-`；`bin` 暴露时可用 `instagram-profile-setup`。详见 [references/approval-and-cli.md](references/approval-and-cli.md)。

## 流程

1. 按 `targets` 校验所需输入并调用 `instagram_profile_generate`。
2. 将草案交用户/上层 agent 审批；明确审批后才调用 `instagram_profile_edit_plan`。
3. 后续修改由执行层完成。

含 `avatar` 时先读 [references/avatar-generation.md](references/avatar-generation.md) 并完成生成或明确降级。

## 输入契约

`instagram_profile_generate` 必填 `accountId`、`targets`。按目标另需：`username` -> `namePrompt`；`displayName` -> `brandPrefix`、`englishName`；`biography` -> `businessPrompt` 或 `biographyPrompt` 及 `contactPrompt`；`avatar` -> `referenceAssets`。

头像可传 `generatedAvatarAssets`、`avatarCount`、`avatarOutputDir`、`avatarGenerationSupported`。返回仅含请求目标字段及审核证据。字段细则见 [references/profile-fields.md](references/profile-fields.md)。

`instagram_profile_edit_plan` 必填 `accountId`、`approved`；可选 `sessionRef`、`username`、`displayName`、`biography`、`avatarAsset`、`preferredProvider`。`approved` 必须为 `true`，且至少一个更新字段；`requestDraft` 只含实际字段。无 `sessionRef` 返回 warning 由执行层补齐；`preferredProvider` 仅影响建议 `targetTool`，本 skill 不调用它。

## 硬约束与失败

头像：`referenceAssets` 至少一个有效路径/URL；`avatarCount` 仅 `2`/`3`（默认 `3`）；有生成能力必须先生成准确数量；`generatedAvatarAssets.length === avatarCount`；成功时 `avatarGeneration.status=generated` 且 `avatarAsset` 来自数组；`degraded` 仅环境确实无生成能力时允许，须有 `fallbackReason` 且无 `avatarAsset`。参考素材不得作为最终头像。

字段：`username` 最多 30 字符，仅 `a-z0-9_.`；`displayName` 固定 `{brandPrefix}-{englishName}`、最多 64；`biography` 最多 150，默认 `Selling {业务说明}. Contact & WhatsAPP: {联系方式}`，联系方式原样保留。

缺少目标输入、长度超限、非法 `avatarCount`、生成数量不符、未审批请求计划或无更新字段均直接失败。成功输出只含请求目标字段，未经审批不生成正式计划且不执行 Instagram 修改。
