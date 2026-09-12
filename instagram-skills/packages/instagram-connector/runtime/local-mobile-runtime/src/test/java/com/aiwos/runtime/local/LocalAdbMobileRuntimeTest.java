package com.aiwos.runtime.local;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import com.aiwos.connector.sdk.v1.CapabilityResult;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import org.json.JSONObject;
import org.junit.Test;

public final class LocalAdbMobileRuntimeTest {
    /**
     * 输入：media.prepare 本地图片路径。
     * 输出：成功结果和 adb push/media scan 命令。
     * 作用：确认本地图片会进入模拟器相册目录。
     */
    @Test
    public void checkpointMediaPreparePushesLocalImageAndScans() throws Exception {
        Path dir = Files.createTempDirectory("aiwos-local-runtime-test");
        Path log = dir.resolve("adb.log");
        Path adb = fakeAdb(dir, log);
        Path image = dir.resolve("avatar.jpg");
        Files.write(image, new byte[] {1, 2, 3});

        LocalAdbMobileRuntime runtime = new LocalAdbMobileRuntime(config(adb, dir));
        CapabilityResult result = runtime.checkpoint(new JSONObject()
                .put("type", "media.prepare")
                .put("mediaType", "image")
                .put("localPath", image.toString())
                .toString());
        JSONObject output = new JSONObject(result.payloadJson());
        String logText = new String(Files.readAllBytes(log), StandardCharsets.UTF_8);

        assertTrue(result.detail(), result.isOk());
        assertEquals("localPath", output.getString("sourceType"));
        assertTrue(output.getString("remotePath").startsWith("/sdcard/Pictures/aiwos/"));
        assertTrue(logText.contains("shell mkdir -p /sdcard/Pictures/aiwos"));
        assertTrue(logText.contains("push " + image));
        assertTrue(logText.contains("shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/aiwos/"));
    }

    /**
     * 输入：media.prepare 同时提供 url 和 localPath。
     * 输出：失败结果。
     * 作用：确认媒体来源边界只允许二选一。
     */
    @Test
    public void checkpointMediaPrepareRejectsMultipleSources() throws Exception {
        Path dir = Files.createTempDirectory("aiwos-local-runtime-test");
        Path adb = fakeAdb(dir, dir.resolve("adb.log"));
        LocalAdbMobileRuntime runtime = new LocalAdbMobileRuntime(config(adb, dir));

        CapabilityResult result = runtime.checkpoint(new JSONObject()
                .put("type", "media.prepare")
                .put("mediaType", "image")
                .put("url", "https://example.com/avatar.jpg")
                .put("localPath", dir.resolve("avatar.jpg").toString())
                .toString());

        assertFalse(result.isOk());
        assertEquals("MEDIA_PREPARE_SOURCE_INVALID", result.code());
    }

    /**
     * 输入：replace=true 的 input 请求。
     * 输出：先全选删除再输入文本。
     * 作用：确认资料字段更新不会追加到旧文本后面。
     */
    @Test
    public void inputReplaceSelectsAllDeletesAndTypes() throws Exception {
        Path dir = Files.createTempDirectory("aiwos-local-runtime-test");
        Path log = dir.resolve("adb.log");
        Path adb = fakeAdb(dir, log);
        LocalAdbMobileRuntime runtime = new LocalAdbMobileRuntime(config(adb, dir));

        CapabilityResult result = runtime.input(new JSONObject()
                .put("targetPath", "node-0")
                .put("text", "New Name")
                .put("replace", true)
                .toString());
        JSONObject output = new JSONObject(result.payloadJson());
        String logText = new String(Files.readAllBytes(log), StandardCharsets.UTF_8);

        assertTrue(result.detail(), result.isOk());
        assertTrue(output.getBoolean("replace"));
        assertTrue(logText.contains("shell input tap 60 50"));
        assertTrue(logText.contains("shell input keycombination KEYCODE_CTRL_LEFT KEYCODE_A"));
        assertTrue(logText.contains("shell input keyevent KEYCODE_DEL"));
        assertTrue(logText.contains("shell input text New%sName"));
    }

    /**
     * 输入：第二个 selector 才命中的批量 query。
     * 输出：按 selector 优先级返回候选，且只执行一次 UI dump。
     * 作用：防止同一轮候选校验重复采集昂贵的 UI XML。
     */
    @Test
    public void queryBatchesSelectorsIntoSingleSnapshot() throws Exception {
        Path dir = Files.createTempDirectory("aiwos-local-runtime-test");
        Path log = dir.resolve("adb.log");
        Path adb = fakeAdb(dir, log);
        LocalAdbMobileRuntime runtime = new LocalAdbMobileRuntime(config(adb, dir));

        CapabilityResult result = runtime.query(new JSONObject()
                .put("selectors", List.of(
                        new JSONObject().put("resourceId", "missing"),
                        new JSONObject().put("resourceId", "com.instagram.android:id/profile_field")))
                .toString());
        JSONObject output = new JSONObject(result.payloadJson());
        List<String> commands = Files.readAllLines(log, StandardCharsets.UTF_8);

        assertTrue(runtime.supportsBatchQuery());
        assertTrue(result.detail(), result.isOk());
        assertEquals(1, output.getJSONArray("candidates").length());
        assertEquals(1, commands.stream().filter(line -> line.contains("uiautomator dump")).count());
        assertEquals(1, commands.stream().filter(line -> line.startsWith("pull ")).count());
    }

    /**
     * 输入：adb 路径和 artifact 目录。
     * 输出：Runtime 配置。
     * 作用：为本地 Runtime 黑盒测试提供固定配置。
     */
    private LocalMobileRuntimeConfig config(Path adb, Path artifactDir) {
        return new LocalMobileRuntimeConfig(
                adb.toString(),
                "",
                "com.instagram.android",
                5000L,
                1000L,
                artifactDir.toFile(),
                "com.android.adbkeyboard/.AdbIME",
                "ADB_INPUT_B64");
    }

    /**
     * 输入：临时目录和日志路径。
     * 输出：假的 adb 可执行文件。
     * 作用：记录 Runtime 发出的 adb 命令并为 UI dump 返回稳定 XML。
     */
    private Path fakeAdb(Path dir, Path log) throws Exception {
        boolean windows = System.getProperty("os.name").toLowerCase(Locale.ROOT).contains("win");
        Path adb = dir.resolve(windows ? "fake-adb.cmd" : "fake-adb.sh");
        String script = windows ? fakeAdbCmd(log) : fakeAdbSh(log);
        Files.write(adb, script.getBytes(StandardCharsets.UTF_8));
        adb.toFile().setExecutable(true);
        return adb;
    }

    /**
     * 输入：日志路径。
     * 输出：Windows fake adb 脚本。
     * 作用：支持本地 Windows 测试环境。
     */
    private String fakeAdbCmd(Path log) {
        return """
                @echo off
                echo %%*>>"%s"
                if "%%1"=="pull" (
                  >"%%3" echo ^<?xml version="1.0" encoding="UTF-8"?^>
                  >>"%%3" echo ^<hierarchy rotation="0"^>
                  >>"%%3" echo ^<node index="0" text="" resource-id="com.instagram.android:id/profile_field" class="android.widget.EditText" package="com.instagram.android" content-desc="" clickable="true" enabled="true" bounds="[10,20][110,80]" /^>
                  >>"%%3" echo ^</hierarchy^>
                )
                exit /b 0
                """.formatted(log);
    }

    /**
     * 输入：日志路径。
     * 输出：Unix fake adb 脚本。
     * 作用：支持非 Windows 测试环境。
     */
    private String fakeAdbSh(Path log) {
        return """
                #!/bin/sh
                echo "$@" >> "%s"
                if [ "$1" = "pull" ]; then
                  cat > "$3" <<'XML'
                <?xml version="1.0" encoding="UTF-8"?>
                <hierarchy rotation="0">
                <node index="0" text="" resource-id="com.instagram.android:id/profile_field" class="android.widget.EditText" package="com.instagram.android" content-desc="" clickable="true" enabled="true" bounds="[10,20][110,80]" />
                </hierarchy>
                XML
                fi
                exit 0
                """.formatted(log);
    }
}
