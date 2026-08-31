# instagram-skills

Instagram 养号 agent skills 发布包。

本仓库维护 5 个可分发 skill。源码位于 `packages/`，发布产物由 `pnpm build` 生成到 `dist-skills/`。每个 `dist-skills/<skill-name>/` 都是一个独立 skill，可整体复制到目标 agent 的 skills 目录中使用。

## 使用边界

业务类 skill 只负责生成计划、草案、决策、参数或汇总结果。是否执行、何时执行、调用哪个执行工具、失败后是否重试，由 agent 服务决定。

执行类 skill 提供本地 CLI 调用说明和必要 runtime。agent 可以按 `SKILL.md` 调用 CLI，但执行授权、session 管理、敏感信息保存和运行状态管理仍由 agent 服务负责。

## 当前 skills

| skill | 作用 | 发布内容 |
| --- | --- | --- |
| `instagram-warmup-orchestrator` | 根据注册日期生成每日养号计划和执行汇总日志 | `SKILL.md`、`dist/cli.bundle.js`、`dist/` |
| `instagram-connector` | 通过 Android connector 执行移动端搜索、观看、点赞、评论和资料修改 | `SKILL.md`、`dist/cli.bundle.js`、`scripts/`、`runtime/` |
| `instagram-aiograpi-rest` | 通过 aiograpi-rest 服务执行登录、账号读取、注册日期读取、资料修改等请求 | `SKILL.md`、`dist/cli.bundle.js`、`scripts/` |
| `instagram-profile-setup` | 生成资料草案、头像生成约束和资料编辑计划 | `SKILL.md`、`references/`、`dist/cli.bundle.js`、`dist/` |
| `instagram-video-interaction` | 生成视频互动计划、判断点赞评论、汇总互动日志 | `SKILL.md`、`dist/cli.bundle.js`、`dist/` |

历史实验包不作为当前发布 skill：`instagram-core`、`instagram-cordis`、`instagram-session-store-sqlite`、`instagram-official-api`、`instagram-account-access`、`instagram-content-publish`、`instagram-runtime-services`。

## 目录结构

```text
instagram-skills/
  packages/
    instagram-aiograpi-rest/
    instagram-connector/
    instagram-profile-setup/
    instagram-video-interaction/
    instagram-warmup-orchestrator/
  scripts/
    build-skill-distribution.mjs
    install-codex-instagram-skills.mjs
    validate-skill-frontmatter.mjs
  dist-skills/
    README.md
    instagram-aiograpi-rest/
    instagram-connector/
    instagram-profile-setup/
    instagram-video-interaction/
    instagram-warmup-orchestrator/
```

## 构建与验证

```powershell
pnpm install
pnpm validate:skills
pnpm build
pnpm test
```

`pnpm build` 会重新生成 `dist-skills/`：

* 复制每个 skill 的 `SKILL.md`。
* 为需要命令入口的 skill 生成 `dist/cli.bundle.js`。
* 复制发布所需的 `dist/`、`scripts/`、`references/` 和 `runtime/`。
* 检查 CLI bundle 和 connector runtime 的必要文件。
* 排除 `.gradle`、`build` 等 runtime 缓存产物。

`pnpm test` 当前执行 skill frontmatter 校验和分发构建校验。

## 发布与接入

把 `dist-skills/` 下的子目录作为独立 skill 发布或安装到目标 agent skills 目录：

```text
dist-skills/instagram-warmup-orchestrator
dist-skills/instagram-connector
dist-skills/instagram-aiograpi-rest
dist-skills/instagram-profile-setup
dist-skills/instagram-video-interaction
```

agent 接入时先读取目标目录中的 `SKILL.md`。如果 `SKILL.md` 指向 `references/`，只在对应场景需要时读取相关 reference。

需要真实执行时，在对应 skill 目录内调用 CLI：

```powershell
node .\dist\cli.bundle.js list-tools
node .\dist\cli.bundle.js invoke --action <action-name> --input-json input.json
```

`--input-json` 通常支持内联 JSON、JSON 文件路径和 stdin `-`。不同 skill 的 action、参数和副作用约束以各自 `SKILL.md` 为准。

TS、Java、Python 或其他语言开发的 agent 都可以通过“启动 CLI 进程 + JSON 输入输出”的方式使用这些 skills；`instagram-aiograpi-rest` 还可以通过 HTTP 服务接入。

## 当前环境安装示例

本仓库提供一个面向当前开发环境的辅助安装脚本：

```powershell
pnpm install:codex-skills
```

该命令会先生成 `dist-skills/`，再把 5 个发布目录复制到 `$CODEX_HOME/skills`。这是当前环境的安装示例，不限制其他 agent 的安装路径；其他 agent 复制到自身 agent skills 目录即可。

## 关键约束

* skill 文档必须有 YAML frontmatter。
* 发布包不能依赖原始 monorepo 路径。
* CLI 示例必须使用相对当前 skill 目录的路径。
* 敏感信息优先通过 JSON 文件或 stdin 输入，不写入命令行历史。
* `sessionRef`、账号密码、cookie、token 等敏感字段只由 agent 服务或 provider 执行层处理，业务 skill 不解析、不打印。
* 修改资料、点赞、评论、发布等副作用动作必须由 agent 服务取得明确授权后执行。

## 相关文档

| 文档 | 说明 |
| --- | --- |
| `../docs/plans/Instagram养号skills包设计总览.md` | 总体分层、兼容方式、包职责 |
| `../docs/plans/sessionRef设计与实现方案.md` | sessionRef 和 SQLite 存储设计 |
| `../docs/benchmark/Instagram养号skills benchmark规范.md` | benchmark 任务、过程要求、结果要求和评分规则 |
