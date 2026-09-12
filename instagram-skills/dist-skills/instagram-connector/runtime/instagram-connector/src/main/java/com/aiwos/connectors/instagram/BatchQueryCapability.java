package com.aiwos.connectors.instagram;

import java.lang.reflect.Method;
import java.lang.ref.ReferenceQueue;
import java.lang.ref.WeakReference;
import java.util.concurrent.ConcurrentHashMap;

final class BatchQueryCapability {
    private static final ReferenceQueue<Object> COLLECTED_RUNTIMES = new ReferenceQueue<>();
    private static final ConcurrentHashMap<RuntimeReference, Boolean> SUPPORT_BY_RUNTIME =
            new ConcurrentHashMap<>();

    /**
     * 输入：无。
     * 输出：无实例。
     * 作用：限制能力适配器只通过静态入口使用。
     */
    private BatchQueryCapability() {}

    /**
     * 输入：任意版本的 Runtime 对象。
     * 输出：该实例是否显式返回 Boolean.TRUE 表示支持批量 query。
     * 作用：不直接链接新增接口方法，并缓存同一 Runtime 实例的能力判定。
     */
    static boolean supports(Object runtime) {
        cleanCollectedRuntimes();
        try {
            RuntimeReference lookup = new RuntimeReference(runtime);
            Boolean cached = SUPPORT_BY_RUNTIME.get(lookup);
            if (cached != null) return cached;
            boolean supported = readSupport(runtime);
            Boolean existing = SUPPORT_BY_RUNTIME.putIfAbsent(
                    new RuntimeReference(runtime, COLLECTED_RUNTIMES),
                    supported);
            return existing == null ? supported : existing;
        } finally {
            cleanCollectedRuntimes();
        }
    }

    /**
     * 输入：无。
     * 输出：清理后的缓存条目数。
     * 作用：供测试和维护入口主动移除已回收 Runtime 的弱引用 key。
     */
    static int cleanAndSize() {
        cleanCollectedRuntimes();
        return SUPPORT_BY_RUNTIME.size();
    }

    /**
     * 输入：无。
     * 输出：无。
     * 作用：从弱引用队列删除已经回收的 Runtime 缓存项。
     */
    private static void cleanCollectedRuntimes() {
        RuntimeReference collected;
        while ((collected = (RuntimeReference) COLLECTED_RUNTIMES.poll()) != null) {
            SUPPORT_BY_RUNTIME.remove(collected);
        }
    }

    /**
     * 输入：任意版本的 Runtime 对象。
     * 输出：链接安全的批量 query 能力判定。
     * 作用：旧接口缺少方法或能力方法不可安全调用时统一回退旧协议。
     */
    private static boolean readSupport(Object runtime) {
        try {
            Method method = runtime.getClass().getMethod("supportsBatchQuery");
            method.setAccessible(true);
            return Boolean.TRUE.equals(method.invoke(runtime));
        } catch (Throwable ignored) {
            // 能力扩展必须默认关闭，任何反射或链接问题都不能阻断旧 API-v1 Runtime。
            return false;
        }
    }

    private static final class RuntimeReference extends WeakReference<Object> {
        private final int identityHashCode;

        /**
         * 输入：Runtime 实例。
         * 输出：不注册回收队列的身份查询 key。
         * 作用：缓存查询期间不创建待清理条目。
         */
        private RuntimeReference(Object runtime) {
            super(runtime);
            this.identityHashCode = System.identityHashCode(runtime);
        }

        /**
         * 输入：Runtime 实例和回收队列。
         * 输出：可在 Runtime 回收后清理的身份缓存 key。
         * 作用：缓存只弱引用 Runtime，同时保留稳定 identity hash。
         */
        private RuntimeReference(Object runtime, ReferenceQueue<Object> queue) {
            super(runtime, queue);
            this.identityHashCode = System.identityHashCode(runtime);
        }

        /**
         * 输入：另一个对象。
         * 输出：两个存活 key 是否引用同一 Runtime 实例。
         * 作用：严格保持 IdentityHashMap 的对象身份语义，失效 key 不互相相等。
         */
        @Override
        public boolean equals(Object other) {
            if (this == other) return true;
            if (!(other instanceof RuntimeReference reference)) return false;
            Object runtime = get();
            return runtime != null && runtime == reference.get();
        }

        /**
         * 输入：无。
         * 输出：Runtime 创建 key 时的 identity hash。
         * 作用：让弱引用失效后仍可从 ConcurrentHashMap 的原 bucket 删除。
         */
        @Override
        public int hashCode() {
            return identityHashCode;
        }
    }
}
