# Instagram养号skills

## 目录

* [总编排能力](#总编排能力)
  * [养号skill](#养号skill)
* [具体能力](#具体能力)
  * [每日自动互动同类型视频skill](#每日自动互动同类型视频skill)
  * [发布内容skill](#发布内容skill)

## 说明

根据 **海外社媒运营流程-12.31.pdf**：一、社媒六大平台介绍及养号流程  整理了Instagram养号skills的初版方案

## 总编排能力

### 养号skill

#### 定位

对应**原始需求（5）**：养号

#### 职责

根据账号注册日期，识别养号阶段，选择具体动作

#### 输入

* 账号id
* 注册日期
* 当前日期
* access token/session之类支持api调用的标识信息
* 语言要求
* 素材库路径

#### 输出

* 日期
* 当前阶段
* 今日任务列表
* 调用skill
* 每个任务的执行结果
* 执行日志（日志内容根据阶段对应的skill而定）
* 下一次建议执行时间

#### 流程

* 根据注册日期识别养号阶段
* 生成今日任务计划
* 调用子skill
* 执行
* 输出结果

#### 能力

* 账号基础建设skill
* 每日自动互动同类型视频skill
* 发布内容skill

## 具体能力

### 账号基础建设skill

#### 定位

对应**原始需求2.个人信息维护**

#### 职责

根据要求和素材生成头像、背景图、名字、简介

#### 输入

* 账号id
* access token/session之类支持api调用的标识信息
* 可参考图片
* 主页个人名字约束提示词
* 个人简介约束提示词

#### 输出

* 头像
* 名字
* 简介
* api调用结果

#### 流程

* 根据提示词生成账户名字
* 根据提示词生成个人简介
* 根据素材生成头像
* 根据素材、尺寸要求生成背景图

#### 能力

* 个人资料编辑tool
  * 输入：头像、名字、简介
  * 输出：结果状态

#### 技术方案
* aiograpi（https://github.com/subzeroid/aiograpi）

aiograpi 是直接调用 Instagram Private API 的异步 Python SDK，部署相对简单，只需要在 Python 环境中安装依赖即可，适合需要直接控制 SDK、调试新接口或快速补能力的场景。它的优势是能力覆盖最完整、更新通常更快：Instagram Private API 变化后，底层能力一般会先进入 aiograpi，因此新能力验证和兼容性修复更直接。缺点是上层系统需要自己处理 Session、Proxy、异常恢复以及 Tool 封装；如果 Agent 或后端不是 Python，还需要再自行包装 HTTP/MCP 服务。

* aiograpi-rest（https://github.com/subzeroid/aiograpi-rest）

aiograpi-rest 是把 aiograpi 封装成 HTTP REST 服务的项目，本质上仍然调用 Instagram Private API，但对外提供统一的 REST/OpenAPI 接口，因此更适合 Agent、Skill、MCP、Java/Go/Node 后端或多服务架构。通常通过 Docker 部署，服务端集中管理 Session、登录状态、Challenge 等，再由业务系统通过 HTTP 调用。更适合平台化和服务化，但部署、持久化、网络、鉴权和多账号 Session/Proxy 管理复杂，而且 REST 层不一定暴露底层 SDK 的全部能力。支持Docker部署、开箱即用

* Instagram connector
api不可用时的兜底。

* 如果只做能力验证，优先aiograpi-rest。由于是非官方api，为了降低封号风险，需要复用用户session避免持续、频繁产生新的登录行为，从而触发风控

### 每日自动互动同类型视频skill

#### 定位

对应**原始需求（5）养号流程①1-5天**：每天在各平台刷同类型短视频半小时并点赞、评论互动，避免系统识别人机号或营销号进行限流。

#### 职责

* 模拟真人浏览行为

* 模拟轻量互动行为

* 控制行为节奏

* 记录账号行为历史

#### 输入

* 账号id
* 关键词列表
* 最多点赞数
* 最多评论数
* 评论风格提示词
* 最小停留时间
* 最大停留时间

#### 输出

* 日期
* 运行时长
* 观看数
* 点赞数
* 评论数
* 执行日志：
  * 类型（观看、点赞、评论）
  * 视频标题
  * 视频url
  * 评论内容
  * 停留时间
  * 动作结果

#### 流程

* 关键词搜索
* 观看
* AI理解视频（是否符合目标、是否点赞、是否评论）
* 点赞
* 生成评论
* 写入日志

#### 能力

* 视频搜索tool
  * 输入：关键词
  * 输出：url
* 视频识别tool
  * 输入：url、目标说明
  * 输出：是否符合目标、是否点赞、是否评论
* 点赞tool
  * 输入：无
  * 输出：结果状态、时间
* 评论tool：
  * 输入：评论内容
  * 输出：结果状态、时间

#### 技术方案

* Instagram connector
编写Instagram connector，实现操作组件节点完成指定动作（搜索reels、点赞、评论、滑动等），调用组件节点失败时，使用截图+识别坐标兜底

* Android Accessibility Script Pack 脚本

[ven-coder/assists: 🔥Android无障碍服务（AccessibilityService）开发框架，Android自动化脚本框架，快速开发复杂自动化任务、远程协助、监听等](https://github.com/ven-coder/assists)：封装Accessibility，提供更高层API，可以通过MCP暴露能力

* Playwright 脚本

[vrajdesai78/instagram-skill](https://github.com/vrajdesai78/instagram-skill)：提供关键词搜索、**reels搜索**传参hashtag和tab（top/recent/clips）

### 发布内容skill

#### 定位

对应**原始需求（5）②、③**：每天发布1-2篇帖子  |  利用stories、reels等

#### 职责

根据产品素材、历史内容生成文字、图片、视频并发布post/stories/reels

#### 输入

* 账号id
* 发布类型（post/stories/reels）
* 参考素材
* 产品信息说明
* 目标市场语言
* 发布时间
* 是否自动生成图片/视频

#### 输出

* 结果：
  * 状态
  * 时间
  * 失败原因
  * post id
* 生成内容：
  * 类型（post/stories/reels）
  * tag
  * 正文
  * 图片/视频

#### 流程

* 根据素材、信息生成基本亮点说明（类型、使用场景、优点）
* 根据发布类型生成不同的内容：
  * post：更详细的亮点说明+图片
  * stories：简短产品展示（图片、短视频、文字）
  * reels：短视频
* 内容检查（是否包含品牌定位、商品说明、目标市场语言习惯，不包含敏感信息）
* 人工审批
* 发布
* 结果回写

#### 能力

* Post生成 Tool
* Stories生成 Tool
* Reels生成Tool
* 发布Tool
* 发布状态查询Tool

#### 技术方案

* 官方API
最安全、风险最低。但是只支持专业账号。

* aiograpi-rest（https://github.com/subzeroid/aiograpi-rest）
非官方API，支持普通账号。可以作为非专业账号的兜底方案。

* Instagram connector
api失效时的兜底。