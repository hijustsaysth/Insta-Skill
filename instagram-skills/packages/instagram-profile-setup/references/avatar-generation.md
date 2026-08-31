# 头像生成规则

当 `targets` 包含 `avatar` 时，头像生成是调用 `instagram_profile_generate` 前的前置流程。

## 输入

必需：

```text
referenceAssets
```

可选：

```text
avatarCount
avatarOutputDir
generatedAvatarAssets
avatarGenerationSupported
```

`avatarCount` 只允许 `2` 或 `3`，默认 `3`。

## 图片生成能力可用

当 agent 或执行环境具备图片生成能力：

1. 使用 `referenceAssets` 作为人物、品牌、构图、色彩、风格或视觉元素参考。
2. 生成新的方形 Instagram 头像图片。
3. 如果单次只能生成一张，持续调用直到累计达到 `avatarCount`。
4. 把新生成图片路径作为 `generatedAvatarAssets` 传给 `instagram_profile_generate`。

禁止行为：

* 直接使用 `referenceAssets` 作为最终头像。
* 复制、重命名、移动或重新保存参考图片后冒充新头像。
* 用参考图片补足 `generatedAvatarAssets`。
* 在数量不足时标记头像生成成功。

## 数量规则

`generatedAvatarAssets.length` 必须严格等于 `avatarCount`。

如果数量不等，`instagram_profile_generate` 应直接失败。agent 应继续生成缺失图片，或者在确实没有图片生成能力时改为降级。

## 降级规则

只有当前执行环境确实没有任何图片生成能力时，才允许：

```json
{ "avatarGenerationSupported": false }
```

降级输出必须满足：

* `avatarGeneration.status` 为 `degraded`
* `avatarGeneration.fallbackReason` 有明确原因
* `avatarGeneration.generatedAssets` 为空
* 不返回 `avatarAsset`

## 成功输出

头像成功时：

* `avatarGeneration.status` 为 `generated`
* `avatarGeneration.generatedAssets.length` 等于 `avatarCount`
* `avatarAsset` 默认使用 `generatedAvatarAssets[0]`
* `avatarAsset.uri` 必须来自 `generatedAvatarAssets`
