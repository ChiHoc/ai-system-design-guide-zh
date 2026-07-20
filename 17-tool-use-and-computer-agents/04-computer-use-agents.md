# 计算机使用智能体

计算机使用智能体（Computer-use agents）让 LLM（大语言模型）看到屏幕、对其进行推理，并通过鼠标点击和键盘敲击执行操作——就像人类操作计算机一样。模型不是调用结构化 API，而是处理原始像素。本章介绍它们如何工作、何时优于传统自动化，以及如何围绕它们设计生产系统。

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

多个提供商现在都提供计算机使用能力：

| 提供商 | 智能体 | 方法 | 关键优势 |
|----------|-------|----------|--------------|
| Anthropic | Claude 计算机使用 | 视觉 + 坐标推理 | 桌面 + 浏览器，成熟 API |
| OpenAI | ChatGPT 智能体模式 | 基于 Operator 的浏览器智能体 | 深度网页导航 |
| Google | Project Mariner | Gemini 视觉语言 | Chrome 集成 |
| Microsoft | UFO/UFO2 | Windows UI 自动化 + 视觉 | 原生 Windows 支持 |
| Amazon | Nova Act | 专用浏览器模型 | 电子商务工作流 |

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
|  action           |           |
+--------+---------+            |
         |                      |
    +----+----+                 |
    |         |                 |
    v         v                 |
 [Action]  [Done]               |
    |                           |
    v                           |
+------------------+            |
| Execute Action   |            |
| (click, type,    |            |
|  scroll, key)    |            |
+--------+---------+            |
         |                      |
         +----------------------+
```

每次迭代：
1. **捕获**：截取当前显示状态的截图。
2. **发送**：将截图（base64 图像）和对话历史传给 LLM。
3. **推理**：模型分析屏幕上的内容，确定朝目标前进的下一步。
4. **行动**：模型输出一个工具调用（例如，`click at (450, 320)`），运行时执行该调用。
5. **重复**：捕获新截图，循环继续，直到模型发出完成信号。

模型通过对话历史在迭代之间维护上下文，对话历史会累积截图和操作，就像一份关于已发生内容的可视“记忆”。

---

## Claude 计算机使用：工具和 API

Claude 暴露三个用于计算机使用的内置工具。这些是 Anthropic 定义的工具——你不需要编写实现；Claude 知道如何生成对它们的调用，而你的运行时会在环境中执行这些调用。

### 三个工具

**1. `computer`——完整 GUI 控制**

在虚拟显示器上控制鼠标和键盘。能力包括：
- `screenshot`——捕获当前屏幕状态
- `left_click`、`right_click`、`double_click`、`triple_click`——在坐标处执行鼠标点击
- `left_click_drag`——从一个点拖拽到另一个点
- `type`——输入一串文本
- `key`——按下键盘按键（例如，`ctrl+c`、`Return`、`Escape`）
- `scroll`——在某个坐标处向上/向下/向左/向右滚动
- `move`——将光标移动到坐标
- `hold_key`——在执行另一个操作时按住修饰键
- `wait`——暂停指定时长

**2. `bash`——Shell 命令执行**

在持久会话中运行 Shell 命令：
- 命令共享状态（环境变量、工作目录）
- 支持多行脚本
- 输出会被捕获并作为文本返回

**3. `text_editor`——文件操作**

使用命令进行结构化文件编辑：
- `view`——读取文件内容（可选行范围）
- `create`——创建包含内容的新文件
- `str_replace`——替换文件中的特定字符串（必须是唯一匹配）
- `insert`——在特定行号插入文本

### API 请求结构

```python
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=4096,
    tools=[
        {
            "type": "computer_20250124",
            "name": "computer",
            "display_width_px": 1280,
            "display_height_px": 800,
            "display_number": 1
        },
        {
            "type": "bash_20250124",
            "name": "bash"
        },
        {
            "type": "text_editor_20250124",
            "name": "str_replace_based_edit_tool"
        }
    ],
    messages=[
        {
            "role": "user",
            "content": "Open Firefox, navigate to github.com, and find repos trending today."
        }
    ],
    betas=["computer-use-2025-01-24"]
)
```

响应将包含 `tool_use` 块，你的运行时必须执行这些块，并将结果作为 `tool_result` 消息反馈。

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

### 云托管替代方案

E2B（e2b.dev）等服务提供预配置的沙盒环境：
- 预装浏览器和工具的临时 VM（虚拟机）
- 用于截图捕获和输入注入的 API（应用程序编程接口）
- 会话结束后自动清理
- 无需管理 Docker 的额外开销

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
| 性能 | 更快（截图更小） | 更慢（全屏捕获） |
| 可靠性 | 更高（布局可预测） | 更低（OS（操作系统）差异） |
| 使用场景 | Web 抓取、表单填写 | 遗留软件、跨应用工作流 |

浏览器自动化控制 Web 浏览器（导航、填写表单、点击按钮、处理 SPA（单页应用））。桌面自动化控制完整的 OS 环境（启动应用程序、使用原生对话框、与厚客户端软件交互、串联多个应用之间的操作）。

---

## 与传统自动化的比较

Selenium、Playwright 和 Puppeteer 通过直接 DOM（文档对象模型）访问来自动化浏览器。计算机使用代理处理的是像素。两者在生产环境中都有用武之地。

| 功能 | Selenium/Playwright | 计算机使用代理 |
|---------|--------------------|--------------------|
| 速度 | 快（直接 DOM） | 慢（截图 + LLM（大语言模型）） |
| 可靠性 | 脆弱（选择器变化） | 有韧性（视觉识别） |
| 维护 | 持续更新选择器 | 最少（适应 UI（用户界面）变化） |
| 反机器人检测 | 经常被阻止 | 更难检测 |
| 每次操作成本 | ~$0.001 | ~$0.01-0.05 |
| 非 Web 支持 | 否 | 是（任何 GUI） |

**混合方法**在生产环境中效果最好：Playwright 处理高频、定义明确的流程（登录、导航），而计算机使用代理处理动态、不可预测的步骤（视觉验证、新布局、反机器人站点）。

---

## 计算机使用何时优于 API 调用

**在以下情况使用计算机使用：** 不存在 API（遗留系统）、反机器人保护阻止 Selenium、需要视觉判断（图表验证、PDF 布局）、UI 变化快于选择器维护速度，或工作流跨越多个桌面应用程序。

**在以下情况坚持使用 API：** 有结构化 API 可用（始终优先使用它）、延迟很重要（亚秒级）、操作量很高（每小时数千次操作），或需要确定性（相同输入、相同输出）。

---

## 错误处理与恢复

计算机使用代理的失败方式不同于基于 API 的工具。主要失败模式如下：

### 1. 误点（错误坐标）

模型根据截图计算坐标，但可能偏差几个像素：
- **缓解**：每次点击后使用 `screenshot` 验证是否发生了预期的状态变化。
- **恢复**：如果点击了错误元素，模型可以根据新状态推理并修正方向。

### 2. 过期截图

屏幕可能在捕获和执行操作之间发生变化（动画、弹窗、加载）：
- **缓解**：截图前增加短暂等待。页面加载时使用 `wait` 操作。
- **恢复**：继续前重新捕获并重新评估。

### 3. 无限循环

模型重复相同操作且没有取得进展：
- **缓解**：设置最大迭代次数（例如每个任务 50 次操作）。
- **恢复**：在 N 次重复相同操作后，强制使用不同方法或升级给人工处理。

### 4. 意外对话框

Cookie 横幅、弹窗、权限对话框意外出现：
- **缓解**：在 system prompt（系统提示词）中加入处理常见对话框的指令。
- **恢复**：模型的视觉推理通常能自然处理这些情况 -- 它会看到对话框并关闭它。

### 5. 分辨率与缩放不匹配

模型在特定分辨率下训练。不匹配会导致坐标错误：
- **缓解**：使用推荐分辨率（1280x800），显示缩放设置为 100%。
- **恢复**：调整 `display_width_px` 和 `display_height_px` 以匹配实际显示。

### 错误处理模式

代理循环应跟踪操作历史并检测重复。如果连续 3+ 次发出相同操作，则注入一条消息，告诉模型尝试不同方法。始终设置硬性最大迭代次数（例如 50），并在每次操作后捕获验证截图以检测状态变化。参见下方代码示例部分中的完整代理循环。

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
Total per action:        ~2.5-5.5s
```

一个典型的 10 步任务需要 25-55 秒。相比之下，Playwright 可以在 2 秒内完成相同的 10 步。

### 每次操作成本

每次操作都会发送一张截图（约 800KB base64）以及对话历史：

| 模型 | 每次操作成本（约） | 备注 |
|-------|-------------------------|-------|
| Claude Sonnet 4 | $0.01-0.03 | 推荐用于大多数任务 |
| Claude Opus 4 | $0.05-0.15 | 用于复杂视觉推理 |

一个 20 步工作流使用 Sonnet 的成本约为 $0.20-0.60，使用 Opus 的成本约为 $1.00-3.00。

### 吞吐量优化

- **并行会话（Parallel sessions）**：运行多个 Docker 容器来处理并发任务。
- **选择性截图（Selective screenshots）**：只在不确定的操作后截图；输入文本后跳过截图。
- **降低分辨率（Resolution reduction）**：使用 1024x768 而不是 1920x1080，以降低 token 成本。
- **提前终止（Early termination）**：教会模型在目标验证完成后立即发出完成信号。

---

## 真实世界应用

| 应用 | 工作方式 | 为什么使用计算机使用能力 |
|------------|--------------|------------------|
| 遗留系统集成 | 智能体导航大型机/厚客户端 UI，将数据提取为结构化格式 | 遗留软件不存在 API |
| 表单填写 / 数据录入 | 读取源文档，逐字段填写网页表单，处理多页向导 | 政府门户、带有复杂条件逻辑的保险理赔 |
| QA 和视觉测试 | 像用户一样导航应用，验证视觉渲染，用自然语言报告问题 | 超越像素差异比较 -- 能理解布局和用户体验 |
| 竞争情报 | 导航产品页面，从 JS 渲染的小组件中捕获价格数据 | 适用于阻止传统爬虫的网站 |

---

## 安全注意事项

| 风险 | 会发生什么 | 缓解措施 |
|------|-------------|------------|
| **可见密钥** | 模型在截图中看到密码、会话、通知 | 临时容器，使用后清除凭据 |
| **不受限制的操作** | 智能体可以运行 shell 命令、任意导航、下载文件 | 防火墙规则、只读文件系统、会话时间限制、破坏性操作引入人工介入（HITL） |
| **数据外泄** | 发送给 LLM 提供商的截图包含敏感数据 | 受监管行业采用本地部署，遮蔽敏感 UI 字段 |
| **通过 UI 进行提示注入** | 恶意网站显示文本来操纵智能体 | 在系统提示中警告不要遵循与任务矛盾的屏幕指令 |

核心规则：**除非在完全沙盒化的容器中，否则绝不要在生产工作站上运行计算机使用智能体，也不要让其访问真实凭据**。

---

## 代码示例

### 最小智能体循环

```python
import anthropic, base64, subprocess

client = anthropic.Anthropic()

def capture_screenshot():
    subprocess.run(["scrot", "/tmp/screen.png", "-o"], check=True)
    with open("/tmp/screen.png", "rb") as f:
        return base64.standard_b64encode(f.read()).decode()

def execute_action(action):
    name = action["action"]
    if name == "left_click":
        x, y = action["coordinate"]
        subprocess.run(["xdotool", "mousemove", str(x), str(y), "click", "1"])
    elif name == "type":
        subprocess.run(["xdotool", "type", "--", action["text"]])
    elif name == "key":
        subprocess.run(["xdotool", "key", action["text"]])

def run_agent(task: str, max_steps: int = 30):
    messages = [{"role": "user", "content": task}]
    tools = [
        {"type": "computer_20250124", "name": "computer",
         "display_width_px": 1280, "display_height_px": 800},
        {"type": "bash_20250124", "name": "bash"},
        {"type": "text_editor_20250124", "name": "str_replace_based_edit_tool"},
    ]
    for step in range(max_steps):
        response = client.messages.create(
            model="claude-sonnet-4-20250514", max_tokens=4096,
            tools=tools, messages=messages, betas=["computer-use-2025-01-24"],
        )
        if response.stop_reason == "end_turn":
            return [b.text for b in response.content if b.type == "text"]

        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            if block.name == "computer":
                execute_action(block.input)
                tool_results.append({
                    "type": "tool_result", "tool_use_id": block.id,
                    "content": [{"type": "image", "source": {
                        "type": "base64", "media_type": "image/png",
                        "data": capture_screenshot()}}],
                })
            elif block.name == "bash":
                r = subprocess.run(block.input["command"],
                    shell=True, capture_output=True, text=True)
                tool_results.append({
                    "type": "tool_result", "tool_use_id": block.id,
                    "content": r.stdout + r.stderr,
                })
        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": tool_results})
    return ["Max steps reached"]
```

### 沙盒环境的 Dockerfile

```dockerfile
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y \
    xvfb mutter tint2 xdotool scrot firefox-esr python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*
RUN pip3 install anthropic
ENV DISPLAY=:1
COPY agent.py /agent.py
CMD Xvfb :1 -screen 0 1280x800x24 & sleep 1 && mutter & tint2 & \
    sleep 1 && python3 /agent.py
```

---

## 面试题

### 问：一个客户每天有 500 份保险理赔 PDF，必须录入到一个没有 API 的遗留 Web 门户中。请设计一个使用计算机使用智能体的系统。

**优秀回答：**
我会构建一个包含三个阶段的流水线。第一阶段是文档处理阶段，使用 LLM 从 PDF 中提取结构化数据（理赔编号、索赔人姓名、金额、日期）。第二阶段是计算机使用智能体阶段，每一份理赔由一个运行在隔离 Docker 容器中的 Claude Computer Use 智能体处理，并配备虚拟显示器。智能体导航 Web 门户，使用提取的数据填写表单字段，并在提交后捕获确认截图。第三阶段是验证阶段，使用一次独立的 LLM 调用，将确认截图与预期数据进行比较，以捕获任何录入错误。

对于规模化处理，我会并行运行 10-20 个容器，每个容器顺序处理理赔。按智能体每份理赔大约 2 分钟计算，20 个容器可以在每天 8 小时内处理 600 份理赔。我会为重试 3 次后仍失败的理赔添加死信队列，并交由人工审核。

按每份理赔 $0.50 的成本计算（大约 20 次操作，每次 $0.025），500 份理赔每天成本为 $250 -- 很可能低于它所替代的人工数据录入团队成本。

### 问：比较计算机使用智能体与 Selenium 在 Web 自动化中的差异。你会在什么情况下选择各自？

**优秀回答：**
Selenium 直接与 DOM 交互 -- 它快速、确定性强且成本低。但当选择器变化时它会失效，会被反机器人系统阻拦，也无法处理需要视觉判断的任务。

计算机使用智能体每个操作慢 100 倍、贵 10 倍，但它们能够适应 UI 变化，因为它们处理的是像素而不是选择器。它们能更好地应对反机器人检测，因为它们生成类似人类的交互模式。并且它们可以对视觉布局进行推理 -- 例如验证图表是否正确渲染，或读取 Selenium 无法检查的 canvas 元素中的内容。

对于高容量、稳定且目标网站在我控制之下的工作流，我会选择 Selenium。对于一次性任务、经常变化的第三方网站、跨应用的桌面工作流，以及任何维护选择器的人力成本高于 LLM 推理成本的任务，我会选择计算机使用智能体。

最好的生产系统会同时使用两者：Playwright 处理可预测步骤（身份验证、导航），计算机使用智能体处理动态步骤（解释结果、做出判断）。

---

## 参考资料

- Anthropic。《Computer Use Tool（计算机使用工具）》API 文档 (2025)
- Anthropic。《Bash Tool（Bash 工具）》和《Text Editor Tool（文本编辑器工具）》API 文档 (2025)
- E2B。《面向 AI Agent（智能体）的沙盒化云环境》 (2025)
- OSWorld 基准测试：桌面 Agent（智能体）评估套件 (2025)
- WebArena 基准测试：Web Agent（智能体）评估套件 (2024)

---

*下一篇：[构建工具使用型 Agent（智能体）](05-building-tool-agents.md)*
