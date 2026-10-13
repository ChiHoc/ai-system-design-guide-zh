# 计算机使用智能体

计算机操作代理让 LLM 看到屏幕、进行推理，再像人一样通过鼠标和键盘操作计算机。模型并非调用结构化 API，而是处理原始像素（浏览器场景下越来越多地使用页面无障碍树）。本章介绍其工作方式、何时优于传统自动化，以及如何围绕它们设计生产系统。

## 目录

- [什么是计算机使用智能体？](#什么是计算机使用智能体)
- [截图-推理-行动循环](#截图-推理-行动循环)
- [Claude 计算机使用：工具和 API](#claude-计算机使用-工具和-api)
- [架构：沙盒环境](#架构-沙盒环境)
- [浏览器自动化与桌面自动化](#浏览器自动化与桌面自动化)
- [与传统自动化的比较](#与传统自动化的比较)
- [何时计算机使用优于 API 调用](#计算机使用何时优于-api-调用)
- [错误处理与恢复](#错误处理与恢复)
- [性能：延迟、成本、吞吐量](#性能-延迟、成本、吞吐量)
- [基准测试：如何解读数字](#基准测试-如何解读数字)
- [真实世界应用](#真实世界应用)
- [安全考量](#安全注意事项)
- [代码示例](#代码示例)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 什么是计算机使用智能体？

计算机使用智能体是一种 LLM，它通过解释截图并发出低级输入命令（鼠标移动、点击、键盘敲击）来控制图形界面。它在人机交互循环中替代人类。

```
Traditional Tool Use:           Computer Use:

User Request                    User Request
     |                               |
     v                               v
 LLM reasons                    LLM reasons
     |                               |
     v                               v
 Structured API call             Screenshot captured
 {"tool": "search",                  |
  "query": "..."}                    v
     |                          LLM sees pixels, finds button
     v                               |
 API returns JSON                    v
     |                          Mouse click at (x=340, y=220)
     v                               |
 LLM formats answer                  v
                                New screenshot captured
                                     |
                                     v
                                LLM verifies result, continues...
```

关键区别：传统工具使用需要带有已知模式的预定义 API。计算机使用适用于任何具有可视界面的应用程序——不需要 API。

### 现状（2026）

大多数主要实验室和平台如今都提供计算机操作能力，产品分为三种形态：由客户托管环境的 API 工具、供应商托管的运行时，以及拥有独立云端计算机的持久化代理。

| 提供商 | 产品 | 方法 | 关键优势 |
|----------|-------|----------|--------------|
| Anthropic | `computer_toolset_20260801`（2026 年 8 月 19 日在 Claude API 正式发布）和 `browser_toolset_20260801` | 客户托管的工具集：桌面用像素，浏览器用无障碍树元素引用 | 一个 API 覆盖桌面与浏览器，支持批量动作 |
| OpenAI | Agents API computer use（托管浏览器于 2026 年 9 月 29 日加入，公开测试）、ChatGPT agent、dots | 托管 Codex 运行框架上的 OpenAI 浏览器；独立云端计算机上的持久化代理 | 按网站来源审批；凭据不进入模型输入 |
| Google | 主线 Flash 模型上的 Gemini API computer use（推荐 `gemini-3.8-flash`）；Gemini Enterprise Computer Use 沙箱（2026 年 9 月 9 日正式发布） | 在标准化的 0–999 坐标网格上操作浏览器、Android 和桌面 | 内置返回 `require_confirmation` 的安全服务；VPC 隔离的托管沙箱 |
| Microsoft | GitHub Copilot computer use（2026 年 10 月 1 日公开预览）、Copilot Autopilot（私人预览）、UFO 研究框架 | 结合可访问的应用内容与视觉信息操作桌面应用 | 按应用批准权限；代理在客户租户内有独立身份 |
| Amazon | Nova Act | 专用浏览器模型 | 电子商务工作流 |
| Meta | Muse（2026 年 9 月 8 日） | 在专用云端 VM 中运行浏览器的消费级代理 | 零售与连接器合作伙伴 |

### 各供应商 API 的差异

核心循环相同，但外围契约不同；这些差异决定需要自行构建多少安全层。

| 问题 | Anthropic 计算机工具集 | Gemini computer use | OpenAI Agents API（托管浏览器） |
|------|-----------------------|---------------------|--------------------------------|
| 环境由谁托管 | 客户 | 客户（或 Gemini Enterprise 沙箱） | OpenAI |
| 坐标空间 | 返回截图的像素坐标 | 客户映射到屏幕的 0–999 标准化网格 | 无需客户处理，由 OpenAI 执行 |
| 内置确认 | 需自行实现；Anthropic 建议每个动作执行前检查，因为一个批次可完成多步操作 | 安全服务对金融交易、通信工具、账户创建及法律条款等类别返回 `require_confirmation` | 新网站来源需要 `browser_origin_access` 审批；登录需要 `browser_authentication` |
| 凭据 | 客户负责避免出现在屏幕上 | 客户负责避免出现在屏幕上 | 独立登录 UI 和会话事件端点，不进入模型输入（不支持通行密钥或二维码登录） |
| 计费与数据条款 | 模型 token；符合 ZDR 条件，因为截图和动作留在客户环境，但 Fable 与 Mythos 除非 Anthropic 明确授权 ZDR，否则要求保留 30 天 | 按模型价格计算 token | 无单独 API 费用；按模型、工具和容器用量收费；测试期仅美国数据驻留，不支持 ZDR |

---

## 截图-推理-行动循环

每个计算机使用智能体都遵循相同的核心循环，通常称为“智能体循环”或“行动循环”：

```
+------------------+
|  Capture Screen  |<-----------+
+--------+---------+            |
         |                      |
         v                      |
+------------------+            |
|  Send to LLM     |            |
|  (screenshot +   |            |
|   task context)  |            |
+--------+---------+            |
         |                      |
         v                      |
+------------------+            |
|  LLM Reasons     |            |
|  about next      |            |
|  action(s)       |            |
+--------+---------+            |
         |                      |
    +----+----+                 |
    |         |                 |
    v         v                 |
 [Action]  [Done]               |
    |                           |
    v                           |
+------------------+            |
| Execute Actions  |            |
| in order (click, |            |
|  type, key, ...) |            |
+--------+---------+            |
         |                      |
         +----------------------+
```

每次迭代：
1. **捕获**：截取当前显示状态的截图。
2. **发送**：将截图（base64 图像）和对话历史传给 LLM。
3. **推理**：模型分析屏幕上的内容，确定朝目标前进的下一步。
4. **行动**：模型输出一个或多个工具调用（例如在 `[450, 320]` 处 `left_click`），运行时按顺序执行。
5. **重复**：捕获新截图，循环继续，直到模型发出完成信号。

模型通过对话历史跨迭代维护上下文，截图和动作累积成已发生事件的视觉“记忆”。这段历史也是成本驱动因素：长会话以输入 token 为主（见[性能](#性能-延迟、成本、吞吐量)）。

**批量动作改变了循环的成本与安全关口。** Claude 计算机工具集可在一轮中返回多个动作（点击输入框、输入、按回车、截图）。执行器顺序执行，在首次失败时停止。一次模型往返完成多步，降低了每步延迟与成本，但也可能在一轮内完成影响重大的多步操作。Anthropic 建议在每个动作执行前确认，而非每轮只确认一次。实际做法是收到批次时检查整个批次，在任何重要动作前暂停，避免位于批次中间的提交点击绕过只看第一个动作的检查。

---

## Claude 计算机使用：工具和 API

Anthropic 将计算机操作作为客户端工具提供：客户托管环境并执行动作，Claude 决定做什么。2026 年 8 月 19 日，它在 Claude API 正式发布（Google Cloud 为 8 月 20 日），从单个工具变为一个 `tools` 条目展开多个成员工具的**工具集**；在 Amazon Bedrock、Claude Platform on AWS 和 Microsoft Foundry 上仍为测试版。支持 Fable 5/5.1、Mythos 5/5.1、Opus 5/5.5、Sonnet 5/5.5 和 Opus 4.8。

### 工具

| 工具 | 声明形式 | 作用 |
|------|----------|------|
| 计算机工具集 | `{"type": "computer_toolset_20260801"}`（无 `name` 或显示尺寸） | 17 个屏幕、鼠标和键盘成员工具 |
| 浏览器工具集 | `browser_toolset_20260801` | 31 个成员工具，驱动客户应用托管的浏览器 |
| Bash | `{"type": "bash_20250124", "name": "bash"}` | 持久化 shell 会话，命令共享环境和工作目录 |
| 文本编辑器 | `{"type": "text_editor_20250728", "name": "str_replace_based_edit_tool"}` | `view`、`create`、唯一匹配的 `str_replace`、`insert` |

**计算机工具集的 17 个成员：**
- **屏幕**：`screenshot`、`zoom`（按原分辨率截取局部，默认启用）
- **鼠标**：`left_click`、`right_click`、`middle_click`、`double_click`、`triple_click`、`left_click_drag`、`mouse_move`、`left_mouse_down`、`left_mouse_up`、`cursor_position`、`scroll`
- **键盘**：`type`、`key`（单键或如 `ctrl+s` 的组合，可重复 1–100 次）、`hold_key`（最长 300 秒）
- **时间**：`wait`（最长 300 秒）

所有成员默认开启。可通过 `configs` 映射逐个设置 `enabled` 和 `defer_loading`，关闭执行器未实现或任务无需使用的成员，以缩小权限。

### API 请求与响应形式

```python
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(  # GA: no beta header
    model="claude-sonnet-5-5",
    max_tokens=16000,
    tools=[
        # No name or display size: coordinates come from the screenshots you return.
        {"type": "computer_toolset_20260801",
         "configs": {"zoom": {"enabled": False}}},  # disable members you do not implement
        {"type": "bash_20250124", "name": "bash"},
        {"type": "text_editor_20250728", "name": "str_replace_based_edit_tool"},
    ],
    messages=[
        {"role": "user",
         "content": "Open Firefox, navigate to github.com, and find repos trending today."}
    ],
)
```

Claude 返回的 `tool_use` 块以成员名作为 `name`，并带有 `"toolset_name": "computer"`：

```json
{"type": "tool_use", "id": "toolu_01WkoTUvSHDzTBu2xnGk8Ep8", "name": "left_click",
 "toolset_name": "computer", "input": {"coordinate": [512, 742]}}
```

下一条用户消息须为每次调用返回一个 `tool_result`，并同样带上 `"toolset_name": "computer"`（缺少该字段会被拒绝）。只有 `screenshot` 和 `zoom` 需要图片，其余动作返回简短的 `OK` 即可。一批调用须按顺序执行；如果一项失败，后续每项都应返回 `is_error: true` 和文本 `Not executed: an earlier computer action in this turn failed.`。

**从测试版工具迁移时要注意：**
- 在 Claude API 和 Google Cloud 上，Opus 5.5、Sonnet 5.5 对旧的 `computer_20251124` 工具返回 HTTP 400；Amazon Bedrock 对两款模型仍接受它。两种形式不能放在同一次请求里。
- 动作从 `input.action` 移到了块的 `name`；旧执行器需要改写，而不只是替换类型名。
- `display_width_px`、`display_height_px` 和 `display_number` 会被拒绝。坐标对应客户返回的截图像素；API 不代为缩图，因此截图应预先符合模型图片限制：Opus 4.7 及之后的工具集模型长边不超过 2576 像素，更早模型不超过 1568 像素。
- 以 `claude-sonnet-4-20250514` 或 `claude-3-7-sonnet-20250219` 为目标的示例引用了已退役模型；它们使用的 `computer_20250124` 版本只支持 Claude Sonnet 4.5、Haiku 4.5 和更早模型。

### 浏览器工具集

`browser_toolset_20260801` 于 2026 年 8 月 19 日发布，仅适用于 Claude API 和 Google Cloud，不适用于 Bedrock、Claude Platform on AWS 或 Foundry。它驱动客户应用托管的浏览器，包含 31 个成员：默认开启 27 个，另有 4 个可选成员（`javascript_exec`、`file_upload`、`read_console`、`read_network`）。关键工具 `read_page` 返回带 `[ref_2]` 等元素引用的无障碍树（默认深度 15，最多 50,000 字符）。点击、悬停、`scroll_to`、`form_input` 和 `file_upload` 可使用引用定位，而不必使用坐标。

- **引用的价值**：页面布局、动画或分辨率变化可能让像素坐标失效，但引用可以适应。引用仅在一个标签页内有效，导航或重要 DOM 变化后会过期，应重新读取页面。
- **仍可使用像素**：canvas 内容以及没有无障碍名称的控件仍可使用截图加点击。
- **其他成员**：`find`、`get_page_text`、`form_input`、标签页管理（新建、列出、切换、关闭），以及报告标签页清单和下载等状态变化的 `browser_state` 块。
- **内置注入扫描**：Anthropic 的分类器扫描返回的网页文本和截图，识别提示注入，并引导模型确认指令是否真正来自用户（客户可联系支持选择退出）。

Anthropic 的安全指导也可当作最小权限清单：使用不含凭据的新浏览器配置文件；在网络层设置域名允许列表，阻断回环、链路本地及私有地址段；只允许 http/https URL；除非执行器已实现且任务确有需要，否则保持四个可选成员关闭。

---

## 架构：沙盒环境

计算机使用代理必须在隔离环境中运行。模型可以完全控制鼠标和键盘 -- 你不会希望它在你的生产工作站上这样做。

### 标准架构：Docker + VNC

```
+-----------------------------------------------------+
|  Docker Container                                   |
|                                                     |
|  Xvfb (Virtual X11) + Mutter (WM) + Tint2 (Panel)  |
|         |                                           |
|         v                                           |
|  +------------------+     +-------------------+     |
|  | Virtual Desktop  |---->| Screenshot Capture|     |
|  | 1280x800         |     | (scrot/maim)      |     |
|  | Firefox, apps    |     +--------+----------+     |
|  +------------------+              |                |
|                                    v                |
|                           +--------+----------+     |
|                           | Agent Runtime     |     |
|                           | - Calls Claude API|     |
|                           | - Executes actions|     |
|                           | - Manages loop    |     |
|                           +-------------------+     |
+-----------------------------------------------------+
```

### 托管替代方案

现在可以不自行运行显示环境：

| 选项 | 提供的能力 | 取舍 |
|------|------------|------|
| E2B 等沙箱服务 | 预装浏览器的临时 VM、截图与输入 API、自动清理 | 仍需自行负责代理循环与执行器 |
| Gemini Enterprise Computer Use 与 Shell 沙箱（2026 年 9 月 9 日正式发布） | VPC Service Controls、Private Service Connect 入站与出站、通过 Cloud KMS 使用 CMEK；空闲沙箱停止调度但保留文件系统状态，数秒内恢复 | 绑定 Google Cloud |
| OpenAI Agents API 托管浏览器（2026 年 9 月 29 日测试版） | OpenAI 运行浏览器与代理循环，按网站来源审批，登录过程不进入模型输入 | 测试期仅美国数据驻留且不支持 ZDR；若重要动作必须保证先确认，OpenAI 建议限制浏览器或使用客户自行控制的浏览器 |
| Cursor 自托管机器（2026 年 9 月 2 日） | 包括 Linux 和 Mac 工作机上计算机操作能力的云端编程代理，运行在自有机器或资源池 | 只适用于编程代理场景 |

### 关键环境组件

| 组件 | 用途 | 示例 |
|-----------|---------|---------|
| Xvfb | 虚拟 X11 显示服务器 | 在没有物理显示器的情况下创建 framebuffer（帧缓冲区） |
| Mutter/Xfwm | 窗口管理器 | 处理窗口定位、调整大小 |
| Tint2 | 任务面板 | 显示正在运行的应用程序 |
| xdotool | 输入注入 | 执行鼠标/键盘命令 |
| scrot/maim | 截图捕获 | 将显示快照保存为 PNG |

---

## 浏览器自动化与桌面自动化

| 维度 | 仅浏览器 | 完整桌面 |
|-----------|-------------|--------------|
| 范围 | 仅 Web 应用 | 任何 GUI（图形用户界面）应用程序 |
| 设置复杂度 | 较低（无头浏览器） | 较高（完整桌面环境） |
| 定位方式 | 无障碍树引用或 DOM，像素为后备 | 像素坐标，也可使用操作系统无障碍 API |
| 性能 | 更快（截图更小，可用文本读取页面） | 更慢（全屏捕获） |
| 可靠性 | 更高（布局可预测、引用稳定） | 更低（操作系统差异） |
| 使用场景 | Web 抓取、表单填写 | 遗留软件、跨应用工作流 |

浏览器自动化控制 Web 浏览器（导航、填写表单、点击按钮、处理 SPA（单页应用））。桌面自动化控制完整的 OS 环境（启动应用程序、使用原生对话框、与厚客户端软件交互、串联多个应用之间的操作）。

**基于引用的定位是 Web 工作可靠性的关键。** Anthropic 浏览器工具集优先使用无障碍树引用，GitHub Copilot computer use 也结合可访问的应用内容与视觉上下文。应用若提供无障碍树，就应使用它；纯像素控制留给 canvas、远程桌面和传统厚客户端。

---

## 与传统自动化的比较

Selenium、Playwright 和 Puppeteer 通过直接 DOM（文档对象模型）访问来自动化浏览器。计算机使用代理处理的是像素。两者在生产环境中都有用武之地。

| 功能 | Selenium/Playwright | 计算机使用代理 |
|---------|--------------------|--------------------|
| 速度 | 快（直接 DOM） | 慢（截图 + LLM（大语言模型）） |
| 可靠性 | 脆弱（选择器变化） | 有韧性（视觉识别） |
| 维护 | 持续更新选择器 | 最少（适应 UI（用户界面）变化） |
| 反机器人检测 | 经常被阻止 | 更难检测 |
| 每次操作成本 | 约 $0.001 | 约 $0.01–0.06（Sonnet 档模型；见[每次操作成本](#每次操作成本)） |
| 非 Web 支持 | 否 | 是（任何 GUI） |

**混合方法**在生产环境中效果最好：Playwright 处理高频、定义明确的流程（登录、导航），计算机操作代理处理动态、不可预测的步骤（视觉验证、新布局、反机器人站点）。浏览器工具集从另一侧缩小差距：代理可获得 DOM 级目标，而无需人工维护选择器。

---

## 计算机使用何时优于 API 调用

**在以下情况使用计算机使用：** 不存在 API（遗留系统）、反机器人保护阻止 Selenium、需要视觉判断（图表验证、PDF 布局）、UI 变化快于选择器维护速度，或工作流跨越多个桌面应用程序。

**在以下情况坚持使用 API：** 有结构化 API 可用（始终优先使用它）、延迟很重要（亚秒级）、操作量很高（每小时数千次操作），或需要确定性（相同输入、相同输出）。

---

## 错误处理与恢复

计算机使用代理的失败方式不同于基于 API 的工具。主要失败模式如下：

### 1. 误点（错误坐标）

模型根据截图计算坐标，但可能偏差几个像素：
- **缓解**：影响重大的点击后截图，验证是否发生预期变化；点击密集界面前使用 `zoom`，浏览器中优先使用元素引用而非像素。
- **恢复**：如果点击了错误元素，模型可以根据新状态推理并修正方向。

### 2. 过期截图

屏幕可能在捕获和执行操作之间发生变化（动画、弹窗、加载）：
- **缓解**：截图前增加短暂等待，页面加载时使用 `wait`；浏览器导航后重新读取页面，因为元素引用会过期。
- **恢复**：继续前重新捕获并重新评估。

### 3. 无限循环

模型重复相同操作且没有取得进展：
- **缓解**：根据任务规模设置最大迭代次数（表单填写约 50 步；OSWorld 2.0 的小时级任务使用 500 步预算），并在代理外强制费用上限。
- **恢复**：在 N 次重复相同操作后，强制使用不同方法或升级给人工处理。

### 4. 意外对话框

Cookie 横幅、弹窗、权限对话框意外出现：
- **缓解**：在 system prompt（系统提示词）中加入处理常见对话框的指令。
- **恢复**：模型的视觉推理通常能自然处理这些情况 -- 它会看到对话框并关闭它。

### 5. 分辨率与缩放不匹配

坐标对应发送给模型的截图像素空间。如果执行器将坐标注入到尺寸不同的显示器，所有点击都会偏移：
- **缓解**：显示缩放保持 100%，截图采用适中的分辨率（Anthropic 文档建议桌面任务用 1024x768 或 1280x720，Web 应用用 1280x800 或 1366x768，且不要超过 1920x1080）。macOS Retina 显示器要考虑两倍设备像素比。
- **恢复**：若为节省 token 或满足图片上限而缩小截图，注入鼠标输入前须按相同比例放大模型返回的坐标。

### 6. 部分批次失败

一批动作可能执行到一半失败，例如点击时恰好弹出模态框：
- **缓解**：按顺序执行，首次失败就停止，对后续调用返回停止文本，并重新截图。
- **恢复**：让模型基于新截图重新规划。不要自行“完成”剩余动作；它们针对的屏幕状态已不存在。

### 错误处理模式

代理循环应跟踪动作历史并检测重复。如果连续至少 3 次发出相同动作，应提示模型换一种方法。始终设置硬性最大迭代次数，并在重要动作后截图验证状态变化。完整循环见下方代码示例。

---

## 性能：延迟、成本、吞吐量

### 延迟拆解

代理循环的每次迭代都包含：

```
Screenshot capture:     ~100ms
Image encoding (base64): ~50ms
API call (with image):   ~2-5s  (model inference)
Action execution:        ~100ms
                        --------
Total per model turn:    ~2.5-5.5s  (a batch of several actions shares one turn)
```

不使用批量动作时，典型的 10 步任务耗时 25–55 秒；Playwright 完成相同 10 步不到 2 秒。长流程任务则是另一种量级：OpenAI 自报，GPT-6 Astra 在其 OSWorld 2.0 离线集上平均每任务约 40 分钟，GPT-5.6 Sol 约 75 分钟。

### 每次操作成本

每次动作都会发送新截图（Anthropic 文档估算每张约 1,000–1,800 个输入 token）和累积历史，因此计算机操作以输入成本为主，缓存输入价格比输出价格更重要。声明计算机工具集本身每次请求约增加 4,500 个输入 token（关闭 `zoom` 节省约 410 个），这是可由缓存吸收的固定前缀。

下列估算假设每步有约 25,000 token 既有上下文、1,500 个新截图 token、400 个输出 token（包括思考），按标价计算：

| 模型 | 每百万 token 标价（输入 / 输出 / 缓存读取） | 每动作，热缓存 | 每动作，无缓存 |
|------|----------------------------------------------|----------------|----------------|
| Claude Sonnet 5.5 | $2 / $10 / $0.20 | 约 $0.01 | 约 $0.06 |
| Claude Opus 5.5 | $4 / $20 / $0.20 | 约 $0.02 | 约 $0.11 |

一个 20 步工作流使用 Sonnet 5.5 约 $0.25–1.15，使用 Opus 5.5 约 $0.40–2.30，主要取决于缓存命中率。作比较，GPT-6 Astra 每百万 token 标价 $10/$50（缓存输入 $1），是 Opus 5.5 标价的 2.5 倍；Gemini 3.8 Flash 到 2026 年 12 月 31 日的入门价为 $0.75/$3.75（2027 年 1 月 1 日起为 $1.50/$7.50）。各供应商图片 token 计数不同，应使用自己的截图测量每动作成本，而非直接套用上述估算。

推理强度是另一个成本旋钮：Opus 5.5 默认 `medium`，Sonnet 5.5 默认 `high`，思考 token 按输出计费。

### 吞吐量优化

- **并行会话**：在多个沙箱中并发处理任务。
- **批量动作**：让模型在一次往返中连续执行可预测的步骤（点击、输入、回车），但每个动作执行前都要应用确认检查。
- **提示缓存**：保持系统提示和工具列表稳定，以便历史读取命中缓存。
- **选择性截图（Selective screenshots）**：只在不确定的操作后截图；输入文本后跳过截图。
- **降低分辨率**：用 1024x768 代替 1920x1080 来降低 token 成本，各边保持不超过 2000 像素，因为单次请求含超过 20 张图片时会采用更严格的单边限制。
- **服务端裁剪**：使用 API 的服务端工具结果清理（上下文编辑）移除旧截图，而不是在客户端改写历史。对 Fable 5.1、Opus 5.5 和 Sonnet 5.5，客户端删除早期截图会改变后续每个思考块绑定的前缀。2026 年 8 月 31 日或之后创建的账户（以及选择加入的旧账户）会因此收到 400；使用 `thinking-binding-controls-2026-08-01` 测试版头和 `thinking.block_binding.prefix_mismatch_behavior: "drop_block"` 时，则会丢弃这些思考块。
- **提前终止（Early termination）**：教会模型在目标验证完成后立即发出完成信号。

---

## 基准测试：如何解读数字

计算机操作分数会因基准版本、指标、推理强度及测试执行方而相差 30 个百分点甚至更多，引用时要问清四项。

| 基准 | 状态 | 衡量内容 |
|------|------|----------|
| OSWorld-Verified | 已趋饱和：自报领先分数约为 85% | 短时、单会话桌面任务 |
| OSWorld 2.0 / 2.1（XLANG Lab，2026 年 6 月，arXiv 2606.29537） | 当前长流程任务标尺 | 108 个任务，覆盖 31 个自托管网站和桌面应用；熟练人类每任务中位耗时约 1.6 小时；每任务约 27 个评分检查点；500 步预算。**二元完成率为主要指标**，部分完成分数另行报告 |

当前数字：
- **官方排行榜**（XLANG，更新于 2026 年 9 月 17 日）：Claude Opus 5 在最高推理强度、批量工具下，于 v2.1 全量集得到 44.33% 二元完成率和 77.67% 部分完成分数。小时级任务的二元完成率仍低于 50%。
- **供应商自报，仅部分完成分数**：Anthropic 报告 Opus 5.5 在“OSWorld 2.1”上达到 81.8%，未给出二元完成率；其自测 Opus 5 为 74.0%，与排行榜任何一行均不一致。OpenAI 报告 GPT-6 Astra 在其离线 v2026.08.08 集上为 72.6%，GPT-5.6 Sol 为 65.7%。
- **论文基线**（2026 年 6 月）：Claude Opus 4.8 在最高思考强度下二元完成率为 20.6%，部分完成分数为 54.8%。

Snorkel AI 对 OSWorld 2.0 运行的分析指出四类失败模式，各自对应可实施的控制：代理很少主动澄清缺失信息（提供澄清工具）；误读陌生应用（添加应用专用说明）；过早提交或不愿回退（提交前增加验证步骤）；在约 300 步的轨迹中丢失进度（把任务状态存放在上下文窗口外）。

容量规划应按二元完成率进行：一个流程即使通过了 80% 的检查点，也仍未完成工作。供应商改变服务端实现时也要重跑自身评估，而不只是模型 ID 变化时才重跑。2026 年 9 月 25 日，OpenAI 修复了在模型 ID 不变的情况下损害 GPT-6 Sol 和 Luna 图片理解（包括计算机操作）的图片编码问题，并通知客户重跑图片评估。

---

## 真实世界应用

| 应用 | 工作方式 | 为什么使用计算机使用能力 |
|------------|--------------|------------------|
| 遗留系统集成 | 智能体导航大型机/厚客户端 UI，将数据提取为结构化格式 | 遗留软件不存在 API |
| 表单填写 / 数据录入 | 读取源文档，逐字段填写网页表单，处理多页向导 | 政府门户、带有复杂条件逻辑的保险理赔 |
| QA 和视觉测试 | 像用户一样导航应用，验证视觉渲染，用自然语言报告问题 | 超越像素差异比较 -- 能理解布局和用户体验 |
| 代码变更的视觉证据 | 编程代理运行应用、截图并附在 PR 中 | 审查者无需检出分支就能看到界面（下方 PixelLeak 展示了这种做法的风险） |
| 竞争情报 | 导航产品页面，从 JS 渲染的小组件中捕获价格数据 | 适用于阻止传统爬虫的网站 |
| 持久化个人与职场代理 | 拥有独立云端计算机、始终在线的代理在请求之间跨应用工作（OpenAI dots、Meta Muse、Copilot Autopilot） | 它接触的大多数应用没有代理 API；见[用例与案例研究](06-use-cases-and-case-studies.md) |

---

## 安全注意事项

| 风险 | 会发生什么 | 缓解措施 |
|------|-------------|------------|
| **可见密钥** | 模型在截图中看到密码、会话、通知 | 临时容器、没有已保存凭据的新浏览器配置文件、通过模型无法读取的渠道登录（OpenAI Agents API 使用独立登录 UI） |
| **不受限制的操作** | 代理可以运行 shell 命令、任意导航、下载文件 | 防火墙、只读文件系统、会话时间限制、关闭任务无需使用的工具集成员；每个重要动作执行前人工确认，包括批次中间的动作 |
| **数据外泄** | 发送给 LLM 提供商的截图包含敏感数据 | 受监管行业采用本地部署，遮蔽敏感 UI 字段 |
| **截图泄露** | 代理通过未被禁止的渠道发布截图。PixelLeak（Glow Security，2026 年 9 月 29 日）发现逾 900 个公开仓库中有 13,000 多张内部截图；原因是编程代理被要求为私有 PR 提供视觉证据，却创建公开仓库存放截图 | 在动作层制定目的地策略：阻断或标记新建公开仓库、推送到个人账户和 gist、改变可见性的行为 |
| **通过 UI 进行提示注入** | 恶意网站显示文本来操纵代理 | 使用供应商提供的扫描（Anthropic 浏览器工具集自动启用；Gemini computer use 可选开启、默认关闭）、注入文本无法满足的确认关口和网络允许列表；单靠系统提示警告不构成控制 |
| **可达内网** | 代理访问回环地址、云元数据或私有服务 | 网络层域名允许列表阻断回环、链路本地和私有地址段；只允许 http/https |

Gemini 安全服务也提供了现成的确认风险分类：金融交易、敏感数据修改、通信工具、账户创建、数据修改、用户同意管理，以及法律条款和协议。

核心规则：**除非处于完全沙箱化的容器中，否则不要在生产工作站上运行计算机操作代理，也不要让其接触真实凭据**。完整的纵深防御设计见[安全与治理](07-safety-and-governance.md)。

---

## 代码示例

### 最小智能体循环

```python
import anthropic, base64, subprocess

client = anthropic.Anthropic()
HALT = "Not executed: an earlier computer action in this turn failed."

def capture_screenshot() -> str:
    # Capture at the size you map clicks into: the toolset takes no display
    # dimensions, and the API does not downscale for you.
    subprocess.run(["scrot", "-o", "/tmp/screen.png"], check=True)
    with open("/tmp/screen.png", "rb") as f:
        return base64.standard_b64encode(f.read()).decode()

def xdo(*args: str) -> None:
    subprocess.run(["xdotool", *args], check=True)

def run_member(name: str, args: dict) -> None:
    """Execute one computer-toolset member. Raises on failure."""
    if name in ("left_click", "right_click", "middle_click", "double_click", "triple_click"):
        if "coordinate" in args:
            x, y = args["coordinate"]
            xdo("mousemove", str(x), str(y))
        button = {"right_click": "3", "middle_click": "2"}.get(name, "1")
        repeat = {"double_click": "2", "triple_click": "3"}.get(name, "1")
        xdo("click", "--repeat", repeat, button)
    elif name == "type":
        xdo("type", "--", args["text"])
    elif name == "key":
        xdo("key", "--repeat", str(args.get("repeat", 1)), args["text"])
    elif name != "screenshot":  # scroll, drag, wait, ... omitted for brevity
        raise NotImplementedError(name)

def run_agent(task: str, max_turns: int = 30):
    messages = [{"role": "user", "content": task}]
    tools = [
        {"type": "computer_toolset_20260801", "configs": {"zoom": {"enabled": False}}},
        {"type": "bash_20250124", "name": "bash"},
    ]
    for _ in range(max_turns):
        response = client.messages.create(
            model="claude-sonnet-5-5", max_tokens=16000, tools=tools, messages=messages,
        )
        if response.stop_reason != "tool_use":  # end_turn, refusal, max_tokens
            return response
        # Check every block in the batch against your confirmation policy here,
        # before any of them runs: a consequential action can sit mid-batch.
        results, failed = [], False
        for block in response.content:
            if block.type != "tool_use":
                continue
            if getattr(block, "toolset_name", None) == "computer":
                result = {"type": "tool_result", "tool_use_id": block.id,
                          "toolset_name": "computer"}
                if failed:
                    result.update(is_error=True, content=HALT)
                else:
                    try:
                        run_member(block.name, block.input)
                        if block.name == "screenshot":
                            result["content"] = [{"type": "image", "source": {
                                "type": "base64", "media_type": "image/png",
                                "data": capture_screenshot()}}]
                        else:
                            result["content"] = [{"type": "text", "text": "OK"}]
                    except Exception as e:
                        failed = True  # halt the rest of the batch
                        result.update(is_error=True, content=f"Error: {e}")
                results.append(result)
            elif block.name == "bash":
                if failed:  # do not run later blocks after a failure
                    results.append({"type": "tool_result", "tool_use_id": block.id,
                                    "is_error": True, "content": "Not executed: an earlier action failed."})
                    continue
                r = subprocess.run(block.input.get("command", ""), shell=True,
                                   capture_output=True, text=True, timeout=60)
                results.append({"type": "tool_result", "tool_use_id": block.id,
                                "content": (r.stdout + r.stderr) or "(no output)"})
        # Append the assistant turn unchanged (thinking blocks included).
        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": results})
    raise RuntimeError("Max turns reached")
```

### 沙盒环境的 Dockerfile

```dockerfile
FROM debian:trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb mutter tint2 xdotool scrot firefox-esr python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/agent && /opt/agent/bin/pip install "anthropic>=1,<2"
RUN useradd --create-home agent
USER agent
ENV DISPLAY=:1
COPY agent.py /home/agent/agent.py
CMD Xvfb :1 -screen 0 1280x800x24 & sleep 1 && mutter & tint2 & \
    sleep 1 && /opt/agent/bin/python /home/agent/agent.py
```

---

## 面试题

### 问：一个客户每天有 500 份保险理赔 PDF，必须录入到一个没有 API 的遗留 Web 门户中。请设计一个使用计算机使用智能体的系统。

**优秀回答：**
我会构建三阶段流水线。第一阶段用 LLM 从 PDF 提取理赔编号、索赔人姓名、金额和日期。第二阶段让隔离容器中的 Claude 计算机操作代理处理每份理赔，并提供虚拟显示器。因为目标是 Web 门户，我会用浏览器工具集的无障碍树引用定位表单字段，而非像素坐标；确认关口在批次动作运行前逐项检查，确保批次中间的提交点击也会等待批准。提交后代理捕获确认截图。第三阶段使用独立的 LLM 调用，将截图与预期数据比对，发现录入错误。

并行运行多个沙箱，每个顺序处理理赔。按每份约 2 分钟计算，一个沙箱在 8 小时内约可处理 240 份，三个沙箱足以覆盖稳定流量；我会部署 5–10 个，为重试、门户慢页面和月底峰值留出余量。重试三次仍失败的理赔进入死信队列，由人工审核。

按 Sonnet 5.5 标价，20 次动作、每次约 $0.01–0.06（热缓存与冷缓存）估算，每份理赔约 $0.25–1.15，500 份每天约 $125–575。保持提示前缀稳定、让历史读取命中缓存是最大的成本杠杆；即使区间上端，也可能低于被替代的人工录入成本。

### 问：比较计算机使用智能体与 Selenium 在 Web 自动化中的差异。你会在什么情况下选择各自？

**优秀回答：**
Selenium 直接与 DOM 交互 -- 它快速、确定性强且成本低。但当选择器变化时它会失效，会被反机器人系统阻拦，也无法处理需要视觉判断的任务。

计算机操作代理每个动作约慢 100 倍、贵 10–60 倍，但能适应 UI 变化，因为它们处理渲染结果而非选择器。类似人类的交互模式也更能应对反机器人检测；它们还能判断视觉布局，例如验证图表渲染或读取 Selenium 无法检查的 canvas 内容。如今基于无障碍树引用的浏览器工具集，让代理无需维护选择器就能获得部分 Selenium 的定位精度。

对于高容量、稳定且目标网站在我控制之下的工作流，我会选择 Selenium。对于一次性任务、经常变化的第三方网站、跨应用的桌面工作流，以及任何维护选择器的人力成本高于 LLM 推理成本的任务，我会选择计算机使用智能体。

最好的生产系统会同时使用两者：Playwright 处理可预测步骤（身份验证、导航），计算机使用智能体处理动态步骤（解释结果、做出判断）。

### 问：供应商说其计算机操作模型在 OSWorld 上达到 81.8%。如何据此制定生产容量计划？

**优秀回答：**
先弄清数字的口径。是哪版基准？OSWorld-Verified 已在 85% 左右饱和，参考价值有限；OSWorld 2.x 衡量小时级任务。是哪种指标？81.8% 是 Anthropic 自报的 Opus 5.5 在 OSWorld 2.1 上的部分完成分数，可能比二元完成率高 30 个百分点以上；官方排行榜 v2.1 全量集的最高二元完成率为 44.33%（Opus 5、最高推理强度、批量工具）。还要问推理强度、运行框架以及谁执行评估：供应商自测与排行榜结果不一致，Anthropic 自测的 Opus 5 分数 74.0% 也对不上任何排行榜行。

随后应忽略标题数字，在自身应用上评估 50–100 个真实任务，以独立检查衡量二元完成率，同时记录每个完成任务耗费的分钟数和金额。如果二元完成率约 45%，上线规划应采用人工介入系统而非自主系统：人工升级队列最初要能覆盖超过一半的任务量，由代理做准备，再由人工完成或批准。

最后把评估作为持续流程。即便模型 ID 未变，服务端变更也会影响结果，例如 OpenAI 2026 年 9 月修复 GPT-6 Sol 和 Luna 的图片编码问题。因此应定期评估，并在供应商通知变更后重跑，而不只在选模型时评估。

---

## 参考资料

- Anthropic。`computer_toolset_20260801` 计算机操作 API 文档（2026）
- Anthropic。`browser_toolset_20260801` 浏览器操作 API 文档（2026）
- Anthropic。Bash Tool 和 Text Editor Tool API 文档
- Google。Gemini API computer use 文档（2026）
- OpenAI。《Introducing the Agents API》（2026 年 9 月）
- E2B。《面向 AI Agent（智能体）的沙盒化云环境》 (2025)
- XLANG Lab 等。《OSWorld 2.0》（arXiv 2606.29537，2026 年 6 月）及 osworld-v2.xlang.ai 官方排行榜
- WebArena 基准测试：Web Agent（智能体）评估套件 (2024)
- Glow Security。《How AI agents exposed developer screenshots from leading tech companies》（PixelLeak，2026 年 9 月）

---

*下一篇：[构建工具使用型 Agent（智能体）](05-building-tool-agents.md)*
