# MiniAppRuntime React Todo

独立的 React + TypeScript 待办应用，包含可直接打开的 HarmonyOS Stage 宿主。通过公开 npm SDK `0.1.0` 与 OHPM Runtime `1.0.0` 调用原生存储和 Toast，无需克隆框架源码，也无需准备 MyApplication4。

支持添加、完成/恢复、删除、筛选和清理已完成事项。只使用 `react-todo:v1` 存储键；保存成功后更新列表，读取损坏数据时阻止编辑，超时或响应格式异常时暂停编辑并要求彻底退出后重启确认结果。

框架：[MiniAppRuntime-Harmony](https://github.com/lichenyang5/MiniAppRuntime-Harmony)。

## 环境

- React 工具链：Node.js 22.12+、npm。
- 鸿蒙宿主：DevEco Studio，已安装 API 24 SDK（当前模板 target `6.1.1(24)`，最低 API 23），设备 API 23+。
- Windows 工具默认安装目录：`C:\Program Files\Huawei\DevEco Studio`。其他目录请先设置 `DEVECO_HOME`。脚本使用 DevEco 自带 OHPM、Hvigor、Node 和 JBR。

本文命令均在 **本仓库根目录**执行。

## 首次接入

```powershell
git clone https://github.com/lichenyang5/MiniAppRuntime-React-Todo.git
Set-Location MiniAppRuntime-React-Todo
npm ci
npm run setup:harmony
npm run build:harmony
```

`setup:harmony` 从公开模板生成本地 `harmony/build-profile.json5`，并安装鸿蒙依赖。再次执行会保留已有 SDK 与签名配置。

`build:harmony` 构建 React、内联 JS/CSS、同步到仓库自带的宿主，再调用 Hvigor 编译 HAP。未配置签名时可以验证 unsigned HAP 编译；真机安装须完成下一步。

用 DevEco Studio **打开仓库内的 `harmony/` 目录**，不要打开 React 仓库根作为鸿蒙工程。执行 Sync and Refresh Project，在 Project Structure → Signing Configs 配置本机自动签名，连接并解锁手机，然后 Run `entry`。

宿主包名为 `com.lichenyang.runtime.todo`，应用名称 Runtime Todo，不与旧 MyApplication4 共用应用数据。首次启动旧应用中的待办不会迁移。

### DevEco 安装位置不同

```powershell
$env:DEVECO_HOME = 'D:\DevEco Studio'
npm run setup:harmony
npm run build:harmony
```

默认 `DEVECO_SDK_HOME` 为安装目录下的 `sdk`，`JAVA_HOME` 为 `jbr`，也可以用同名环境变量指定。本地 SDK 版本不同，请调整生成的 `harmony/build-profile.json5`，保持最低 API 23；不要修改发布依赖的元数据。

本次命令行安装与编译流程在 Windows 验证；其他操作系统的 DevEco 工具布局可能不同，可使用 DevEco GUI 执行依赖同步和构建。

## 浏览器开发

```powershell
npm run dev
```

普通浏览器使用 localStorage，并显示“浏览器预览 · 本地存储”。浏览器与鸿蒙应用不共享数据。

## 日常命令

| 命令                                | 作用                                             |
| ----------------------------------- | ------------------------------------------------ |
| `npm run format`                    | Prettier 格式化 React、脚本和文档                |
| `npm run format:check`              | 只检查格式                                       |
| `npm run lint` / `npm run lint:fix` | ESLint 检查 / 修复                               |
| `npm run typecheck`                 | 检查 React 与 Vite TypeScript 配置               |
| `npm test`                          | 待办数据与宿主初始化/同步测试                    |
| `npm run check`                     | 格式、Lint、测试、宿主配置检查及 React 构建      |
| `npm run build`                     | 构建 React，并把 JS/CSS 内联到 `dist/index.html` |
| `npm run sync:harmony`              | 将 dist 同步到仓库内 `harmony/`                  |
| `npm run setup:harmony`             | 初始化本地配置并安装 OHPM 依赖                   |
| `npm run build:harmony`             | React 构建 → 同步 → Hvigor 编译                  |

修改 React 后执行 `npm run build:harmony`，然后 DevEco Run `entry`。已打开 DevEco 时也可以执行 `npm run build`、`npm run sync:harmony`，再用 GUI 构建运行。

同步只复制资源，不会安装或启动设备应用。应用从 npm 导入 SDK，由构建一起打包，不再单独加载 `myascf.js`。不要运行旧宿主的纯 HTML 同步脚本覆盖 React 页面。

如需沿用其他已接入 Runtime 的宿主，仍支持显式目标：

```powershell
npm run build
npm run sync:harmony -- 'C:\你的目录\MyApplication4'
```

该命令覆盖目标 `rawfile/web` 的同名文件，应使用专门用于此应用的宿主。`build:harmony` 始终编译本仓库的 `harmony/`；不支持带 `HARMONY_PROJECT` 环境变量调用它，请用显式同步命令和目标工程 GUI 构建。

## 仓库结构和本地签名

```text
src/                              React 页面、Runtime 调用与数据逻辑
scripts/                          构建内联、初始化、同步与 CLI 工具
harmony/                          完整 Stage 宿主源码和资源
  build-profile.template.json5    可公开的 SDK 与构建配置模板
  build-profile.json5             初始化生成，仅在本机保存
  entry/                          原生入口、ArkWeb Proxy 与 OHPM 依赖
```

本地 build-profile、local.properties、签名文件、IDE 设置、依赖和产物已忽略。DevEco 生成的签名配置保留在本地；`check:harmony` 检查被 Git 跟踪的宿主文件中是否混入签名材料。

Prettier 处理前端与工具代码，鸿蒙 `.ets` 源码及平台配置使用 DevEco 格式化。

## 验收和常见问题

1. 页面显示“鸿蒙 Runtime · 原生存储”，读取后可以输入。
2. 添加事项显示原生 Toast；完成、恢复、删除、筛选与清理可用。
3. 完全退出并重新启动，事项及完成状态保留。
4. 接入失败显示重试入口；存储读取失败不能覆盖旧数据。
5. 保存超时或响应异常时暂停编辑，彻底退出重启后再确认存储结果。

| 现象                  | 处理                                                   |
| --------------------- | ------------------------------------------------------ |
| 缺少 build-profile    | 执行 `npm run init:harmony`                            |
| 找不到 DevEco 工具    | 设置 `DEVECO_HOME`                                     |
| 找不到 myascf_runtime | 执行 `npm run setup:harmony`，检查网络和 OHPM registry |
| 只有 unsigned HAP     | 打开 harmony 工程，为新包名配置本机签名                |
| 页面为空或仍是旧页面  | 确认 build、sync，重新构建并运行本次应用               |
| SDK 版本不匹配        | 安装模板所需 SDK 或调整本地 build-profile，最低 API 23 |

## 验证记录

2026-10-12：原有 MyApplication4 宿主已真机验证 Storage、Toast code=0，force-stop 后待办与完成状态恢复；浏览器添加、完成、刷新恢复与清理通过。

独立宿主使用新的包名，需要重新签名及设备验收。GitHub CI 覆盖前端、初始化/同步回归及公开宿主配置，未包含需要本地 HarmonyOS SDK 的 HAP 构建。延迟原生写入、损坏存储及权限异常的真机故障注入尚未完成。

2026-10-13：仅从 Git 跟踪文件创建全新目录，npm ci、公开 OHPM 安装、React 构建与独立宿主 unsigned HAP 编译通过。新宿主未配置本机签名，尚未真机验收；旧宿主的真机结果不能替代新包名的设备验收。
