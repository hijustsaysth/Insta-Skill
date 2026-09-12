package com.aiwos.connectors.instagram;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public final class BatchQueryCapabilityTest {
    /**
     * 输入：显式返回 true 的能力对象。
     * 输出：支持批量 query。
     * 作用：确认适配器只接受 Boolean.TRUE。
     */
    @Test
    public void returnsTrueForExplicitBooleanTrue() {
        assertTrue(BatchQueryCapability.supports(new ExplicitTrue()));
    }

    /**
     * 输入：没有能力方法的旧对象。
     * 输出：不支持批量 query。
     * 作用：确认旧 API-v1 对象不会触发直接链接或异常。
     */
    @Test
    public void returnsFalseWhenMethodIsMissing() {
        assertFalse(BatchQueryCapability.supports(new Object()));
    }

    /**
     * 输入：返回非 Boolean 的同名方法。
     * 输出：不支持批量 query。
     * 作用：拒绝不符合显式能力协议的返回值。
     */
    @Test
    public void returnsFalseForNonBooleanResult() {
        assertFalse(BatchQueryCapability.supports(new NonBooleanSupport()));
    }

    /**
     * 输入：调用时抛错的能力方法。
     * 输出：不支持批量 query，且同一实例只探测一次。
     * 作用：确认异常安全回退并缓存判定结果。
     */
    @Test
    public void returnsFalseAndCachesWhenMethodThrows() {
        ThrowingSupport runtime = new ThrowingSupport();

        assertFalse(BatchQueryCapability.supports(runtime));
        assertFalse(BatchQueryCapability.supports(runtime));
        assertTrue(runtime.calls == 1);
    }

    private static final class ExplicitTrue {
        /**
         * 输入：无。
         * 输出：true。
         * 作用：模拟显式支持批量 query 的 Runtime。
         */
        public boolean supportsBatchQuery() {
            return true;
        }
    }

    private static final class NonBooleanSupport {
        /**
         * 输入：无。
         * 输出：非 Boolean 值。
         * 作用：模拟不符合能力协议的同名方法。
         */
        public String supportsBatchQuery() {
            return "true";
        }
    }

    private static final class ThrowingSupport {
        private int calls;

        /**
         * 输入：无。
         * 输出：不返回。
         * 作用：模拟能力读取时抛出的 Runtime 异常。
         */
        public boolean supportsBatchQuery() {
            calls++;
            throw new IllegalStateException("capability unavailable");
        }
    }
}
