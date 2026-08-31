package com.aiwos.runtime.local;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;

public final class AdbCommand {
    private final LocalMobileRuntimeConfig config;

    /**
     * 输入：本地 Runtime 配置。
     * 输出：ADB 命令执行器。
     * 作用：绑定 ADB 路径、设备 serial 和命令超时。
     */
    public AdbCommand(LocalMobileRuntimeConfig config) {
        this.config = config;
    }

    /**
     * 输入：ADB shell 参数。
     * 输出：命令执行结果。
     * 作用：执行目标设备上的 shell 命令。
     */
    public Result shell(String... args) throws IOException, InterruptedException {
        List<String> command = baseCommand();
        command.add("shell");
        command.addAll(Arrays.asList(args));
        return run(command, config.commandTimeoutMs());
    }

    /**
     * 输入：超时时间和 ADB shell 参数。
     * 输出：命令执行结果。
     * 作用：让 snapshot 这类 deadline-aware 调用能缩短单条 ADB 等待。
     */
    public Result shellWithTimeout(long timeoutMs, String... args) throws IOException, InterruptedException {
        List<String> command = baseCommand();
        command.add("shell");
        command.addAll(Arrays.asList(args));
        return run(command, timeoutMs);
    }

    /**
     * 输入：ADB 参数。
     * 输出：命令执行结果。
     * 作用：执行非 shell 类 ADB 命令，例如 pull。
     */
    public Result adb(String... args) throws IOException, InterruptedException {
        List<String> command = baseCommand();
        command.addAll(Arrays.asList(args));
        return run(command, config.commandTimeoutMs());
    }

    /**
     * 输入：设备远端路径和本地文件路径。
     * 输出：命令执行结果。
     * 作用：把模拟器文件拉取到本地测试产物目录。
     */
    public Result pull(String remotePath, File localFile) throws IOException, InterruptedException {
        return adb("pull", remotePath, localFile.getAbsolutePath());
    }

    /**
     * 输入：本地文件和设备远端路径。
     * 输出：命令执行结果。
     * 作用：把 host 文件推送到模拟器指定位置。
     */
    public Result push(File localFile, String remotePath) throws IOException, InterruptedException {
        return adb("push", localFile.getAbsolutePath(), remotePath);
    }

    /**
     * 输入：设备远端路径、本地文件路径和超时时间。
     * 输出：命令执行结果。
     * 作用：让 snapshot 的 XML 拉取遵守 Host deadline。
     */
    public Result pullWithTimeout(String remotePath, File localFile, long timeoutMs)
            throws IOException, InterruptedException {
        List<String> command = baseCommand();
        command.add("pull");
        command.add(remotePath);
        command.add(localFile.getAbsolutePath());
        return run(command, timeoutMs);
    }

    /**
     * 输入：完整命令参数。
     * 输出：进程退出码、标准输出和标准错误。
     * 作用：统一执行外部 ADB 进程并暴露失败原因。
     */
    private Result run(List<String> command, long timeoutMs) throws IOException, InterruptedException {
        Process process = new ProcessBuilder(command).start();
        boolean finished = process.waitFor(timeoutMs, TimeUnit.MILLISECONDS);
        if (!finished) {
            // ADB 是外部进程，超时后直接终止，避免测试进程卡死。
            process.destroyForcibly();
            throw new IOException("ADB command timeout: " + String.join(" ", command));
        }
        String stdout = read(process.getInputStream());
        String stderr = read(process.getErrorStream());
        return new Result(process.exitValue(), stdout, stderr);
    }

    /**
     * 输入：进程输出流。
     * 输出：UTF-8 字符串。
     * 作用：读取 ADB stdout/stderr，供调用方判断错误。
     */
    private String read(InputStream input) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] chunk = new byte[4096];
        int count;
        while ((count = input.read(chunk)) != -1) {
            buffer.write(chunk, 0, count);
        }
        return buffer.toString(StandardCharsets.UTF_8);
    }

    /**
     * 输入：无。
     * 输出：包含 adbPath 和 serial 的基础命令。
     * 作用：确保所有 ADB 命令都指向同一台模拟器。
     */
    private List<String> baseCommand() {
        List<String> command = new ArrayList<>();
        command.add(config.adbPath());
        if (!config.serial().isBlank()) {
            command.add("-s");
            command.add(config.serial());
        }
        return command;
    }

    public static final class Result {
        private final int exitCode;
        private final String stdout;
        private final String stderr;

        /**
         * 输入：退出码、标准输出和标准错误。
         * 输出：命令结果对象。
         * 作用：保存一次 ADB 调用的完整结果。
         */
        public Result(int exitCode, String stdout, String stderr) {
            this.exitCode = exitCode;
            this.stdout = stdout;
            this.stderr = stderr;
        }

        /**
         * 输入：无。
         * 输出：进程退出码。
         * 作用：判断 ADB 命令是否执行成功。
         */
        public int exitCode() {
            return exitCode;
        }

        /**
         * 输入：无。
         * 输出：标准输出。
         * 作用：读取 ADB 成功输出。
         */
        public String stdout() {
            return stdout;
        }

        /**
         * 输入：无。
         * 输出：标准错误。
         * 作用：读取 ADB 失败诊断信息。
         */
        public String stderr() {
            return stderr;
        }

        /**
         * 输入：无。
         * 输出：成功布尔值。
         * 作用：封装退出码判断。
         */
        public boolean isOk() {
            return exitCode == 0;
        }
    }
}
