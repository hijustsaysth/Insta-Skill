---
name: instagram-content-publish
description: 生成 Instagram 内容草稿、发布计划、状态查询计划和参数草案。
---

# instagram-content-publish

## 职责

本 skill 只生成 Instagram 内容草稿、发布计划、状态查询计划和参数草案。

## 使用边界

* 可以生成 post、story、reels 的文案、图片引用、视频引用。
* 可以生成发布计划和状态查询计划。
* 不直接发布内容。
* 不直接查询发布状态。
* 不调用 provider、MCP tool 或 `ctx.instagram`。
* 正式发布和状态查询由 agent 服务执行。

## 注册工具

* `instagram_content_generate`
* `instagram_content_publish_plan`
* `instagram_publish_status_plan`
