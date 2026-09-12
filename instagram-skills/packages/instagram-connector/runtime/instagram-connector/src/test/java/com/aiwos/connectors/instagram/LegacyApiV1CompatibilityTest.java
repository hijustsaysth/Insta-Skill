package com.aiwos.connectors.instagram;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import com.aiwos.connector.sdk.v1.CapabilityResult;
import com.aiwos.connector.sdk.v1.ConnectorExecutionRequest;
import com.aiwos.connector.sdk.v1.ConnectorResult;
import java.io.InputStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import javax.tools.JavaCompiler;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

public final class LegacyApiV1CompatibilityTest {
    private static final String MOBILE_RUNTIME = "com.aiwos.connector.sdk.v1.MobileRuntime";
    private static final String SDK_PACKAGE = "com.aiwos.connector.sdk.v1.";
    private static final String CONNECTOR_PACKAGE = "com.aiwos.connectors.instagram.";

    /**
     * 输入：db11289 版本的旧 MobileRuntime 接口源码和当前 connector class。
     * 输出：search.open 成功并始终使用旧单 selector 协议。
     * 作用：真实验证旧 API-v1 宿主不会因新增默认方法发生链接错误。
     */
    @Test
    public void connectorRunsAgainstIsolatedLegacyApiV1() throws Exception {
        Path legacyClasses = compileLegacyMobileRuntime();
        LegacyRuntimeHandler runtimeHandler = new LegacyRuntimeHandler();
        Throwable executionFailure = null;
        String previousLogging = System.getProperty("instagram.connector.consoleLog");
        System.setProperty("instagram.connector.consoleLog", "true");
        try {
            LegacyApiClassLoader loader = new LegacyApiClassLoader(
                    InstagramConnector.class.getClassLoader(),
                    legacyClasses);
            Class<?> mobileRuntimeType = loader.loadClass(MOBILE_RUNTIME);
            Object runtime = Proxy.newProxyInstance(
                    loader,
                    new Class<?>[] {mobileRuntimeType},
                    runtimeHandler);
            Class<?> connectorType = loader.loadClass(CONNECTOR_PACKAGE + "InstagramConnector");
            Object connector = connectorType.getConstructor().newInstance();
            Method execute = connectorType.getMethod(
                    "execute",
                    mobileRuntimeType,
                    ConnectorExecutionRequest.class);

            ConnectorResult result = (ConnectorResult) execute.invoke(
                    connector,
                    runtime,
                    new ConnectorExecutionRequest(
                            "legacy-job",
                            "instagram.search.open",
                            "{}",
                            "",
                            System.currentTimeMillis() + 30_000L));
            JSONObject output = new JSONObject(result.outputJson());

            assertEquals(ConnectorResult.Status.SUCCEEDED, result.status());
            assertEquals("instagram.search.open", output.getString("action"));
            assertEquals("/tabs/search-fallback", runtimeHandler.clickedPath);
            assertEquals(3, runtimeHandler.queryRequests.size());
            assertTrue(runtimeHandler.queryRequests.stream().allMatch(request -> request.has("selector")));
            assertTrue(runtimeHandler.queryRequests.stream().noneMatch(request -> request.has("selectors")));
            assertEquals("com.instagram.android:id/search_tab",
                    runtimeHandler.queryRequests.get(0).getJSONObject("selector").getString("resourceId"));
            assertEquals("Search and explore",
                    runtimeHandler.queryRequests.get(1).getJSONObject("selector").getString("contentDescription"));
            assertEquals("com.instagram.android:id/action_bar_search_edit_text",
                    runtimeHandler.queryRequests.get(2).getJSONObject("selector").getString("resourceId"));
        } catch (Throwable error) {
            executionFailure = error instanceof InvocationTargetException && error.getCause() != null
                    ? error.getCause()
                    : error;
        } finally {
            restoreProperty("instagram.connector.consoleLog", previousLogging);
        }
        assertNoLinkageError(executionFailure);
        if (executionFailure != null) throw new AssertionError("旧 API-v1 connector 执行失败", executionFailure);
    }

    /**
     * 输入：旧 MobileRuntime 测试资源。
     * 输出：包含旧接口 class 的临时目录。
     * 作用：用当前测试 JDK 编译不含 supportsBatchQuery 的真实 API-v1 接口。
     */
    private Path compileLegacyMobileRuntime() throws Exception {
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        assertNotNull("测试需要 JDK JavaCompiler", compiler);
        Path root = Files.createTempDirectory("instagram-legacy-api-v1");
        Path source = root.resolve("src/com/aiwos/connector/sdk/v1/MobileRuntime.java");
        Path classes = root.resolve("classes");
        Files.createDirectories(source.getParent());
        Files.createDirectories(classes);
        try (InputStream input = getClass().getClassLoader().getResourceAsStream(
                "legacy-api-v1/com/aiwos/connector/sdk/v1/MobileRuntime.java")) {
            assertNotNull("缺少旧 MobileRuntime 测试资源", input);
            Files.copy(input, source);
        }

        try (StandardJavaFileManager files = compiler.getStandardFileManager(null, null, null)) {
            String connectorSdkClasspath = Path.of(
                    CapabilityResult.class.getProtectionDomain().getCodeSource().getLocation().toURI())
                    .toString();
            Boolean succeeded = compiler.getTask(
                    null,
                    files,
                    null,
                    List.of(
                            "-classpath", connectorSdkClasspath,
                            "--release", "17",
                            "-d", classes.toString()),
                    null,
                    files.getJavaFileObjects(source.toFile()))
                    .call();
            assertTrue("旧 MobileRuntime 编译失败", Boolean.TRUE.equals(succeeded));
        }
        return classes;
    }

    /**
     * 输入：系统属性名和测试前值。
     * 输出：无。
     * 作用：避免隔离类加载测试污染其他日志测试。
     */
    private void restoreProperty(String name, String previousValue) {
        if (previousValue == null) {
            System.clearProperty(name);
        } else {
            System.setProperty(name, previousValue);
        }
    }

    /**
     * 输入：执行期间捕获的异常。
     * 输出：无。
     * 作用：显式确认异常链中不存在 NoSuchMethodError 或其他 LinkageError。
     */
    private void assertNoLinkageError(Throwable error) {
        Throwable current = error;
        while (current != null) {
            assertFalse("异常链包含 LinkageError: " + current, current instanceof LinkageError);
            current = current.getCause();
        }
    }

    private static final class LegacyApiClassLoader extends ClassLoader {
        private final Path legacyClasses;

        /**
         * 输入：共享父加载器和旧接口 class 目录。
         * 输出：隔离旧 API-v1 与当前 connector 的类加载器。
         * 作用：让 connector 的 MobileRuntime 符号解析到真实旧接口定义。
         */
        private LegacyApiClassLoader(ClassLoader parent, Path legacyClasses) {
            super(parent);
            this.legacyClasses = legacyClasses;
        }

        /**
         * 输入：类名和是否解析。
         * 输出：隔离类或父加载器共享类。
         * 作用：对子加载范围执行 child-first，保持 JSON 和结果值类型共享。
         */
        @Override
        protected Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
            synchronized (getClassLoadingLock(name)) {
                Class<?> loaded = findLoadedClass(name);
                if (loaded == null) {
                    loaded = isolated(name) ? findClass(name) : super.loadClass(name, false);
                }
                if (resolve) resolveClass(loaded);
                return loaded;
            }
        }

        /**
         * 输入：隔离类名。
         * 输出：从旧接口目录或生产 classpath 定义的类。
         * 作用：同时隔离旧 MobileRuntime、AndroidConnectorPlugin 和当前 connector 类。
         */
        @Override
        protected Class<?> findClass(String name) throws ClassNotFoundException {
            try {
                byte[] bytes;
                if (MOBILE_RUNTIME.equals(name)) {
                    bytes = Files.readAllBytes(legacyClasses.resolve(name.replace('.', '/') + ".class"));
                } else {
                    String resource = name.replace('.', '/') + ".class";
                    try (InputStream input = getParent().getResourceAsStream(resource)) {
                        if (input == null) throw new ClassNotFoundException(name);
                        bytes = input.readAllBytes();
                    }
                }
                return defineClass(name, bytes, 0, bytes.length);
            } catch (ClassNotFoundException error) {
                throw error;
            } catch (Exception error) {
                throw new ClassNotFoundException(name, error);
            }
        }

        /**
         * 输入：类名。
         * 输出：是否必须由隔离加载器定义。
         * 作用：让接口方法描述符统一引用旧 MobileRuntime，其他 SDK 值类型继续共享。
         */
        private boolean isolated(String name) {
            return MOBILE_RUNTIME.equals(name)
                    || (SDK_PACKAGE + "AndroidConnectorPlugin").equals(name)
                    || name.equals(CONNECTOR_PACKAGE + "InstagramConnector")
                    || name.startsWith(CONNECTOR_PACKAGE + "InstagramConnector$")
                    || name.equals(CONNECTOR_PACKAGE + "InstagramConnectorConsoleLogger")
                    || name.startsWith(CONNECTOR_PACKAGE + "InstagramConnectorConsoleLogger$")
                    || name.equals(CONNECTOR_PACKAGE + "BatchQueryCapability");
        }
    }

    private static final class LegacyRuntimeHandler implements java.lang.reflect.InvocationHandler {
        private final List<JSONObject> queryRequests = new ArrayList<>();
        private String clickedPath = "";

        /**
         * 输入：旧 MobileRuntime 的反射调用。
         * 输出：只接受单 selector 协议的 capability 结果。
         * 作用：模拟真实旧宿主并记录查询顺序。
         */
        @Override
        public Object invoke(Object proxy, Method method, Object[] args) {
            if (method.getDeclaringClass() == Object.class) {
                return objectMethod(proxy, method, args);
            }
            return switch (method.getName()) {
                case "isCancelled" -> false;
                case "query" -> query((String) args[0]);
                case "click" -> click((String) args[0]);
                default -> CapabilityResult.ok("{}");
            };
        }

        /**
         * 输入：旧 Runtime query 请求。
         * 输出：按搜索入口、fallback 和输入框顺序生成的候选。
         * 作用：拒绝批量载荷并强制 connector 走第二个候选 selector。
         */
        private CapabilityResult query(String requestJson) {
            JSONObject request = new JSONObject(requestJson);
            if (request.has("selectors")) throw new AssertionError("旧 Runtime 收到 selectors");
            queryRequests.add(request);
            JSONObject selector = request.getJSONObject("selector");
            JSONArray candidates = new JSONArray();
            if ("Search and explore".equals(selector.optString("contentDescription"))) {
                candidates.put(node("/tabs/search-fallback"));
            } else if ("com.instagram.android:id/action_bar_search_edit_text"
                    .equals(selector.optString("resourceId"))) {
                candidates.put(node("/search/input"));
            }
            return CapabilityResult.ok(new JSONObject()
                    .put("pageFingerprint", "legacy-instagram-page")
                    .put("candidates", candidates)
                    .toString());
        }

        /**
         * 输入：旧 Runtime click 请求。
         * 输出：点击成功结果。
         * 作用：记录 connector 最终采用的候选节点。
         */
        private CapabilityResult click(String requestJson) {
            clickedPath = new JSONObject(requestJson).getString("targetPath");
            return CapabilityResult.ok(new JSONObject().put("clicked", true).toString());
        }

        /**
         * 输入：代理对象的 Object 方法。
         * 输出：稳定的 identity 语义。
         * 作用：避免代理基础方法进入 capability 分支。
         */
        private Object objectMethod(Object proxy, Method method, Object[] args) {
            return switch (method.getName()) {
                case "equals" -> proxy == args[0];
                case "hashCode" -> System.identityHashCode(proxy);
                case "toString" -> "LegacyMobileRuntimeProxy";
                default -> throw new AssertionError(method.getName());
            };
        }

        /**
         * 输入：节点路径。
         * 输出：可供 connector 绑定点击的候选节点。
         * 作用：构造旧 Runtime query 的最小成功响应。
         */
        private JSONObject node(String path) {
            return new JSONObject()
                    .put("path", path)
                    .put("targetPath", path)
                    .put("pageFingerprint", "legacy-instagram-page");
        }
    }
}
