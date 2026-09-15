# 头像生成规则

`targets` 含 `avatar` 时，须先完成本流程再调用 `instagram_profile_generate`。

输入：

* 必需：`referenceAssets`。
* 可选：`avatarCount`、`avatarOutputDir`、`generatedAvatarAssets`、`avatarGenerationSupported`。
* `avatarCount` 仅允许 `2` 或 `3`，默认 `3`。

## 有图片生成能力

1. 将 `referenceAssets` 仅作为人物、品牌、构图、色彩、风格或视觉元素参考，生成新的方形 Instagram 头像。
2. 单次只能生成一张时持续生成，直到累计 `avatarCount` 张。
3. 将新图片路径作为 `generatedAvatarAssets` 传给 `instagram_profile_generate`。

禁止：

* 直接把参考图作为最终头像。
* 复制、重命名、移动或重新保存参考图后冒充新图。
* 用参考图补足 `generatedAvatarAssets`。
* 数量不足时标记成功。

`generatedAvatarAssets.length` 必须严格等于 `avatarCount`，否则工具直接失败；agent 应补生成，或仅在确实无生成能力时降级。

## 降级与输出

只有环境确实没有任何图片生成能力时才可传：

```json
{ "avatarGenerationSupported": false }
```

降级：`avatarGeneration.status=degraded`，包含明确 `avatarGeneration.fallbackReason`，`avatarGeneration.generatedAssets` 为空且不返回 `avatarAsset`。

成功：`avatarGeneration.status=generated`，`avatarGeneration.generatedAssets.length === avatarCount`；`avatarAsset` 默认取 `generatedAvatarAssets[0]`，`avatarAsset.uri` 必须来自 `generatedAvatarAssets`。
