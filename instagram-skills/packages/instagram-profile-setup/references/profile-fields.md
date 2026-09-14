# 资料字段规则

## `username`

输入 `namePrompt`。输出必须为小写，仅含 `a-z`、`0-9`、`_`、`.`，最多 30 字符；为空或超限直接失败，不缩写/截断。

## `displayName`

输入 `brandPrefix`、`englishName`，固定输出 `{brandPrefix}-{englishName}`，最多 64 字符；超限直接失败。

## `biography`

输入 `businessPrompt` 或 `biographyPrompt` 及 `contactPrompt`；两种业务提示同时存在时优先 `businessPrompt`。默认模板：`Selling {业务说明}. Contact & WhatsAPP: {联系方式}`。

最多 150 字符，必须原样保留联系方式（数字、邮箱、账号均不得改写）；超限直接失败，不删除业务信息或联系方式。

## `avatarAsset`

```json
{"uri":"path-or-url","mediaType":"image"}
```

仅当 `avatarGeneration.status=generated` 时返回，且 `uri` 必须来自 `generatedAvatarAssets`。
