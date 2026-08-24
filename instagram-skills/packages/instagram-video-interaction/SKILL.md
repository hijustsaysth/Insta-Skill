# instagram-video-interaction

## 职责

本 skill 只生成视频互动计划、单条视频判断、评论内容和互动日志汇总。

## 使用边界

* 可以判断当前视频是否匹配目标。
* 可以决定是否建议点赞、是否建议评论。
* 可以生成评论文本。
* 不执行搜索、点赞、评论、滑动。
* 不调用 `instagram-connector` MCP tools。
* 自动半小时循环由 agent 服务执行。

## 注册工具

* `instagram_video_interaction_plan`
* `instagram_video_evaluate`
* `instagram_video_comment_generate`
* `instagram_video_log_summarize`
