---
name: instagram-connector
description: 通过本地 CLI 调用 Instagram Android Connector 执行移动端操作，适用于需要操作搜索并打开 Reel、连续观看视频、采集页面信号、点赞、评论、切换下一条视频或修改个人资料的场景。
---

# instagram-connector

本 skill 的 CLI 调用包内 Gradle runtime，由 Java connector 操作已登录的 Instagram Android App。

## CLI 与 Runtime

在当前 skill 目录运行：

```powershell
node .\dist\cli.bundle.js list-tools
node .\dist\cli.bundle.js probe
node .\dist\cli.bundle.js invoke --action instagram.debug.snapshot --input-json "{}"
node .\dist\cli.bundle.js invoke --action instagram.search.input --input-json '{"keyword":"fitness"}'
```

也支持 `scripts/instagram-connector.ps1` wrapper 与 PATH bin。`--input-json` 接受内联 JSON、文件或 stdin `-`。CLI 默认将业务 JSON 写入临时文件，以 `instagram.local.inputJsonFile` 传给 Java，避免空格、引号、中文或 Emoji 被拆分；旧参数 `instagram.local.inputJson` 仅供手工调试兜底。

CLI 参数：`--runtime-root`、`--gradle-command`、`--adb-path`、`--adb-serial`、`--artifact-dir`、`--command-timeout-ms`、`--wait-timeout-ms`、`--deadline-ms`、`--adb-keyboard-ime`、`--adb-keyboard-input-action`。

对应环境变量：`INSTAGRAM_CONNECTOR_RUNTIME_ROOT`、`INSTAGRAM_CONNECTOR_GRADLE_COMMAND`、`INSTAGRAM_CONNECTOR_ADB_PATH`、`INSTAGRAM_CONNECTOR_ADB_SERIAL`（`INSTAGRAM_ADB_SERIAL` 仍可作默认值）、`INSTAGRAM_CONNECTOR_ARTIFACT_DIR`、`INSTAGRAM_CONNECTOR_COMMAND_TIMEOUT_MS`（默认 `15000`）、`INSTAGRAM_CONNECTOR_WAIT_TIMEOUT_MS`（默认 `15000`）、`INSTAGRAM_CONNECTOR_DEADLINE_MS`（默认 `30000`）、`INSTAGRAM_CONNECTOR_ADB_KEYBOARD_IME`（默认 `com.android.adbkeyboard/.AdbIME`）、`INSTAGRAM_CONNECTOR_ADB_KEYBOARD_INPUT_ACTION`（默认 `ADB_INPUT_B64`）。

包内 `runtime` 只含 `connector-sdk`、`local-mobile-runtime`、`instagram-connector`；调用链为 Node CLI → Gradle `:instagram-connector:invokeLocalInstagramRuntime` → `InstagramLocalRuntimeCommand` → `LocalAdbMobileRuntime` → `InstagramConnector.execute(...)`。

## 支持动作

```text
instagram.app.open
instagram.debug.snapshot
instagram.debug.ocr
instagram.search.open
instagram.search.input
instagram.search.open_first_reel
instagram.reel.inspect
instagram.reel.collect_signals
instagram.reel.like
instagram.reel.comment
instagram.reel.next
instagram.reels.engage_workflow
instagram.profile.update
```

## `instagram.profile.update`

可选输入：`displayName`、`username`、`bio`、`avatarUrl`、`packageName`。

1. 前四个资料字段至少一个非空；只修改非空字段。
2. 文本字段进入单字段编辑页并替换旧值，不追加。
3. `avatarUrl` 支持 `http/https` URL 或 host 本地路径，图片类型为 `.jpg`、`.jpeg`、`.png`、`.webp`。
4. Local Runtime 先以 `checkpoint(type=media.prepare)` 下载/读取图片并推送到模拟器相册，再从 Instagram 相册选择。
5. 默认选择当前相册首图，调用时不得并发写入其他图片。

## `instagram.reels.engage_workflow`

只执行搜索、打开 Reel 和连续观看，不点赞、不评论。必填 `keyword`、`perVideoWatchMs`、`totalWatchMs`；可选 `packageName`、`preOpenScrollMin`、`preOpenScrollMax`、`preOpenScrollCount`。

1. 打开 App、搜索并输入关键词，再打开第一条 Reel。
2. 打开前可预滚动；未传 `preOpenScrollCount` 时随机 2 到 6 次。
3. 每条最多观看 `perVideoWatchMs`，累计到 `totalWatchMs` 停止；最后不足一条时只看剩余时长。
4. workflow 内部 forward scroll 的日志动作仍为 `instagram.reel.next`，但不复用独立动作的页面指纹校验。
5. 不调用 `instagram.reel.like` 或 `instagram.reel.comment`。

## `open_first_reel` 重试

1. 优先调用 `instagram.search.open_first_reel`。
2. 失败但截图仍是搜索结果和 Reel 缩略图时，可重试 XML 节点，建议最多 2 次。
3. 仍失败时允许截图识别推测坐标执行 1 次。
4. 坐标兜底后必须用 `instagram.reel.inspect` 或 `instagram.reel.collect_signals` 确认进入 Reel。
5. 仍无法确认则返回降级，不继续点赞、评论或滑动。

## 评论输入

1. 优先使用外部 ADB Keyboard；默认组件 `com.android.adbkeyboard/.AdbIME`，默认广播 `ADB_INPUT_B64`，以 UTF-8 base64 传输。
2. ADB Keyboard 不可用时，仅 `U+0020` 至 `U+007E` 的可打印 ASCII 可用 `adb input text` 兜底。
3. ADB Keyboard 可用时，中文、Emoji、换行、全角标点等非 ASCII 正常经 `ADB_INPUT_B64` 以 UTF-8 base64 发送；仅当 ADB Keyboard 不可用或无法启用时才返回降级。返回 `UI_INPUT_UNICODE_UNSUPPORTED` 时立即停止评论，不得点击 Post。
4. 使用中文或 Emoji 前应安装并启用 ADB Keyboard；connector 输入时临时切换，之后尽量恢复。命令行回传乱码可忽略。

## 结果与副作用

CLI 成功外层为 `{ "ok": true, "result": { "status": "SUCCESS", "code": "OK", "output": {} } }`。状态：

| 状态 | 含义与后续动作 |
| --- | --- |
| `SUCCESS` | 动作完成且已确认，可继续 |
| `FAILED` | 动作失败，停止并记录 |
| `DEGRADED` | XML 失败或状态不可信，已兜底/需人工确认；不得执行点赞、评论等副作用 |
| `CANCELLED` | 动作取消，停止并记录 |

`instagram.reel.like`、`instagram.reel.comment`、`instagram.profile.update` 会修改状态，调用前必须取得明确确认，并确认页面可信、无 XML/截图冲突。点赞前确认尚未点赞；资料更新前确认修改字段和头像来源，本地头像还须确认路径对应目标图片。
