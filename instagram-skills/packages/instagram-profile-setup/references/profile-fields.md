# 资料字段规则

## `username`

输入：`namePrompt`。

输出规则：

* 最多 30 字符。
* 只允许小写 `a-z`、`0-9`、`_`、`.`。
* 生成后为空或超限时直接失败，不自动缩写或截断。

## `displayName`

输入：`brandPrefix`、`englishName`。

固定格式：`{brandPrefix}-{englishName}`。

最多 64 字符；超限直接失败，不改用其他格式。

## `biography`

输入：`businessPrompt` 或 `biographyPrompt`，以及 `contactPrompt`。前两者同时存在时优先 `businessPrompt`。

默认模板：

```text
Selling {业务说明}. Contact & WhatsAPP: {联系方式}
```

最多 150 字符；必须原样保留联系方式，不得改写数字、邮箱或账号。超限直接失败，不自动删除业务信息或联系方式。

## `avatarAsset`

```json
{ "uri": "path-or-url", "mediaType": "image" }
```

仅 `avatarGeneration.status=generated` 时返回，且 `avatarAsset.uri` 必须来自 `generatedAvatarAssets`。
