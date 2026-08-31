# 审批、编辑计划和 CLI

## 审批

`instagram_profile_generate` 只生成草案。草案必须经过用户或上层 agent 明确审批后，才能调用 `instagram_profile_edit_plan`。

以下表达可以视为明确审批：

```text
确认
批准
可以使用
按这个执行
approved=true
```

未明确审批时，不得生成正式编辑计划。

## 编辑计划

`instagram_profile_edit_plan` 只生成后续执行层可用的参数草案，不执行 Instagram 修改。

输入：

```json
{
  "accountId": "ig-account-001",
  "sessionRef": "session-ref-001",
  "approved": true,
  "displayName": "Kubota-Parts",
  "biography": "Selling Kubota harvester spare parts. Contact & WhatsAPP: +12345678900",
  "preferredProvider": "instagram-client"
}
```

输出中的 `requestDraft` 只包含实际要修改的字段。审核证据字段，例如 `avatarGeneration`、`referenceAssets`、`generatedAvatarAssets` 和 `fallbackReason`，不得进入 `requestDraft`。

## CLI 输出

成功：

```json
{ "ok": true, "result": {} }
```

失败：

```json
{ "ok": false, "error": { "code": "error_code", "message": "error message" } }
```

## CLI 示例

查看工具：

```powershell
node .\dist\cli.bundle.js list-tools
instagram-profile-setup list-tools
```

生成显示名：

```powershell
node .\dist\cli.bundle.js invoke --action instagram_profile_generate --input-json '{"accountId":"ig-account-001","targets":["displayName"],"brandPrefix":"Kubota","englishName":"Parts"}'
```

生成简介：

```powershell
node .\dist\cli.bundle.js invoke --action instagram_profile_generate --input-json '{"accountId":"ig-account-001","targets":["biography"],"businessPrompt":"Kubota harvester spare parts","contactPrompt":"+12345678900"}'
```

生成带头像的草案：

```powershell
node .\dist\cli.bundle.js invoke --action instagram_profile_generate --input-json '{"accountId":"ig-account-001","targets":["avatar"],"referenceAssets":["materials/avatar-ref.png"],"generatedAvatarAssets":["output/avatar-1.png","output/avatar-2.png","output/avatar-3.png"]}'
```

生成编辑计划：

```powershell
node .\dist\cli.bundle.js invoke --action instagram_profile_edit_plan --input-json '{"accountId":"ig-account-001","sessionRef":"session-ref-001","approved":true,"displayName":"Kubota-Parts"}'
```

从文件或 stdin 读取：

```powershell
instagram-profile-setup invoke --action instagram_profile_generate --input-json profile-generate.json
Get-Content .\profile-edit-plan.json | instagram-profile-setup invoke --action instagram_profile_edit_plan --input-json -
```
