package com.aiwos.runtime.local;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

public final class UiSnapshot {
    private final String packageName;
    private final String pageFingerprint;
    private final List<String> visibleText;
    private final List<UiNode> nodes;
    private final Map<String, UiNode> nodesByPath;

    /**
     * 输入：包名、页面指纹、可见文本和节点列表。
     * 输出：页面快照对象。
     * 作用：保存一次 UIAutomator dump 的结构化结果。
     */
    public UiSnapshot(String packageName, String pageFingerprint, List<String> visibleText, List<UiNode> nodes) {
        this.packageName = packageName;
        this.pageFingerprint = pageFingerprint;
        this.visibleText = List.copyOf(visibleText);
        this.nodes = List.copyOf(nodes);
        this.nodesByPath = indexByPath(nodes);
    }

    /**
     * 输入：无。
     * 输出：当前页面包名。
     * 作用：让 connector 判断 Instagram 是否在前台。
     */
    public String packageName() {
        return packageName;
    }

    /**
     * 输入：无。
     * 输出：页面指纹。
     * 作用：绑定查询结果和后续动作，避免点击旧节点。
     */
    public String pageFingerprint() {
        return pageFingerprint;
    }

    /**
     * 输入：节点路径。
     * 输出：节点对象或 null。
     * 作用：根据 targetPath 找到动作目标。
     */
    public UiNode nodeByPath(String path) {
        return nodesByPath.get(path);
    }

    /**
     * 输入：无。
     * 输出：节点列表。
     * 作用：支持 query 遍历候选控件。
     */
    public List<UiNode> nodes() {
        return nodes;
    }

    /**
     * 输入：无。
     * 输出：snapshot JSON。
     * 作用：实现 MobileRuntime.snapshot 的返回体。
     */
    public JSONObject toJson() throws Exception {
        JSONArray text = new JSONArray();
        for (String value : visibleText) text.put(value);

        JSONArray nodeArray = new JSONArray();
        for (UiNode node : nodes) nodeArray.put(node.toJson());

        return new JSONObject()
                .put("packageName", packageName)
                .put("pageFingerprint", pageFingerprint)
                .put("visibleText", text)
                .put("nodes", nodeArray);
    }

    /**
     * 输入：节点列表。
     * 输出：按 path 索引的节点表。
     * 作用：加速 click/input/submit 的目标查找。
     */
    private Map<String, UiNode> indexByPath(List<UiNode> nodes) {
        Map<String, UiNode> index = new LinkedHashMap<>();
        for (UiNode node : nodes) index.put(node.path(), node);
        return index;
    }
}
