package com.aiwos.runtime.local;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.json.JSONObject;
import org.junit.Test;

public final class UiXmlParserTest {
    /**
     * 输入：包含 Search tab 和搜索框的 UIAutomator XML。
     * 输出：节点字段和页面快照断言。
     * 作用：确认 XML 解析结果能支撑 Runtime snapshot/query。
     */
    @Test
    public void parseBuildsSnapshotNodes() throws Exception {
        UiSnapshot snapshot = new UiXmlParser().parse(xml());

        assertEquals("com.instagram.android", snapshot.packageName());
        assertTrue(snapshot.pageFingerprint().startsWith("sha256:"));
        assertEquals(2, snapshot.nodes().size());
        assertEquals("node-0", snapshot.nodes().get(0).path());
        assertEquals("com.instagram.android:id/search_tab", snapshot.nodes().get(0).resourceId());
        assertEquals("Search and explore", snapshot.nodes().get(0).contentDescription());
        assertEquals(324, snapshot.nodes().get(0).bounds().centerX());
        assertEquals(2325, snapshot.nodes().get(0).bounds().centerY());
    }

    /**
     * 输入：解析后的页面快照。
     * 输出：JSON 字段断言。
     * 作用：确认 snapshot 输出包含 connector 需要的 path、targetPath 和 visibleText。
     */
    @Test
    public void snapshotJsonContainsRuntimeFields() throws Exception {
        JSONObject json = new UiXmlParser().parse(xml()).toJson();

        assertEquals("com.instagram.android", json.getString("packageName"));
        assertEquals("Search", json.getJSONArray("visibleText").getString(0));
        assertEquals("node-0", json.getJSONArray("nodes").getJSONObject(0).getString("path"));
        assertEquals("node-0", json.getJSONArray("nodes").getJSONObject(0).getString("targetPath"));
    }

    /**
     * 输入：无。
     * 输出：测试 XML。
     * 作用：提供稳定的 UIAutomator 样例。
     */
    private String xml() {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <hierarchy rotation="0">
                  <node index="0" text="" resource-id="com.instagram.android:id/search_tab"
                    class="android.widget.FrameLayout" package="com.instagram.android"
                    content-desc="Search and explore" clickable="true" enabled="true"
                    bounds="[216,2250][432,2400]" />
                  <node index="1" text="Search" resource-id="com.instagram.android:id/action_bar_search_edit_text"
                    class="android.widget.EditText" package="com.instagram.android"
                    content-desc="" clickable="true" enabled="true"
                    bounds="[80,120][1000,220]" />
                </hierarchy>
                """;
    }
}
