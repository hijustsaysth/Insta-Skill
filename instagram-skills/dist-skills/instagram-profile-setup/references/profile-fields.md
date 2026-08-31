# 资料字段规则

## `username`

输入：

```text
namePrompt
```

输出规则：

* 最多 30 字符。
* 只允许 `a-z`、`0-9`、`_`、`.`。
* 必须小写。
* 生成后为空或超限时直接失败。
* 不自动缩写或截断。

## `displayName`

输入：

```text
brandPrefix
englishName
```

输出格式固定为：

```text
{brandPrefix}-{englishName}
```

限制：

* 最多 64 字符。
* 超限时直接失败。
* 不改成其他命名格式。

## `biography`

输入：

```text
businessPrompt 或 biographyPrompt
contactPrompt
```

`businessPrompt` 和 `biographyPrompt` 同时存在时，优先使用 `businessPrompt`。

默认输出模板：

```text
Selling {业务说明}. Contact & WhatsAPP: {联系方式}
```

限制：

* 最多 150 字符。
* 必须保留用户提供的原始联系方式。
* 不得改写数字、邮箱地址或账号。
* 超限时直接失败，不自动删除业务信息或联系方式。

## `avatarAsset`

格式：

```json
{
  "uri": "path-or-url",
  "mediaType": "image"
}
```

只有 `avatarGeneration.status=generated` 时才应返回。

`avatarAsset.uri` 必须来自 `generatedAvatarAssets`。
