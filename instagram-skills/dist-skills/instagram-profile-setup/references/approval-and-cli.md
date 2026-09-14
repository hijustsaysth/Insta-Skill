# 审批、编辑计划和 CLI

`instagram_profile_generate` 只生成草案。用户或上层 agent 明确说“确认”“批准”“可以使用”“按这个执行”或 `approved=true` 后，才能调用 `instagram_profile_edit_plan`；否则不得生成正式计划。

编辑计划只输出执行层参数，不修改 Instagram。输入至少含 `accountId`、`approved`，并提供一个待更新字段；`approved` 必须为 `true`。`requestDraft` 只含实际字段，不得含 `avatarGeneration`、`referenceAssets`、`generatedAvatarAssets`、`fallbackReason` 等审核证据。

示例：
```json
{"accountId":"ig-account-001","sessionRef":"session-ref-001","approved":true,"displayName":"Kubota-Parts","preferredProvider":"instagram-client"}
```

CLI：
```powershell
node .\dist\cli.bundle.js list-tools
node .\dist\cli.bundle.js invoke --action instagram_profile_generate --input-json profile-generate.json
node .\dist\cli.bundle.js invoke --action instagram_profile_edit_plan --input-json profile-edit-plan.json
```

若 `bin` 在 `PATH`，可用 `instagram-profile-setup list-tools` 或 `instagram-profile-setup invoke --action instagram_profile_generate --input-json -`。`--input-json` 支持内联 JSON、文件和 stdin `-`。

成功外层为 `{ "ok": true, "result": {} }`，失败为 `{ "ok": false, "error": { "code": "error_code", "message": "error message" } }`。字段规则见 [profile-fields.md](profile-fields.md)。
