# instagram-warmup-orchestrator

## 职责

本 skill 只生成 Instagram 养号总计划和执行结果汇总。

## 使用边界

* 可以根据账号注册日期和当前日期判断养号阶段。
* 可以生成今日任务计划和工具参数草案。
* 可以汇总 agent 服务回传的真实执行日志。
* 不执行点赞、评论、发帖或资料编辑。
* 不调用其他 skill tool、provider、MCP tool 或 `ctx.instagram`。
* runner、循环、等待、超时、中断和状态管理由 agent 服务负责。

## 注册工具

* `instagram_warmup_plan`
* `instagram_warmup_result_summarize`
