# 技术方案

## 项目目标
- 实现基于鼠标右键按下开始记录、完成后校验最小时长的 Chrome 鼠标手势扩展。
- 根据 JSON 配置动态映射手势序列与动作，易于拓展和维护。
- 新增扩展配置页面，允许用户在浏览器选项页维护手势与动作映射。
- 在不提供可视化提示层的前提下，通过模块化代码结构与日志提升可维护性。

## 架构概览
- Manifest V3 扩展，使用 service worker 作为后台脚本，内容脚本挂载于所有页面，配置页面作为独立的扩展 Options Page。
- 主要模块：
  - GestureConfigLoader：读取并解析 JSON 配置，提供手势与动作映射。
  - GestureTracker：监听鼠标事件，记录轨迹、识别方向序列。
  - GestureInterpreter：结合配置判断匹配的手势。
  - ActionRouter：根据动作类型决定由内容脚本本地执行或经消息发送至后台。
  - BackgroundActionExecutor：使用扩展权限（如 tabs）执行跨页面动作。
  - MessagingChannel：封装 content script 与 background 的消息通信协议。
  - ConfigStateService：封装配置的存取与缓存，同步内容脚本与配置页面。
  - OptionsPageUI：负责渲染配置页面、联动 JSON 编辑器与动作选择组件。
- 目录建议：
  - `src/content/`：内容脚本相关模块（Tracker、Interpreter、Router）。
  - `src/background/`：service worker 入口与动作执行模块。
  - `src/options/`：配置页面入口、组件与校验逻辑。
  - `src/common/`：公共类型定义、消息常量、日志工具。
  - `config/gestures.json`：默认手势配置文件。

## 模块职责与关键点
- GestureConfigLoader
  - 使用 `chrome.runtime.getURL` 读取内置默认 JSON，并在初始化时缓存。
  - 结合 ConfigStateService 合并用户自定义配置与默认配置。
  - 关键日志：配置加载成功或失败、配置结构校验结果。
- ConfigStateService
  - 统一管理配置存储，读取优先级：用户存储（`chrome.storage.sync`）优先于内置默认。
  - 提供订阅机制，内容脚本与后台可注册监听配置变更。
  - 关键日志：配置读取来源、写入结果、同步失败原因。
- GestureTracker
  - 监听 `contextmenu` 阻止默认菜单，捕获右键 `pointerdown`、`pointermove`、`pointerup`。
  - 手势记录策略调整：右键按下后立即开始记录轨迹；在手势完成时校验“最小手势时长（`defaultDelay`，毫秒）”，不足则丢弃。
  - 将移动轨迹转化为方向序列（如 `LEFT`、`RIGHT`、`UP`、`DOWN`）。
  - 关键日志：手势开始、方向判定、手势结束或取消原因。
- GestureInterpreter
  - 接收方向序列，与配置比对（支持多步，如 `DOWN>UP`）。
  - 若匹配失败，提供 fallback 日志但不执行动作。
  - 支持复数匹配策略（严格匹配、前缀匹配可拓展）。
- ActionRouter
  - 将匹配结果拆分为 DOM 动作与扩展动作。
  - DOM 动作（滚动、刷新、历史导航）可直接在内容脚本执行。
  - 扩展动作（关闭标签页等）通过 MessagingChannel 转发至后台。
  - 关键日志：动作分派、消息发送状态。
- BackgroundActionExecutor
  - 处理来自内容脚本的动作请求（如 `CLOSE_TAB`）。
  - 使用 `chrome.tabs`、`chrome.windows` 等 API 执行。
  - 错误处理与日志：捕获 API 调用失败、无权限等场景。
- MessagingChannel
  - 统一消息类型（如 `gesture/triggered`、`config/updated`），约定 payload 结构。
  - 在内容脚本、后台与配置页面分别封装发送与监听函数，确保松耦合。
  - 关键日志：消息注册与重要事件传输。
- OptionsPageUI
  - 渲染 JSON 编辑器、预设动作下拉列表与示例手势预览。
  - 调用 ConfigStateService 读写配置，实时校验格式。
  - 关键日志：用户保存配置、校验错误、还原默认操作。

## 配置页面设计
- 页面类型：在 `manifest.json` 中声明 `options_page` 指向 `options.html`，采用单页应用结构。
- 页面结构：
  - Header：展示扩展名称与配置说明，提供“还原默认”“导入”与“导出”按钮。
  - 主体：左右布局，左侧为手势列表（可新增或删除），右侧为所选手势配置表单。
- 表单设计：
  - 手势序列编辑：
    - 提供方向按钮（`UP`、`DOWN`、`LEFT`、`RIGHT`）快速追加。
    - 支持文本模式输入，自动按分隔符拆分为数组。
  - 动作选择：
    - 下拉选择支持的动作枚举（如 `NAVIGATE_BACK`）。
    - 动作附带说明与执行范围提示。
  - 全局参数：允许用户修改最小手势时长（`defaultDelay`，毫秒）、最小移动距离（像素）等配置。
- 交互流程：
  - 页面加载：OptionsPageUI 调用 ConfigStateService 读取配置，初始化状态。
  - 编辑：即时校验 JSON 字段是否合法（结构、方向、动作枚举）。
  - 保存：点击“保存”后调用 ConfigStateService 写入 `chrome.storage.sync`，并通过 MessagingChannel 通知内容脚本刷新缓存。
  - 导入：上传本地 JSON 文件，校验通过后覆盖当前配置。
  - 导出：将当前配置序列化为 JSON 并触发下载。
  - 还原默认：恢复内置配置并写入存储。
- 可用性与可访问性：
  - 表单控件支持键盘操作与 ARIA 标签。
  - 提供操作结果 Toast（保存成功、校验失败），使用 `aria-live` 公布状态。
- 安全策略：
  - 校验 JSON 防止注入非法字段。
  - 导入流程限制为本地文件，禁止远程加载。

## 手势配置方案
- 默认配置存放于 `config/gestures.json`：
```json
{
  "defaultDelay": 100,
  "minMoveDistance": 10,
  "gestures": [
    { "sequence": ["LEFT"], "action": "NAVIGATE_BACK" },
    { "sequence": ["RIGHT"], "action": "NAVIGATE_FORWARD" },
    { "sequence": ["UP"], "action": "SCROLL_TOP" },
    { "sequence": ["DOWN"], "action": "SCROLL_BOTTOM" },
    { "sequence": ["DOWN", "UP"], "action": "RELOAD" },
    { "sequence": ["RIGHT_BUTTON", "LEFT_CLICK"], "action": "CLOSE_TAB" }
  ]
}
```
- 用户配置保存在 `chrome.storage.sync` 中，实现多设备同步；若超出同步配额，可退化到 `chrome.storage.local`。
- ConfigStateService 提供合并策略：全局参数覆盖、手势列表按 `sequence` 或显式 `id` 匹配更新。

## 事件流程
1. 扩展安装或更新：BackgroundActionExecutor 注册消息通道，ConfigStateService 预加载默认配置。
2. 内容脚本加载页面：GestureConfigLoader 读取缓存配置，若为空则请求后台获取最新配置。
3. 用户按下右键：GestureTracker 立即进入记录状态并标记开始时间。
4. 鼠标移动：GestureTracker 计算方向片段（基于最小移动距离阈值），生成序列。
5. 右键抬起或触发左键：GestureTracker 停止记录并检查手势总时长；若小于 `defaultDelay` 则丢弃，否则将序列交给 GestureInterpreter。
6. GestureInterpreter 匹配成功：ActionRouter 根据动作类型执行或通知后台，日志记录结果。
7. 用户在配置页面修改配置：OptionsPageUI 调用 ConfigStateService 写入存储。
8. ConfigStateService 发布 `config/updated` 消息；内容脚本与后台收到后刷新本地缓存。
9. 所有关键节点输出日志，便于调试与埋点统计。

## 技术细节与约束
- 语言：建议 TypeScript 搭配 Rollup 或 ESBuild 构建，确保类型安全与模块划分清晰。
- Manifest：
  - `manifest_version: 3`
  - 权限：`tabs`、`scripting`、`activeTab`、`contextMenus`、`storage`。
  - 声明：`background.service_worker`、`content_scripts`、`options_page`。
  - 内容脚本匹配：`<all_urls>`。
- 鼠标事件处理：
  - 阻止 `contextmenu` 弹出，保持右键功能一致。
  - 使用 Pointer Events 统一处理，回退到 Mouse Events 兼容老页面。
  - 轨迹平滑：设定最小移动距离阈值，避免噪声。
- 配置页面实现：
  - 可选框架（React、Preact）或原生 Web Components，根据团队熟悉度选择。
  - JSON 编辑可采用轻量第三方库（需内联打包，避免动态加载）。
  - 校验逻辑抽离到 `src/options/validators/`，便于单元测试。
- 安全考虑：
  - 避免在页面上下文执行不必要的 DOM 操作；所有逻辑在独立作用域运行。
  - 配置读取只允许扩展内资源与 storage，未来如需远程更新需加校验与签名。

## 日志策略
- 使用统一 `log.ts` 工具封装 `console.log` 与 `console.error`，带上模块前缀与手势或配置 ID。
- 关键节点（配置加载、手势开始或结束、匹配成功或失败、动作执行结果、配置保存）必须打印。
- 在生产版本可通过环境变量或配置控制日志级别，Options Page 可提供开关。

## 测试与验证
- 单元测试：
  - GestureInterpreter 的序列匹配逻辑（含边界：短序列、重复方向）。
  - ActionRouter 分派逻辑，确保 DOM 与扩展动作区分正确。
  - ConfigStateService 合并策略、存储读写失败处理。
  - OptionsPage 校验器（非法 JSON、未知动作、空序列）。
- 集成测试：
  - 在 Chrome 扩展调试模式下验证默认手势与配置页联动。
  - 修改配置后立即生效（内容脚本重新读取）。
  - 导入或导出功能正确处理边界（空文件、格式错误）。
- QA Checklist：
  - 手势总时长不足 `defaultDelay`（毫秒）不触发手势。
  - 左键点击与右键行为不会互相干扰。
  - 在多标签页环境中关闭当前标签无副作用。
  - 配置页面保存失败时给予明确提示。

## 后续扩展建议
- 支持手势录制或可视化提示层（Overlay）。
- 在配置页面加入操作预览动画与快捷键配置。
- 引入国际化动作文案，与日志结合形成可视化调试面板。
- 通过远程配置或云同步策略进行统一管理，结合签名校验保障安全。
