# 审批、编辑计划和 CLI

## 审批与编辑计划

`instagram_profile_generate` 只生成草案。只有用户或上层 agent 明确表达以下任一内容后，才能调用 `instagram_profile_edit_plan`：

```text
确认
批准
可以使用
按这个执行
approved=true
```

未明确审批不得生成正式计划。

`instagram_profile_edit_plan` 只生成执行层参数草案，不修改 Instagram。输入：

```json
{
  "accountId": "ig-account-001",
  "sessionRef": "session-ref-001",
  "approved": true,
  "displayName": "Kubota-Parts",
  "preferredProvider": "instagram-client"
}
```

还可按需提供 `username`、`biography`、`avatarAsset`。输出 `requestDraft` 只含实际修改字段，不得包含 `avatarGeneration`、`referenceAssets`、`generatedAvatarAssets`、`fallbackReason` 等审核证据。

## CLI

```powershell
node .\dist\cli.bundle.js list-tools
node .\dist\cli.bundle.js invoke --action instagram_profile_generate --input-json '{"accountId":"ig-account-001","targets":["displayName"],"brandPrefix":"Kubota","englishName":"Parts"}'
node .\dist\cli.bundle.js invoke --action instagram_profile_edit_plan --input-json profile-edit-plan.json
```

`--input-json` 接受内联 JSON、文件或 stdin `-`，也支持 PATH bin。CLI 成功返回 `{ "ok": true, "result": {} }`；失败返回 `{ "ok": false, "error": { "code": "error_code", "message": "error message" } }`。
