---
name: instagram-connector
description: 通过本地 CLI 调用 Instagram Android Connector 执行移动端操作，适用于需要操作搜索并打开 Reel、连续观看视频、采集页面信号、点赞、评论、切换下一条视频或修改个人资料的场景。
---

# instagram-connector

本包用 CLI 调用内置 Gradle runtime，由 Java connector 操作已登录的 Instagram Android App。

## CLI 与配置

```powershell
node .\dist\cli.bundle.js list-tools
node .\dist\cli.bundle.js probe
node .\dist\cli.bundle.js invoke --action instagram.search.input --input-json '{"keyword":"fitness"}'
.\scripts\instagram-connector.ps1 invoke --action instagram.debug.snapshot --input-json "{}"
instagram-connector invoke --action instagram.reel.inspect --input-json "{}"
```

`--input-json` 支持内联 JSON、文件、stdin `-`。CLI 默认以临时文件及 `instagram.local.inputJsonFile` 向 Java 传业务 JSON，避免特殊字符拆分；旧 `instagram.local.inputJson` 仅作手工调试兜底。

CLI 参数：`--runtime-root`、`--gradle-command`、`--adb-path`、`--adb-serial`、`--artifact-dir`、`--command-timeout-ms`、`--wait-timeout-ms`、`--deadline-ms`、`--adb-keyboard-ime`、`--adb-keyboard-input-action`。

对应环境变量：`INSTAGRAM_CONNECTOR_RUNTIME_ROOT`、`INSTAGRAM_CONNECTOR_GRADLE_COMMAND`、`INSTAGRAM_CONNECTOR_ADB_PATH`、`INSTAGRAM_CONNECTOR_ADB_SERIAL`（`INSTAGRAM_ADB_SERIAL` 仍可作默认值）、`INSTAGRAM_CONNECTOR_ARTIFACT_DIR`、`INSTAGRAM_CONNECTOR_COMMAND_TIMEOUT_MS`（默认 15000）、`INSTAGRAM_CONNECTOR_WAIT_TIMEOUT_MS`（15000）、`INSTAGRAM_CONNECTOR_DEADLINE_MS`（30000）、`INSTAGRAM_CONNECTOR_ADB_KEYBOARD_IME`（`com.android.adbkeyboard/.AdbIME`）、`INSTAGRAM_CONNECTOR_ADB_KEYBOARD_INPUT_ACTION`（`ADB_INPUT_B64`）。

`runtime/` 含 `connector-sdk`、`local-mobile-runtime`、`instagram-connector`；链路：Node CLI -> Gradle `:instagram-connector:invokeLocalInstagramRuntime` -> `InstagramLocalRuntimeCommand` -> `LocalAdbMobileRuntime` -> `InstagramConnector.execute(...)`。

## 动作

`instagram.app.open`、`instagram.debug.snapshot`、`instagram.debug.ocr`、`instagram.search.open`、`instagram.search.input`、`instagram.search.open_first_reel`、`instagram.reel.inspect`、`instagram.reel.collect_signals`、`instagram.reel.like`、`instagram.reel.comment`、`instagram.reel.next`、`instagram.reels.engage_workflow`、`instagram.profile.update`。

## `instagram.profile.update`

可选输入 `displayName`、`username`、`bio`、`avatarUrl`、`packageName`；前四项至少一个非空，仅修改非空字段。文本在单字段页替换而非追加。`avatarUrl` 支持 `http/https` 或 host 本地路径，支持 `.jpg`、`.jpeg`、`.png`、`.webp`；runtime 先以 `checkpoint(type=media.prepare)` 准备并推送到模拟器相册，再选相册首图，因此不得并发写入其他图片。

```powershell
instagram-connector invoke --action instagram.profile.update --input-json '{"displayName":"Tiny Paws","username":"tinypaws","bio":"Daily cozy pet moments.","avatarUrl":"https://example.com/avatar.jpg"}'
```

## `instagram.reels.engage_workflow`

只搜索、打开 Reel、连续观看，不点赞/评论。必填 `keyword`、`perVideoWatchMs`、`totalWatchMs`；可选 `packageName`、`preOpenScrollMin`、`preOpenScrollMax`、`preOpenScrollCount`。顺序为打开 App、搜索、输入关键词、首条 Reel；打开前可预滚动，未传次数默认随机 2-6 次。单条最多 `perVideoWatchMs`，累计至 `totalWatchMs`；末条只看剩余时间。内部 forward scroll 的日志仍记 `instagram.reel.next`，但不复用独立动作的页面指纹校验。

## 重试与评论输入

`instagram.search.open_first_reel` 失败但截图仍为结果页时，XML 节点最多建议重试 2 次；仍失败可按截图坐标尝试 1 次，之后必须用 `instagram.reel.inspect` 或 `instagram.reel.collect_signals` 确认。无法确认则返回降级，不点赞、评论或滑动。

评论优先通过 ADB Keyboard，以 `ADB_INPUT_B64` 发送 UTF-8 base64；输入后尽量恢复原输入法。不可用时仅 `U+0020`-`U+007E` 可打印 ASCII 可用 `adb input text`。中文、Emoji、换行、全角标点或其他非 ASCII 必须降级；`UI_INPUT_UNICODE_UNSUPPORTED` 时停止评论且不点 Post。中文命令行回传乱码可忽略。

## 结果与副作用

成功外层为 `{ "ok": true, "result": { "status": "SUCCESS", "code": "OK", "output": {} } }`。状态：`SUCCESS` 可继续；`FAILED` 停止并记录；`DEGRADED` 表示 XML/状态不可信或需确认，不执行副作用；`CANCELLED` 停止并记录。

`instagram.reel.like`、`instagram.reel.comment`、`instagram.profile.update` 调用前必须明确确认并保证页面可信、无 XML/截图冲突；点赞前确认未点赞。更新资料还须确认字段与头像来源，本地头像路径必须确为目标图片。
