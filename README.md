# Onshape 多色图标

让 Onshape 的命令更容易辨认：保留原生图标轮廓与留白，增加蓝色强调，并提供可选的命令文字和功能分组。

适用于 Microsoft Edge 和 Google Chrome，当前版本 **0.4.2**。这是社区浏览器扩展，与 Onshape / PTC、SOLIDWORKS / Dassault Systèmes 无隶属关系。

## 功能

- 为原生 SVG 图标添加蓝白黑配色，保留轮廓、留白及已识别的状态颜色。
- 分别开关工具栏、菜单及特征树的配色。
- 可选显示命令文字；草图直线、矩形等绘图工具保持图标模式。
- 可选紧凑功能分组：实体生成、编辑、配合、曲线与曲面、基准等。
- 分类首次显示常用命令图标，之后记住该分类上次选用的命令图标。
- 分类和菜单文字跟随 Onshape 原生字体样式；分类区域可横向滚动。

## 安装

1. 在 [Releases](https://github.com/XKRyan/onshape-multicolor-icons/releases/latest) 下载 `onshape-multicolor-icons-v0.4.2.zip`，解压到一个长期保留的文件夹。
2. Edge 打开 `edge://extensions`；Chrome 打开 `chrome://extensions`。
3. 开启 **开发人员模式 / 开发者模式**，点击 **加载解压缩的扩展程序**。
4. 选择解压后直接包含 `manifest.json` 的文件夹，不要选择 ZIP 文件。
5. 刷新 Onshape 页面，在浏览器扩展菜单中打开 **Onshape 多色图标**。
6. 需要分类菜单时，同时开启 **显示命令文字** 和 **按功能分组**。

也可以通过 GitHub 的 **Code → Download ZIP** 下载源码，解压后选择包含 `manifest.json` 的目录，无需编译。

更新时，用新版文件替换原安装文件夹的内容，在扩展管理页面点击重新加载，再刷新 Onshape。关闭分组会恢复原生工具栏；卸载扩展后刷新页面即可恢复原显示。

## 范围与限制

- 只匹配 `https://cad.onshape.com/*`，暂未覆盖企业专属域名。
- 第三方 FeatureScript 图片图标保持原样；部分没有原生 SVG 的命令不会显示专属图标。
- 不改变模型视口的光照或零件色号，不提供 SOLIDWORKS 渲染效果。
- 功能分组依赖 Onshape 当前的内部工具栏服务；Onshape 更新后可能需要适配。识别失败时恢复原生工具栏，也可手动关闭分组。
- 已在隔离 Edge 环境验证图标、分组、记忆、布局及恢复；命令分发使用模拟服务测试，未完成登录文档端到端测试。Chrome 的安装方式相同，仍需实际使用验证。

更多显示设置说明可打开随包提供的 `guide.html`。

## 隐私与权限

只申请 `storage` 权限，用于本机保存显示开关与各分类的最近命令。扩展脚本运行于上述 Onshape 域名，不含遥测、不读取 Cookie、不自行上传数据，也不调用模型 REST API。

点击分类菜单会调用对应的 Onshape 原生命令；拉伸、删除等操作仍由 Onshape 按用户操作执行。扩展无需 API 密钥。

## 开发与反馈

修改源码后，在扩展管理页面重新加载扩展，再刷新 Onshape。提交问题请附浏览器版本、扩展版本、Onshape 所处模式（Part Studio / Assembly / Sketch）及复现步骤；截图请遮挡不希望公开的文档信息。

主要文件：`palette.js` 和 `content.js` 处理图标；`command-labels.js` 处理文字；`grouped-toolbar.js` 处理分类菜单；`toolbar-bridge.js` 对接原生命令；`popup.*` 提供显示开关。

## 许可证

[MIT](LICENSE)。许可证适用于本仓库原创代码与文档，不授予 Onshape 或 SOLIDWORKS 商标及其图标资源的权利。扩展引用当前 Onshape 页面已有的图标，不打包其图标库或客户端代码。
