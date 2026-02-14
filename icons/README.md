# 图标说明

本目录存放插件图标，需要以下尺寸：

- icon16.png (16x16) - 扩展列表和上下文菜单
- icon32.png (32x32) - Windows 任务栏
- icon48.png (48x48) - 扩展管理页面
- icon128.png (128x128) - Chrome Web Store

## 快速创建临时图标

可以使用以下在线工具生成简单图标：
- https://www.canva.com/
- https://www.figma.com/

或者使用系统工具（macOS）：
```bash
# 创建一个简单的 128x128 图标
sips -z 128 128 icon.png --out icon128.png
```

**注意**: 在发布到 Edge 插件商店前，请替换为正式的图标文件。
