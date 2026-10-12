# MiniAppRuntime React Todo

使用 React + TypeScript 编写的独立待办应用，通过公开 npm SDK 调用 HarmonyOS Runtime 的原生存储和 Toast。框架仓库：[MiniAppRuntime-Harmony](https://github.com/lichenyang5/MiniAppRuntime-Harmony)。

支持添加、完成/恢复、删除、筛选和清理已完成事项。先保存成功再更新界面，保存失败保留原内容；读取损坏数据时显示错误，不覆盖原数据。仅操作 `react-todo:v1` 这个存储键，不清空宿主的其他数据。

## 浏览器开发

需要 Node.js 22.12+。在本仓库根目录运行：

```powershell
npm install
npm run dev
```

浏览器使用 localStorage，并显示“浏览器预览 · 本地存储”。浏览器验收不能代替鸿蒙原生验收，两个环境不共享数据。

## 在鸿蒙应用中运行

本仓库当前提供 React 页面与鸿蒙入口模板，宿主工程使用已接入 Runtime 的 HarmonyOS Stage 工程（例如此前的 MyApplication4）。新宿主请先按框架的[快速开始](https://github.com/lichenyang5/MiniAppRuntime-Harmony/blob/main/docs/getting-started/quick-start.md)完成接入，要求 `myascf_runtime@1.0.0`、API 23+、`UIAbility` 启动 `pages/Index`、JavaScriptProxy 和签名配置。`harmony-templates/` 提供入口参考，不包含签名凭据。

在 **React 仓库根目录**运行：

```powershell
npm run build
npm run sync:harmony -- "C:\你的目录\MyApplication4"
```

1. build 执行 TypeScript 检查和 Vite 构建，并将 JS/CSS 内联到 `dist/index.html`，便于 ArkWeb rawfile 加载。
2. sync 将 dist 内容复制到宿主的 `entry/src/main/resources/rawfile/web`，覆盖旧页面。
3. 在 DevEco 打开宿主工程，Rebuild Project，然后 Run entry 到已连接的设备。

本应用从 npm 导入 `@lcy453/miniapp-runtime-harmony-web-sdk@0.1.0`，构建时将 SDK 一起打包，无需再单独加载 `myascf.js`。不要再运行宿主原来的纯 HTML `sync:runtime-web`，否则它会将旧测试页覆盖回来。宿主 `Index.ets` 仍加载 `$rawfile('web/index.html')`。

后续修改 `src/` 后重复 **build → sync:harmony → Rebuild → Run**。同步只复制资源，不安装依赖、不编译 HAP、不部署到设备。此脚本会覆盖目标 web 目录的同名文件；目标应为专门用于此应用的宿主。

## 验收

- 启动显示“鸿蒙 Runtime · 原生存储”，读取完成后可以输入。
- 添加事项，看到原生 Toast；完成/恢复、删除、筛选与清理已完成可用。
- 关闭并重新启动应用，事项内容和完成状态保持；浏览器数据不混入。
- 接入失败显示错误与重新连接按钮，不能把未读取的空列表写入存储。
- 保存失败时保留原内容；Toast 失败时明确数据已保存。

自动检查：`npm run lint`、`npm test`、`npm run build`。当前自动测试覆盖数据校验与纯逻辑；真机存储、Toast 和重启持久化须按以上步骤验收，不能仅凭构建成功认定通过。

## 本次验证记录

2026-10-12：公开 npm SDK 0.1.0、OHPM Runtime 1.0.0、API 24 宿主编译成功并生成签名 HAP。真机安装启动后显示原生存储，Storage set/get 与 Toast 回调 code=0；彻底 force-stop 后重新启动，测试事项内容与已完成状态恢复。

浏览器独立会话已验证添加、刷新恢复、完成状态刷新恢复与清理已完成，无页面异常。构建、Lint 和 3 项数据校验测试通过。CI 工作流会在 push/PR 时执行同一组检查。

超时或响应格式异常时，存储结果可能尚未确认，应用暂停编辑，要求彻底退出并重启后读取最终结果。未进行真机延迟写入故障注入；不能把这一分支标为真机已验证。
