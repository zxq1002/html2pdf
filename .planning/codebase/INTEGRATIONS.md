# 外部集成 (External Integrations)

**分析日期：** 2025-05-14

## API 与外部服务 (APIs & External Services)

**浏览器 API (Browser APIs)：**
- Chrome 扩展 API - 用于跨组件通信、存储和文件下载。
  - SDK/客户端：`chrome.*` 命名空间。
  - 身份验证：`manifest.json` 中的扩展权限。

## 数据存储 (Data Storage)

**数据库：**
- Chrome 本地存储 (Chrome Local Storage)
  - 连接：`chrome.storage.local`
  - 客户端：原生浏览器 API

**文件存储：**
- 本地文件系统 - 使用 `chrome.downloads` 将 PDF 文件下载到用户的本地计算机。

**缓存：**
- 无

## 身份验证与标识 (Authentication & Identity)

**身份验证提供商 (Auth Provider)：**
- 无 - 该扩展不需要用户身份验证。

## 监控与可观测性 (Monitoring & Observability)

**错误追踪：**
- 控制台日志记录 - 使用 `console.error` 进行错误展示。

**日志：**
- 在服务工作线程 (service worker)、弹出窗口 (popup) 和内容脚本 (content script) 中的浏览器控制台输出。

## CI/CD 与部署 (CI/CD & Deployment)

**托管：**
- Chrome 网上应用店 (Chrome Web Store)（暗示目标）

**CI 流水线：**
- 未检测到

## 环境配置 (Environment Configuration)

**所需的变量：**
- 无

**机密信息位置：**
- 不适用

## Webhooks 与回调 (Webhooks & Callbacks)

**传入 (Incoming)：**
- `chrome.runtime.onMessage` - 监听组件间的消息。
- `chrome.runtime.onInstalled` - 在安装时触发。

**传出 (Outgoing)：**
- `chrome.tabs.sendMessage` - 从弹出窗口向内容脚本发送命令。

---

*集成审计：2025-05-14*
