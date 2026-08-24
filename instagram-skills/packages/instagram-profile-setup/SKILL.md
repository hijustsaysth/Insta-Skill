# instagram-profile-setup

## 职责

本 skill 只生成 Instagram 账号资料方案、资料编辑计划和参数草案。

## 使用边界

* 可以生成名字、头像、简介。
* 可以根据人工审批后的资料生成编辑计划。
* 不直接提交资料编辑。
* 不调用 provider、MCP tool 或 `ctx.instagram`。
* 正式资料更新由 agent 服务执行。

## 注册工具

* `instagram_profile_generate`
* `instagram_profile_edit_plan`
