package com.aiwos.runtime.local;

import java.io.File;
import java.util.Objects;

public final class LocalMobileRuntimeConfig {
    private final String adbPath;
    private final String serial;
    private final String targetPackage;
    private final long commandTimeoutMs;
    private final long waitTimeoutMs;
    private final File artifactDir;
    private final String adbKeyboardIme;
    private final String adbKeyboardInputAction;

    /**
     * 输入：ADB 路径、模拟器 serial、目标包名、命令超时、等待超时和产物目录。
     * 输出：本地 Runtime 配置对象。
     * 作用：集中保存本地 ADB Runtime 的外部边界配置。
     */
    public LocalMobileRuntimeConfig(
            String adbPath,
            String serial,
            String targetPackage,
            long commandTimeoutMs,
            long waitTimeoutMs,
            File artifactDir,
            String adbKeyboardIme,
            String adbKeyboardInputAction) {
        this.adbPath = Objects.requireNonNull(adbPath, "adbPath");
        this.serial = Objects.requireNonNull(serial, "serial");
        this.targetPackage = Objects.requireNonNull(targetPackage, "targetPackage");
        this.commandTimeoutMs = commandTimeoutMs;
        this.waitTimeoutMs = waitTimeoutMs;
        this.artifactDir = Objects.requireNonNull(artifactDir, "artifactDir");
        this.adbKeyboardIme = Objects.requireNonNull(adbKeyboardIme, "adbKeyboardIme");
        this.adbKeyboardInputAction = Objects.requireNonNull(adbKeyboardInputAction, "adbKeyboardInputAction");
    }

    /**
     * 输入：无。
     * 输出：ADB 可执行文件路径。
     * 作用：提供 ADB 命令执行入口。
     */
    public String adbPath() {
        return adbPath;
    }

    /**
     * 输入：无。
     * 输出：目标模拟器 serial。
     * 作用：让 ADB 命令固定作用于指定设备。
     */
    public String serial() {
        return serial;
    }

    /**
     * 输入：无。
     * 输出：目标 App 包名。
     * 作用：限制本地 Runtime 的默认操作对象。
     */
    public String targetPackage() {
        return targetPackage;
    }

    /**
     * 输入：无。
     * 输出：单条 ADB 命令超时时间。
     * 作用：避免外部进程无界等待。
     */
    public long commandTimeoutMs() {
        return commandTimeoutMs;
    }

    /**
     * 输入：无。
     * 输出：默认等待控件超时时间。
     * 作用：提供 waitFor 的默认边界。
     */
    public long waitTimeoutMs() {
        return waitTimeoutMs;
    }

    /**
     * 输入：无。
     * 输出：测试产物目录。
     * 作用：保存截图和 UI XML 文件。
     */
    public File artifactDir() {
        return artifactDir;
    }

    /**
     * 输入：无。
     * 输出：ADB Keyboard 输入法组件名。
     * 作用：让 Runtime 可切换到外部 ADB Keyboard 输入法。
     */
    public String adbKeyboardIme() {
        return adbKeyboardIme;
    }

    /**
     * 输入：无。
     * 输出：ADB Keyboard base64 输入广播 action。
     * 作用：让 Runtime 通过外部输入法提交 Unicode 文本。
     */
    public String adbKeyboardInputAction() {
        return adbKeyboardInputAction;
    }
}
