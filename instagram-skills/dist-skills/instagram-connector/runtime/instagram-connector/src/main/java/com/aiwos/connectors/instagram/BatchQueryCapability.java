package com.aiwos.connectors.instagram;

import java.lang.reflect.Method;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Map;

final class BatchQueryCapability {
    private static final Map<Object, Boolean> SUPPORT_BY_RUNTIME =
            Collections.synchronizedMap(new IdentityHashMap<>());

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
        Boolean cached = SUPPORT_BY_RUNTIME.get(runtime);
        if (cached != null) return cached;
        boolean supported = readSupport(runtime);
        SUPPORT_BY_RUNTIME.put(runtime, supported);
        return supported;
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
}
