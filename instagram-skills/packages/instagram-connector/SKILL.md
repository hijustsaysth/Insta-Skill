---
name: instagram-connector
description: 通过本地 CLI 调用 Instagram Android Connector 执行移动端操作，适用于需要操作搜索并打开 Reel、连续观看视频、采集页面信号、点赞、评论或切换下一条视频的场景。
---

# instagram-connector

`instagram-connector` 是 Instagram Android Connector 的本地 CLI 适配包。agent 服务通过本包 CLI 调用包内 Gradle runtime，再由 Java connector 执行层操作已登录的 Instagram Android App。

## CLI

构建后可直接调用：

```powershell
node packages/instagram-connector/dist/cli.js list-tools
node packages/instagram-connector/dist/cli.js probe
node packages/instagram-connector/dist/cli.js invoke --action instagram.debug.snapshot --input-json "{}"
node packages/instagram-connector/dist/cli.js invoke --action instagram.search.input --input-json '{"keyword":"fitness"}'
```

如果 workspace bin 已暴露：

```powershell
instagram-connector invoke --action instagram.reel.inspect --input-json "{}"
```

`--input-json` 支持三种来源：

- 内联 JSON：`--input-json "{}"`
- 文件路径：`--input-json input.json`
- stdin：`--input-json -`

CLI 调用 Java Runtime 时，默认会把解析后的业务 JSON 写入临时文件，并通过 `instagram.local.inputJsonFile` 传给 Gradle/Java，避免空格、引号、中文或 Emoji 在命令行参数中被拆散。Java Runtime 仍保留旧的 `instagram.local.inputJson` 作为手工调试兜底。

## 本地 Runtime 配置

CLI 参数：

```text
--runtime-root <path>
--gradle-command <command>
--adb-path <path>
--adb-serial <serial>
--artifact-dir <path>
--command-timeout-ms <ms>
--wait-timeout-ms <ms>
--deadline-ms <ms>
--adb-keyboard-ime <ime>
--adb-keyboard-input-action <action>
```

常用环境变量：

```text
INSTAGRAM_CONNECTOR_RUNTIME_ROOT=<runtime root>
INSTAGRAM_CONNECTOR_GRADLE_COMMAND=<gradle command>
INSTAGRAM_CONNECTOR_ADB_PATH=<adb path>
INSTAGRAM_CONNECTOR_ADB_SERIAL=emulator-5554
INSTAGRAM_CONNECTOR_ARTIFACT_DIR=<artifact dir>
INSTAGRAM_CONNECTOR_COMMAND_TIMEOUT_MS=15000
INSTAGRAM_CONNECTOR_WAIT_TIMEOUT_MS=15000
INSTAGRAM_CONNECTOR_DEADLINE_MS=30000
INSTAGRAM_CONNECTOR_ADB_KEYBOARD_IME=com.android.adbkeyboard/.AdbIME
INSTAGRAM_CONNECTOR_ADB_KEYBOARD_INPUT_ACTION=ADB_INPUT_B64
```

`INSTAGRAM_ADB_SERIAL` 仍可作为 serial 默认值。

## Java Runtime

包内 runtime 位于：

```text
packages/instagram-connector/runtime
```

它只保留必要模块：

```text
connector-sdk
local-mobile-runtime
instagram-connector
```

CLI 执行链路为：

```text
Node CLI
-> Gradle :instagram-connector:invokeLocalInstagramRuntime
-> InstagramLocalRuntimeCommand
-> LocalAdbMobileRuntime
-> InstagramConnector.execute(...)
```

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
```

## engage_workflow 连续观看定位

`instagram.reels.engage_workflow` 只执行搜索、打开 Reel 和连续观看视频，不点赞、不评论。

必填输入：

```text
keyword
perVideoWatchMs
totalWatchMs
```

可选输入：

```text
packageName
preOpenScrollMin
preOpenScrollMax
preOpenScrollCount
```

观看规则：

1. 先打开 Instagram、进入搜索页、输入 `keyword`，再打开第一条 Reel。
2. 打开 Reel 前可在搜索结果页预滚动；不传 `preOpenScrollCount` 时默认随机 2 到 6 次。
3. 每条视频最多观看 `perVideoWatchMs`。
4. 累计观看到 `totalWatchMs` 后停止。
5. 如果剩余总观看时间小于 `perVideoWatchMs`，最后一条只观看剩余时间。
6. 视频之间由 workflow 内部执行 forward scroll 切换；日志中的动作名仍记为 `instagram.reel.next`，但不复用独立 `instagram.reel.next` 的页面指纹校验。
7. 该组合流程不会调用 `instagram.reel.like` 或 `instagram.reel.comment`。

## open_first_reel 重试策略

`instagram.search.open_first_reel` 用于从搜索结果页打开第一条 Reel。由于 Instagram 搜索结果页、Reel 缩略图网格和全屏播放页的 XML/可访问性节点可能不稳定，agent 服务应按以下策略执行：

1. 优先调用 `instagram.search.open_first_reel`。
2. 如果返回失败，但截图仍显示搜索结果页和 Reel 缩略图，可重试 XML 组件节点执行。
3. XML 节点执行只做有限次重试，建议最多 2 次。
4. XML 重试仍失败后，允许使用截图识别推测坐标执行 1 次。
5. 坐标兜底后必须重新采集 `instagram.reel.inspect` 或 `instagram.reel.collect_signals` 确认是否进入 Reel。
6. 如果仍无法确认进入 Reel 播放页，返回降级结果，不继续点赞、评论或滑动。

## 评论输入策略

`instagram.reel.comment` 的文本输入规则：

1. 优先使用外部 ADB Keyboard 输入法提交文本。
2. 默认输入法组件为 `com.android.adbkeyboard/.AdbIME`。
3. 默认广播 action 为 `ADB_INPUT_B64`，connector 会发送 UTF-8 base64 文本，避免 shell Unicode 转义问题。
4. ADB Keyboard 未安装或不可切换时，只允许可打印 ASCII 评论使用 `adb input text` 兜底。
5. 中文、Emoji、换行、全角标点或其他非 ASCII 文本，在 ADB Keyboard 不可用时必须返回降级结果。
6. 返回 `UI_INPUT_UNICODE_UNSUPPORTED` 时，agent 服务必须停止本次评论动作，不得继续点击 Post。

ASCII 兜底只面向 `U+0020` 到 `U+007E` 的可打印字符。

使用中文或 Emoji 评论前，应先在模拟器中安装并启用 ADB Keyboard。connector 会在输入时临时切换到 ADB Keyboard，输入完成后尽量恢复原输入法。

输入中文时命令行回传会出现乱码现象，这是正常情况，可以直接忽略。

## 结果标准

CLI 输出外层为：

```json
{
  "ok": true,
  "result": {
    "status": "SUCCESS",
    "code": "OK",
    "output": {}
  }
}
```

connector 结果会归一化为以下状态：

| 状态 | 含义 | agent 服务后续动作 |
| --- | --- | --- |
| `SUCCESS` | 动作完成，且状态已确认 | 可以进入下一步 |
| `FAILED` | 动作失败，且不建议继续当前动作 | 停止当前动作并记录失败 |
| `DEGRADED` | XML 失败或状态不可信，已进入兜底或需要人工确认 | 不执行点赞/评论等副作用动作 |
| `CANCELLED` | 动作被取消 | 停止当前动作并记录取消 |

## 副作用约束

以下动作会修改 Instagram 账号或页面状态，agent 服务调用前必须取得明确确认：

```text
instagram.reel.like
instagram.reel.comment
```

调用前必须确认当前页面状态可信，且当前 Reel 未处于 XML/截图冲突状态。点赞前应确认当前 Reel 尚未点赞，避免误取消点赞。
