package com.aiwos.runtime.local;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

public final class UiXmlParser {
    /**
     * 输入：UIAutomator XML 字符串。
     * 输出：结构化页面快照。
     * 作用：把 Android 无障碍树转换为 Runtime 可查询的数据结构。
     */
    public UiSnapshot parse(String xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        Document document = factory.newDocumentBuilder()
                .parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
        List<UiNode> nodes = new ArrayList<>();
        List<String> visibleText = new ArrayList<>();
        collect(document.getDocumentElement(), nodes, visibleText);
        return new UiSnapshot(packageName(nodes), fingerprint(xml), visibleText, nodes);
    }

    /**
     * 输入：DOM 节点、结果节点列表和可见文本列表。
     * 输出：无。
     * 作用：深度遍历 XML，把每个 node 元素转成 UiNode。
     */
    private void collect(Node domNode, List<UiNode> nodes, List<String> visibleText) {
        if (domNode instanceof Element element && "node".equals(element.getTagName())) {
            UiNode node = toNode(element, "node-" + nodes.size());
            nodes.add(node);
            if (!node.text().isBlank()) visibleText.add(node.text());
        }

        NodeList children = domNode.getChildNodes();
        for (int index = 0; index < children.getLength(); index++) {
            collect(children.item(index), nodes, visibleText);
        }
    }

    /**
     * 输入：XML node 元素和生成路径。
     * 输出：UiNode。
     * 作用：映射 UIAutomator 属性名到本地 Runtime 节点字段。
     */
    private UiNode toNode(Element element, String path) {
        return new UiNode(
                path,
                attr(element, "package"),
                attr(element, "resource-id"),
                attr(element, "text"),
                attr(element, "content-desc"),
                attr(element, "class"),
                Boolean.parseBoolean(attr(element, "clickable")),
                Boolean.parseBoolean(attr(element, "enabled")),
                Boolean.parseBoolean(attr(element, "selected")),
                Boolean.parseBoolean(attr(element, "checked")),
                bounds(attr(element, "bounds")));
    }

    /**
     * 输入：XML 元素和属性名。
     * 输出：属性值。
     * 作用：统一读取 UIAutomator XML 属性。
     */
    private String attr(Element element, String name) {
        return element.hasAttribute(name) ? element.getAttribute(name) : "";
    }

    /**
     * 输入：UIAutomator bounds 字符串。
     * 输出：bounds 对象。
     * 作用：解析 `[left,top][right,bottom]` 为可点击坐标。
     */
    private UiNode.Bounds bounds(String value) {
        String normalized = value.replace("[", "").replace("]", ",");
        String[] parts = normalized.split(",");
        return new UiNode.Bounds(
                Integer.parseInt(parts[0]),
                Integer.parseInt(parts[1]),
                Integer.parseInt(parts[2]),
                Integer.parseInt(parts[3]));
    }

    /**
     * 输入：节点列表。
     * 输出：第一个非空包名。
     * 作用：作为当前活动 App 的近似判断。
     */
    private String packageName(List<UiNode> nodes) {
        for (UiNode node : nodes) {
            if (!node.packageName().isBlank()) return node.packageName();
        }
        return "";
    }

    /**
     * 输入：XML 字符串。
     * 输出：sha256 页面指纹。
     * 作用：绑定页面快照和后续动作请求。
     */
    private String fingerprint(String xml) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] bytes = digest.digest(xml.getBytes(StandardCharsets.UTF_8));
        StringBuilder value = new StringBuilder("sha256:");
        for (byte item : bytes) value.append(String.format("%02x", item));
        return value.toString();
    }
}
