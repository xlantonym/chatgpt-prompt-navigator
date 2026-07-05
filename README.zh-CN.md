# ChatGPT 我的发文导航器

这是一个单文件 Tampermonkey userscript，用于在 ChatGPT 页面中生成“我的发文”浮窗导航器。

当前 MVP 版本：`0.4.2`

## 当前功能

- user message 导航
- 搜索
- 月 / 周 / 日时间视图
- 书签
- 标签
- Debug 面板
- 设置面板
- Help 面板
- 折叠 / 展开
- 浮窗拖拽
- 四边 resize
- media hydration rescan，用于处理延迟加载的图片 / 附件
- 中文 / 英文 UI
- 深浅色插件主题

## 项目结构

```text
chatgpt-prompt-navigator/
  src/
    chatgpt-prompt-navigator.user.js
  dist/
    chatgpt-prompt-navigator.user.js
  assets/
    screenshots/
  docs/
    FINAL_AUDIT.md
    DEVELOPMENT_REVIEW.md
  README.md
  README.zh-CN.md
  CHANGELOG.md
  LICENSE
  .gitignore
```

## 安装方式

1. 在浏览器中安装 Tampermonkey。
2. 打开 `dist/chatgpt-prompt-navigator.user.js`。
3. 将完整脚本复制到 Tampermonkey 新脚本中。
4. 保存后打开 `https://chatgpt.com/`。

当前没有构建流程。`src/` 和 `dist/` 中的 userscript 暂时保持完全一致。

## 开发约束

- 默认只修改 `src/chatgpt-prompt-navigator.user.js`。
- 发布时再同步复制到 `dist/chatgpt-prompt-navigator.user.js`。
- 在没有明确需求前，不引入 webpack / Vite / npm build。
- 不调用 ChatGPT 后端接口。
- 不拦截 `fetch` / XHR。
- 不读取 cookie / token。

## 审计文档

见 `docs/FINAL_AUDIT.md`。

