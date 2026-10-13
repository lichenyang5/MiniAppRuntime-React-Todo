# MiniAppRuntime React Todo

独立的 React + TypeScript 待办应用，包含可直接打开的 HarmonyOS Stage 宿主。通过公开 npm SDK `0.1.0` 与 OHPM Runtime `1.0.0` 调用原生存储和 Toast，无需克隆框架源码，也无需准备 MyApplication4。

支持添加、编辑、完成/恢复、删除、分类与状态筛选、截止日期和清理已完成事项。只使用 `react-todo:v1` 存储键；保存成功后更新列表，读取损坏数据时阻止编辑，超时或响应格式异常时暂停编辑并要求彻底退出后重启确认结果。

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
自动签名生成后，还要确认当前 product 关联了该签名。在本地 `harmony/build-profile.json5` 中，`app.products` 的 default 产品应含以下字段（保留已有其他配置）：

```json5
{
  name: 'default',
  signingConfig: 'default',
}
```

这里的 `signingConfig` 值必须对应 `app.signingConfigs` 中的 `name`。可在 DevEco 的 Products 配置中选择对应签名，或在本地文件补上关联。仅生成签名材料或修改包名，仍可能构建出 unsigned HAP。

重新构建后，确认 `harmony/entry/build/default/outputs/default/entry-default-signed.hap` 的时间是本次构建，再 Run。若报 `9568320 / no signature file`，优先检查这个关联与产物；该报错不表示应用页面或 Runtime 调用出了问题。本地签名配置保持忽略，不提交 Git。

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

独立宿主使用新的包名，签名须按上述步骤在本机配置。GitHub CI 覆盖前端、初始化/同步回归及公开宿主配置，未包含需要本地 HarmonyOS SDK 的 HAP 构建。延迟原生写入、损坏存储及权限异常的真机故障注入尚未完成。

2026-10-13：仅从 Git 跟踪文件创建全新目录，npm ci、公开 OHPM 安装、React 构建与独立宿主 unsigned HAP 编译通过。随后完成本机签名及 default 产品绑定，生成 signed HAP，新包名真机安装和启动通过。新包名的存储、Toast、重启恢复与异常矩阵仍需单独验收。

## 异常与生命周期自动回归

浏览器测试在隔离的 .test-site 中预构建实际 React 页面与公开 npm SDK，通过测试专用 Native Proxy 模拟器控制原生回调，不会替换生产页面的 Bridge。CI 安装 Chromium 并执行同一套测试，失败时保留报告和 trace。

首次在本机运行：

```powershell
npx playwright install chromium
npm run test:browser
```

安装浏览器后可以执行 `npm run check:all`，依次运行原有检查和浏览器回归。已有 Chromium 系浏览器也可使用可选环境变量 `PLAYWRIGHT_EXECUTABLE_PATH` 指定可执行文件，此设置不要提交个人路径。

当前自动回归覆盖：

- 原生存储正常保存及刷新恢复。
- 明确保存失败时保留旧列表和输入，允许重试，展示 SDK 错误消息与 code。
- 保存回调超时后暂停编辑；晚到成功不触发 Toast、不自动恢复编辑，重新加载读取最终结果。
- 无效写入响应暂停编辑，损坏读取数据不能被空列表覆盖。
- Toast 失败仍保留已保存的数据。
- 快速重复提交仅发送一次写入。
- 组件卸载时通过 AbortSignal 释放 SDK 等待，晚到回调不更新界面、不触发 Toast。
- 有未完成保存回调时刷新页面，不重放原来的写入，读取已持久化数据。

模拟器中“延迟回调”表示原生数据已保存但响应尚未返回。它不证明真实 Native 延迟写入或重启时的磁盘行为。AbortSignal 取消页面等待，也不撤销已经交给 Native 的保存操作；超时后仍须彻底退出重启确认结果。鸿蒙 Kit、ArkWeb、进程退出和真实磁盘故障继续按真机清单验证。

2026-10-13 异常回归更新：6 项原有测试与 9 项浏览器回归通过；卸载后的晚到 Toast 问题先复现后修复。修改后的签名 HAP 在独立包名真机安装启动，Storage set/get、Toast 返回 code=0，force-stop 后测试事项与完成状态恢复。仅删除本次唯一验收事项，未清空应用存储。真实磁盘故障与延迟原生写入未进行故障注入。

## 编辑 分类和截止日期

待办支持生活、工作、学习三类，分类筛选可与全部/待完成/已完成一起使用。旧版本没有分类的事项显示为生活，读取时不自动重写存储。

点击事项旁的编辑，可以修改内容、分类及截止日期，保存成功后更新列表；取消不写入，保存失败保留编辑草稿与原数据，允许重试。编辑保留原事项编号和完成状态，编辑期间暂停其他事项的修改。长列表编辑会自动滚动并聚焦编辑框，取消或保存后恢复焦点。

截止日期可不填，也可以在编辑时清除。日期只表示本地日历的一天，不表示提醒时间；未完成且截止日期早于今天时显示已逾期，今天到期或已完成事项不会标为逾期。今天日期在页面聚焦时与每分钟刷新。此版本尚未接入原生通知提醒。

清理已完成会处理所有分类的完成事项，不限于当前筛选结果。数据仍保存在原来的 react-todo:v1 键中。

2026-10-13 业务功能验证：10 项数据/工具测试与 14 项浏览器回归通过，包含旧数据读取、编辑后身份/完成状态保留、日期校验、逾期规则、取消/失败重试、组合筛选和长列表编辑焦点。签名 HAP 编译及真机安装启动通过；真机分类选择器和日期控件可用，新增工作分类/今天截止日期的测试事项，编辑标题后 force-stop 重启，内容、分类和日期正确恢复。仅删除本次唯一测试事项。

## 原生待办提醒

在本仓库的鸿蒙宿主中，先添加待办，再到“待办提醒”选择事项和时间，点击“开启通知”允许系统通知，最后“设置提醒”。可用“2分钟后”快速验收。截止日期不会自动生成提醒；每个待办只保留一个提醒，调整时间或内容请先取消旧提醒再设置。

提醒由鸿蒙日历代理提醒触发，不依赖 React 页面计时器。列表从系统查询，应用重启后可重新读取。普通浏览器和没有接入扩展的旧宿主显示不支持原生提醒。

完成或删除待办时，先取消关联提醒，再保存待办。取消失败保留待办；如果取消成功后存储失败，页面提示“提醒已取消”，待办保留原内容。这两项系统操作不是同一个事务。调用超时不能断言系统没有执行，请用“刷新提醒”核对后继续；不要重复盲点设置。

通知点击通过 EntryAbility 的 onCreate/onNewWant 接收事项标识，冷启动和已打开应用都将显示全部分类并定位待办。若对应事项已删除，页面会说明。应用被系统限流、通知关闭、勿扰模式及卸载均可能影响提醒，请勿用作必须准时送达的闹钟。

### 实现与接入边界

本功能是 Todo 宿主扩展，不是已发布 Runtime 1.0.0 的内置 API。TodoReminderProxy 处理 app.reminder.status、requestPermission、schedule、cancel，其余请求转发公开 Runtime；Web 侧复用同一 SDK 实例的 send。没有修改 oh_modules，也无需重新发布 npm 或 OHPM 包。

宿主声明 ohos.permission.PUBLISH_AGENT_REMINDER，并使用 @kit.BackgroundTasksKit 的 reminderAgentManager 与 @kit.NotificationKit 的 notificationManager。提醒的 taskId、标题及时间保存在系统提醒的 WantAgent 参数里，仅查询/取消本功能标记的提醒。通知目标固定为当前应用，Web 页面不能选择其他包。

如把 React 页面同步到其他宿主，也需移植 TodoReminderProxy、Index 的代理注册和通知路由、EntryAbility 的启动参数处理及模块权限。仅复制 HTML 不会获得此扩展。

官方参考：[代理提醒开发指南](https://github.com/openharmony/docs/blob/master/en/application-dev/task-management/agent-powered-reminder.md)、[reminderAgentManager API](https://github.com/openharmony/docs/blob/master/en/application-dev/reference/apis-backgroundtasks-kit/js-apis-reminderAgentManager.md)。

### 真机验收

1. 执行 npm run check:all 和 npm run build:harmony，安装本次 signed HAP。
2. 新建独有的测试事项，允许通知，设为“2分钟后”，确认系统提醒列表中出现。
3. 返回桌面，再完全退出应用，等待提醒触发。查看通知是否包含测试事项。
4. 点击通知，确认返回应用并定位该事项。再设置一次提醒后完成/删除事项，确认系统提醒已取消。
5. 如未收到通知，检查应用通知开关、系统勿扰状态、设备能力及页面反馈，刷新系统提醒列表。测试结束只移除自己的测试事项。

### 华为真机：必须先申请代理提醒能力

2026-10-13 的真机验收：签名安装、应用启动、通知授权、提醒查询均成功；创建提醒返回 1700002。系统日志显示 VerifyCloudCapability failed，capability = reminder_capability，并将本应用提醒额度限制为 0。当前包名尚未申请代理提醒开放能力，因此后台触发和通知点击尚未通过真机验收。

仅在 module.json5 声明权限、打开手机通知或使用自动签名，不能解决这一外部能力限制。也不要删除手机上的其他应用数据来尝试修复。

在华为开发者平台的对应 HarmonyOS 应用中申请代理提醒能力，申请时使用本项目真实包名 com.lichenyang.runtime.todo。入口与材料要求以[华为代理提醒指南](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/agent-powered-reminder)和平台当前页面为准。开通后为同一包名重新生成具备该能力的调试 Profile，按平台要求在 DevEco 配置手动签名，确认 product 关联该签名，重新构建、安装，再按上面的真机步骤验收。

可用于整理申请材料的场景说明（按实际应用信息修改）：

> 本应用为个人待办效率工具。用户主动选择待完成事项并设置提醒时间，系统到时通知用户处理该事项。提醒不用于营销、推送广告或后台常驻；用户可以取消提醒，完成或删除待办时应用会取消对应提醒。通知点击返回对应待办。

页面已提供“待办提醒”的事项选择、时间选择、通知授权、设置和取消入口，可截取真实界面作为功能场景材料。不要把模拟测试结果写成真机提醒已送达。开发者账号、真实应用分类和业务申请由账号持有人核对并提交。

若能力已开通仍出现 1700002，核对包名、能力开关、新 Profile 和实际安装包是否一致，再检查提醒数量。[官方错误码入口](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/errorcode-reminderagentmanager)。
