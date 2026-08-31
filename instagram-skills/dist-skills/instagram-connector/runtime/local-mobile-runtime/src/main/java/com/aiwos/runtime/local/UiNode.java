package com.aiwos.runtime.local;

import org.json.JSONObject;

public final class UiNode {
    private final String path;
    private final String packageName;
    private final String resourceId;
    private final String text;
    private final String contentDescription;
    private final String className;
    private final boolean clickable;
    private final boolean enabled;
    private final boolean selected;
    private final boolean checked;
    private final Bounds bounds;

    /**
     * 输入：UIAutomator XML 中的节点属性。
     * 输出：统一 UI 节点对象。
     * 作用：保存 Runtime query 和 token 动作所需的最小节点信息。
     */
    public UiNode(
            String path,
            String packageName,
            String resourceId,
            String text,
            String contentDescription,
            String className,
            boolean clickable,
            boolean enabled,
            boolean selected,
            boolean checked,
            Bounds bounds) {
        this.path = path;
        this.packageName = packageName;
        this.resourceId = resourceId;
        this.text = text;
        this.contentDescription = contentDescription;
        this.className = className;
        this.clickable = clickable;
        this.enabled = enabled;
        this.selected = selected;
        this.checked = checked;
        this.bounds = bounds;
    }

    /**
     * 输入：无。
     * 输出：当前页面内的短期节点路径。
     * 作用：作为 click/input/submit 的目标 token。
     */
    public String path() {
        return path;
    }

    /**
     * 输入：无。
     * 输出：节点所属 App 包名。
     * 作用：辅助 snapshot 判断当前活动页面。
     */
    public String packageName() {
        return packageName;
    }

    /**
     * 输入：无。
     * 输出：resource-id。
     * 作用：支持稳定 selector 查询。
     */
    public String resourceId() {
        return resourceId;
    }

    /**
     * 输入：无。
     * 输出：节点文本。
     * 作用：支持 text selector 和 visibleText 提取。
     */
    public String text() {
        return text;
    }

    /**
     * 输入：无。
     * 输出：content-desc。
     * 作用：支持无文本图标按钮定位。
     */
    public String contentDescription() {
        return contentDescription;
    }

    /**
     * 输入：无。
     * 输出：节点 class 名。
     * 作用：支持输入框等控件类型判断。
     */
    public String className() {
        return className;
    }

    /**
     * 输入：无。
     * 输出：是否可点击。
     * 作用：支持 connector 对可点击目标的过滤。
     */
    public boolean clickable() {
        return clickable;
    }

    /**
     * 输入：无。
     * 输出：是否启用。
     * 作用：支持 query 过滤不可用控件。
     */
    public boolean enabled() {
        return enabled;
    }

    /**
     * 输入：无。
     * 输出：是否处于 selected 状态。
     * 作用：辅助 connector 判断 toggle 类控件是否已经启用。
     */
    public boolean selected() {
        return selected;
    }

    /**
     * 输入：无。
     * 输出：是否处于 checked 状态。
     * 作用：辅助 connector 判断 Like 等 toggle 类控件是否已经启用。
     */
    public boolean checked() {
        return checked;
    }

    /**
     * 输入：无。
     * 输出：节点屏幕 bounds。
     * 作用：把 targetPath 转换成 ADB tap 坐标。
     */
    public Bounds bounds() {
        return bounds;
    }

    /**
     * 输入：页面指纹。
     * 输出：query candidate JSON。
     * 作用：返回 connector 动作绑定所需的节点摘要。
     */
    public JSONObject toCandidateJson(String pageFingerprint) throws Exception {
        return toJson().put("pageFingerprint", pageFingerprint).put("targetPath", path);
    }

    /**
     * 输入：无。
     * 输出：节点完整 JSON。
     * 作用：用于 snapshot 输出和调试日志。
     */
    public JSONObject toJson() throws Exception {
        return new JSONObject()
                .put("path", path)
                .put("targetPath", path)
                .put("packageName", packageName)
                .put("resourceId", resourceId)
                .put("text", text)
                .put("contentDescription", contentDescription)
                .put("className", className)
                .put("clickable", clickable)
                .put("enabled", enabled)
                .put("selected", selected)
                .put("checked", checked)
                .put("bounds", bounds.toJson());
    }

    public static final class Bounds {
        private final int left;
        private final int top;
        private final int right;
        private final int bottom;

        /**
         * 输入：矩形四边坐标。
         * 输出：bounds 对象。
         * 作用：保存控件在屏幕上的位置。
         */
        public Bounds(int left, int top, int right, int bottom) {
            this.left = left;
            this.top = top;
            this.right = right;
            this.bottom = bottom;
        }

        /**
         * 输入：无。
         * 输出：中心点 X 坐标。
         * 作用：为 ADB tap 提供点击横坐标。
         */
        public int centerX() {
            return (left + right) / 2;
        }

        /**
         * 输入：无。
         * 输出：中心点 Y 坐标。
         * 作用：为 ADB tap 提供点击纵坐标。
         */
        public int centerY() {
            return (top + bottom) / 2;
        }

        /**
         * 输入：无。
         * 输出：bounds JSON。
         * 作用：让 connector 和日志看到控件位置。
         */
        public JSONObject toJson() throws Exception {
            return new JSONObject()
                    .put("left", left)
                    .put("top", top)
                    .put("right", right)
                    .put("bottom", bottom);
        }
    }
}
