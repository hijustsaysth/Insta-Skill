# 头像生成规则

`targets` 含 `avatar` 时，必须在 `instagram_profile_generate` 前完成本流程。

必需输入：`referenceAssets`。可选：`avatarCount`、`avatarOutputDir`、`generatedAvatarAssets`、`avatarGenerationSupported`。`avatarCount` 仅允许 `2` 或 `3`，默认 `3`。

有图片生成能力时：以参考素材用于人物/品牌/构图/色彩/风格参考，生成新的方形头像；单次一张则持续生成至 `avatarCount`，将新图路径作为 `generatedAvatarAssets`。禁止直接使用、复制、重命名、移动或重新保存参考图，也不得用参考图补足数量或数量不足时标记成功。

`generatedAvatarAssets.length` 必须严格等于 `avatarCount`，否则 `instagram_profile_generate` 失败；继续生成缺失图，或在确实没有图片生成能力时降级。

仅当当前环境确实没有任何图片生成能力时允许 `{ "avatarGenerationSupported": false }`。降级必须返回 `avatarGeneration.status=degraded`、明确 `fallbackReason`、空 `generatedAssets`，且不返回 `avatarAsset`。

成功时 `avatarGeneration.status=generated`，生成资产数等于 `avatarCount`，默认 `avatarAsset` 为 `generatedAvatarAssets[0]`，其 `uri` 必须来自该数组。
