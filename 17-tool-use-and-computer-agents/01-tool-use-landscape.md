# 2026 Tool-Use（工具调用）与 Computer Agent（计算机代理）格局

AI Agent 与外界交互的方式已发生了重大转变。到 2024 年，"tool use" 通常意味着模型输出一段 JSON function call，由你的后端执行。如今我们已经拥有成熟的 autonomous agents（自主代理），能够克隆仓库、运行 shell 命令、通过截图控制桌面，以及在 WhatsApp 上发消息，而这一切都可通过 MCP 等标准化协议进行编排。本章梳理了这些工具的格局、其架构，以及区分它们的关键设计决策。

## 目录

- [Ecosystem Overview](#ecosystem-overview)
- [Category Taxonomy](#category-taxonomy)
- [OpenClaw: The Viral Personal AI Agent](#openclaw-the-viral-personal-ai-agent)
- [OpenHands: Autonomous Developer Agent](#openhands-autonomous-developer-agent)
- [Open Interpreter: Local Code Execution](#open-interpreter-local-code-execution)
- [Claude Computer Use: Vision-Based Automation](#claude-computer-use-基于视觉的自动化)
- [Claude Code: The Terminal Agent](#claude-code-终端代理)
- [IDE Agents: Cursor, Windsurf, Cline](#ide-agents-cursor、windsurf、cline)
- [Comparison Matrix](#对比矩阵)
- [Market Trends and Adoption (2026)](#市场趋势与采用情况-2026)
- [System Design Interview Angle](#系统设计面试角度)
- [Interview Questions](#面试问题)
- [References](#参考资料)

---

## Ecosystem Overview

2026 年的工具调用生态已形成五类部署方式，分别针对不同程度的自主性、安全性和集成深度优化。MCP 服务器与消息桥接层将它们连接起来：

```
+-----------------------------------------------------------------------+
|                        2026 Tool-Use Ecosystem                        |
+-----------------------------------------------------------------------+
|                                                                       |
|  +-------------------+  +-------------------+  +-------------------+  |
|  |  LOCAL AGENTS     |  |  CLOUD AGENTS     |  |  IDE AGENTS       |  |
|  |                   |  |                   |  |                   |  |
|  |  OpenClaw         |  |  Claude Code      |  |  Cursor           |  |
|  |  Open Interpreter |  |  OpenAI Codex     |  |  Windsurf         |  |
|  |  OpenHands (local)|  |  OpenHands Cloud  |  |  Cline            |  |
|  |  OpenCode         |  |  Google Jules     |  |  GitHub Copilot   |  |
|  +-------------------+  +-------------------+  +-------------------+  |
|                                                                       |
|  +-------------------+  +-------------------+  +-------------------+  |
|  |  COMPUTER-USE     |  |  MCP SERVERS      |  |  MESSAGING AGENTS |  |
|  |                   |  |                   |  |                   |  |
|  |  Claude computer  |  |  10,000+ servers  |  |  OpenClaw (multi) |  |
|  |  and browser tools|  |  TS SDK v1: ~232M |  |  Custom bots      |  |
|  |  Gemini 3.8 Flash |  |  npm downloads    |  |  via MCP bridges  |  |
|  |  Copilot (preview)|  |  (Sep 2026)       |  |                   |  |
|  +-------------------+  +-------------------+  +-------------------+  |
|                                                                       |
|  +-------------------+  +------------------------------------------+  |
|  |  MANAGED HARNESS  |  |  PERSISTENT AGENTS (own VM and identity) |  |
|  |                   |  |                                          |  |
|  |  Claude Managed   |  |  OpenAI dots, Meta Muse,                 |  |
|  |  Agents, OpenAI   |  |  Copilot Autopilot (private preview),    |  |
|  |  Agents API       |  |  Cursor Projects (beta)                  |  |
|  +-------------------+  +------------------------------------------+  |
+-----------------------------------------------------------------------+
```

2026 年的关键洞察在于这些类别正在趋同。Claude Code 是在本地运行的云端代理；OpenClaw 是连接云端 LLM 的本地代理；Cursor 的云端代理（原 Background Agents）如今也能运行在用户自己的机器上。到 2026 年 9 月，前沿模型实验室已把代理运行框架作为托管服务出售，消费级产品则为每个代理分配独立的计算机和身份。边界正逐渐模糊，真正重要的是底层的**架构模式**（下一章详述）。

---

## Category Taxonomy

### 1. Local Agents（自托管、用户可控的代理）

在用户本机上运行的代理。LLM 调用可能走云端，但代理进程、memory（记忆）与 tool execution（工具执行）均在本地。

**Key properties:**
- 用户机器上拥有完整文件系统访问权限
- 持久化 memory（记忆）保存在本地（SQLite、JSON、Markdown）
- 用户拥有全部数据；无供应商锁定
- 安全责任完全由操作者承担

**Examples:** OpenClaw、Open Interpreter、本地 OpenHands 部署，以及 OpenCode 等开源终端运行框架（MIT 许可；截至 2026 年 10 月 1 日约 21.1 万 GitHub stars）

### 2. Cloud Agents（供应商托管、API 驱动）

在供应商管理的云环境中运行的代理。代码执行发生在沙箱化 VM 或容器中。

**Key properties:**
- 沙箱化执行（Docker、Firecracker VMs、E2B）
- 无本地文件系统访问（在克隆的仓库上工作）
- 供应商负责扩缩容、安全与基础设施
- 按量计费或订阅定价

**Examples:** Claude Code（云端模式）、OpenAI Codex（自 2026 年 9 月 29 日 DevDay 起支持可复用云端环境）、Google Jules、OpenHands Cloud

沙箱如今不一定由供应商托管。Claude Code 自托管运行器（Team 与 Enterprise，v2.1.224，2026 年 8 月）、Cursor Self-hosted Machines（2026 年 9 月 2 日）和 OpenAI Agents API 的自托管环境都保留供应商控制平面，同时让工具执行、凭据和出站流量留在客户边界内。

### 3. IDE Agents（编辑器集成、上下文感知）

直接嵌入代码编辑器的代理。它们深度理解项目结构、打开的文件与编辑器状态。

**Key properties:**
- 与编辑器 UI 深度集成（inline diffs、tab completion）
- 通过 embedding（嵌入）或 AST parsing（抽象语法树解析）进行代码库索引
- 后台代理可在分支上异步工作
- 为开发者工作流优化，而非通用自动化

**Examples:** Cursor（Agent Mode、云端代理、Projects）、Windsurf（Cascade）、Cline、GitHub Copilot、Google Antigravity（包含 Antigravity 2.0 多代理应用、IDE、CLI 和 SDK 的产品系列；自 2026 年 8 月 20 日起纳入符合条件的 Gemini Enterprise 订阅）。Google 将 Antigravity CLI 定位为 Gemini CLI 的后继者，但 Gemini CLI 仍在维护（2026 年 9 月 29 日发布 v0.62.0）。

**固定托管代理版本。** Google 于 2026 年 9 月 17 日以 `antigravity-preview-09-2026` 替代 `antigravity-preview-05-2026`，距离旧版 10 月 5 日停用只有约三周。内置工具参数由 snake_case 改为 PascalCase，文件编辑改为按行范围替换，导致在本地执行内置工具或解析其调用的代码失效。应固定带日期的代理版本，并在 CI 中对工具 schema 做契约测试。

### 4. Computer-Use Agents（基于视觉、GUI 驱动）

像人类一样与软件交互的代理：通过查看截图并执行点击。

**Key properties:**
- Model（模型）看到截图，并决策鼠标/键盘动作
- 可与任何应用配合使用（无需 API）
- 延迟更高（截图—动作循环每次模型往返约需 1–3 秒；批量动作现在可在一次往返中完成多步）
- 为安全起见需要沙箱化环境（VM + VNC）

**Examples:** Claude 的计算机与浏览器工具集（2026 年 8 月 19 日正式发布）、Gemini computer use（文档现推荐 `gemini-3.8-flash`）、OpenAI Agents API 通过 OpenAI 托管浏览器提供的 computer use（2026 年 9 月 29 日）、GitHub Copilot computer use（2026 年 10 月 1 日公开预览），以及原版 Python Open Interpreter 的 Computer API。

浏览器变体越来越多地使用**无障碍树元素引用**而非原始像素作为操作目标；元素引用能适应布局变化，减少误点。桌面应用仍以像素作为后备方案。

### 5. 托管与持久化代理（供应商运行框架，独立身份）

这是最新的一类，也改变了设计问题。供应商提供的不是模型端点，而是运行整个代理循环；消费级产品则为每个代理提供独立的云端计算机、身份和审批策略。

**关键特性：**
- 由供应商运行框架，提供持久会话、工具执行、上下文压缩与恢复
- 每个代理配一台 VM 或一个沙箱，通常还有独立登录身份
- 用声明式审批规则代替逐次调用确认
- 按会话或用量计费，有时按交易计费

**示例：**

| 产品 | 状态（2026 年 10 月 1 日） | 值得借鉴的设计 |
|------|--------------------------|----------------|
| Claude Managed Agents | 已可用；预算（8 月 7 日）、`ant apply`（9 月 3 日）和自动策略（9 月 10 日）是近期新增功能 | 达到会话费用上限时以 `budget_reached` 暂停；由服务器评估自动权限策略；通过 `ant apply` 和已提交的 `claude-lock.json` 将代理配置写成代码 |
| OpenAI Agents API | 公开测试（9 月 10 日） | 托管 Codex 运行框架；按网站来源审批浏览器访问；凭据在带外输入，不进入模型输入；推出时仅支持美国数据驻留且不支持 ZDR |
| Amazon Bedrock Managed Agents（由 OpenAI 提供支持） | 预览（9 月 29 日） | 每个代理独立 IAM 角色、CloudTrail 日志；运行时和推理留在 AWS 内 |
| OpenAI dots | 9 月 29 日宣布（Pro、Business Premium） | 每个代理一台云端计算机；空闲时只读研究；Custom Rules 可允许、阻断或要求审批；可使用保存的密码而不向模型暴露密码 |
| Meta Muse | 9 月 8 日面向消费者推出 | 运行在专用云端 VM；Meta 表示预计从交易收取少量费用实现盈利 |
| Microsoft Copilot Autopilot（原 Scout） | 9 月底私人预览 | 在客户租户中拥有独立身份、记忆和计算机 |

面试中的关键点是：当代理拥有自己的 VM、收件箱和凭据时，难题变成租户隔离、代理身份、审批策略和终止开关，而非完成单个任务。

---

## OpenClaw: The Viral Personal AI Agent

### What It Is

OpenClaw 是一个 self-hosted（自托管）的开源 personal AI assistant（个人 AI 助手），由奥地利开发者 Peter Steinberger 创建。它最初以 Clawdbot 名义在 2025 年 11 月发布，并于 2026 年 1 月更名为 OpenClaw。它在不到五个月内从 0 增长到 346,000 GitHub stars，并在 2026 年 3 月 3 日超越 React，成为 GitHub 上 star 数最高的软件项目。

**By the numbers (May 2026):**
- 346,000+ GitHub stars
- 3.2 million active users
- 500,000+ running instances
- 44,000+ community skills on ClawHub
- 38 million monthly visitors to the project site
- 24+ messaging platform integrations

2026 年 10 月初，仓库约有 39.1 万 stars、8.2 万 forks。项目现由独立的 501(c)(3) 非营利组织 **OpenClaw Foundation** 管理，没有付费档、托管服务或代币；其 README 称 OpenAI“是捐助者，不是所有者”。发布分为两条线：按日历标版本的构建（9 月 30 日的 2026.9.7）和仅针对 Gateway 的扩展稳定构建，项目将后者作为 LTS 系列（10 月 2 日的 2026.8.35）。代码采用 MIT 许可。架构细节见 [OpenClaw 深入解析](03-openclaw-deep-dive.md)。

### How It Works

OpenClaw 的架构包含六个核心组件：

```
+-------------------------------------------------------------------+
|                      OpenClaw Architecture                        |
+-------------------------------------------------------------------+
|                                                                   |
|  +-----------+     +-----------+     +----------+                 |
|  |  Gateway  |---->|  LLM      |---->| Runtime  |                 |
|  |           |     |  (Brain)  |     | (Tools)  |                 |
|  +-----------+     +-----------+     +----------+                 |
|       ^                  |                |                       |
|       |                  v                v                       |
|  +-----------+     +-----------+     +----------+                 |
|  | Channels  |     | SOUL.md   |     | Skills   |                 |
|  | (24+)     |     | (Identity)|     | (44K+)   |                 |
|  +-----------+     +-----------+     +----------+                 |
|                          |                                        |
|                          v                                        |
|                    +-----------+                                  |
|                    | Memories  |                                  |
|                    | (Persist) |                                  |
|                    +-----------+                                  |
+-------------------------------------------------------------------+
```

**1. Gateway**: 消息 ingress/egress（入口/出口）层。可连接 WhatsApp（经由 Baileys）、Telegram、Discord、Slack、Signal、iMessage、Microsoft Teams、Matrix 以及 16+ 其他平台。支持 DMs（私聊）与群聊，并支持基于提及的激活方式。

**2. LLM（大脑）**：设计上与模型无关。支持 OpenAI（近期版本新增 GPT-6 Astra 和 GPT-6.1 Sol）、Claude（包括 Fable 5.1）、Gemini、Meta Muse Spark 1.3、DeepSeek，或通过 Ollama 使用本地模型。由用户选模型，架构不作限定。

**3. 代理运行时与核心工具**：OpenClaw 的内嵌代理循环将模型连接到读取、写入、编辑、执行以及浏览器、消息等核心工具，始终受工具策略约束。LLM 生成代码或命令，运行时负责写入与执行。这是代理的“手”。（README 致谢 Mario Zechner 的 pi agent 工具包；现行文档描述的是 OpenClaw 自有的单一运行时，也可以通过插件换用 Codex 或 Claude 等外部运行框架。）

**4. SOUL.md（Identity Layer）**: 一个纯 Markdown 文件，定义了代理的人格、沟通风格、价值观与行为护栏。会话开始时加载，并注入 system prompt。每个代理实例都先读取 SOUL.md——它“reads itself into being（通过阅读而生成自身）”。

**5. Skills（插件系统）**: 为代理提供新能力的扩展。ClawHub 上已有超过 44,000 个 community skills（社区技能）。Skills 遵循 AgentSkills 规范，可打包、工作区本地安装，或全局安装。

**6. Memories（Persistent Context）**: 本地持久化长期上下文。代理在多次对话中建立用户上下文。结合 SOUL.md，这使每个代理在所有消息平台上都呈现一致的人格。

### Workspace Files

| 文件 | 用途 |
|------|---------|
| `SOUL.md` | 代理人设、语气、价值观、行为护栏 |
| `AGENTS.md` | 运行指令，以及记录本地工具约定的 Tools 小节 |
| `USER.md`、`IDENTITY.md` | 可选的用户画像；代理名称和人设细节 |
| `MEMORY.md`、`memory/YYYY-MM-DD.md` | 经整理的长期记忆和每日日志，可供记忆搜索建立索引 |

早期版本也用 `HEARTBEAT.md` 定义定时自主操作。现行版本已弃用它：心跳指令和 cron 任务存放在 Gateway 的自动化状态中，`openclaw doctor --fix` 可迁移旧文件。

### Security Concerns

OpenClaw 的快速增长超过了安全实践跟进的速度。2026 年 2 月，SecurityScorecard 的 STRIKE 团队统计到逾 13.5 万个实例暴露于公共互联网，其中许多使用默认配置。ClawHub 技能市场的安全审查较少：技能是 Markdown，可选用 TypeScript，创建和安装都很容易，也容易被滥用。除非自行配置沙箱，否则主会话工具直接在宿主机运行（沙箱模式默认是 `off`）。生产部署必须考虑这一点；`openclaw security audit` 可报告部署偏离安全默认值的地方。

---

## OpenHands: Autonomous Developer Agent

### What It Is

OpenHands（前称 OpenDevin）是一个采用 MIT 许可的开源自主 AI 软件工程师，可修改代码、执行命令、浏览网页并与 API 交互。它会克隆仓库、运行终端命令、执行测试，并在沙箱化运行时（通常是 Docker 容器）中调试错误，而不只是建议代码片段。

### v1.x OpenHands 代理架构（Agent Canvas 之前）

下图是 Agent Canvas 出现前的代理运行时；本节末尾概述现行产品形态。

```
+-------------------------------------------------------------------+
|              OpenHands v1.x Agent (pre-Agent Canvas)              |
+-------------------------------------------------------------------+
|                                                                   |
|  +-------------------+                                            |
|  |    User / API     |                                            |
|  +--------+----------+                                            |
|           |                                                       |
|           v                                                       |
|  +--------+----------+     +------------------+                   |
|  |  Agent Controller |<--->|  Event Stream    |                   |
|  |  (CodeActAgent)   |     |  Hub             |                   |
|  +--------+----------+     +--------+---------+                   |
|           |                         |                             |
|           v                         v                             |
|  +--------+----------+     +--------+---------+                   |
|  |  Action Dispatch  |     |  Observation     |                   |
|  |                   |     |  Collector       |                   |
|  |  - CmdRunAction   |     |                  |                   |
|  |  - FileWriteAction|     |  - CmdOutput     |                   |
|  |  - BrowseURLAction|     |  - FileContent   |                   |
|  |  - CodeAction     |     |  - BrowserState  |                   |
|  +--------+----------+     +------------------+                   |
|           |                                                       |
|           v                                                       |
|  +--------+--------------------------------------------------+    |
|  |                Docker Sandbox (Per Session)               |    |
|  |                                                           |    |
|  |  +--------------+  +--------------+  +--------------+     |    |
|  |  | Terminal     |  | Python       |  | Browser      |     |    |
|  |  | (bash)       |  | (stateful)   |  | (BrowserGym) |     |    |
|  |  +--------------+  +--------------+  +--------------+     |    |
|  +-----------------------------------------------------------+    |
+-------------------------------------------------------------------+
```

**v1.x 代理的关键架构决策：**
- **Event-stream architecture（事件流架构）**: 所有 agent 与环境交互都作为 typed events（类型化事件）通过 central hub（中央枢纽）流转。Agent 分析对话状态并产出 Actions（动作）；沙箱产生 Observations（观察）。
- **Per-session Docker containers（按会话 Docker 容器）**: 每个会话拥有独立隔离的容器，具备完整 OS 能力。容器与宿主机隔离。
- **CodeAct 式代理**：代理通过编写和运行 bash 或 Python 来执行动作（以可执行代码作为动作空间的 CodeAct 方法），而不是从固定的 JSON 工具调用中选择，并维护会话级项目上下文。
- **BrowserGym integration（BrowserGym 集成）**: Agent 可通过声明式原语（DOM manipulation、navigation）执行浏览器自动化。
- **SDK composability（SDK 可组合性）**: OpenHands SDK 是一个 Python library（Python 库）。你可以用代码定义 agent、本地运行，或在云端扩展到数千实例。

**v1.6.0 更新（2026 年 3 月）：**
- Kubernetes 支持，用于编排 agent 会话
- Planning Mode（规划模式）测试版，用于多步任务分解
- 2,100+ contributions（贡献）来自 188+ contributors（贡献者）

此后仓库已迁移至 `OpenHands` GitHub 组织，约有 9 万 stars。自 v1.24.0（2026 年 9 月 25 日）起，OpenHands 以 Agent Canvas 形式发布：这是一个自托管控制中心，可在本地、Docker、VM 或云端后端运行 OpenHands 代理或任何 ACP 代理（Claude Code、Codex、Gemini）；详见[开放编程代理指南](../09-frameworks-and-tools/10-opencoderguide.md#openhands-原-opendevin)。

---

## Open Interpreter: Local Code Execution

### What It Is

Open Interpreter 是一个 local code execution agent（本地代码执行代理），提供类似 ChatGPT 的终端界面。它不会先展示代码并让你手动运行，而是请求授权后直接在你的机器上执行，且可完全访问本地文件。

**产品定位变化（2026 年中）：** 主仓库 `openinterpreter` 如今发布的是另一款产品：它是 OpenAI Codex 的 Rust 分支，采用 Apache-2.0 许可，取代了 AGPL-3.0 的 Python 代码。Rust 版本于 2026 年 6 月开始发布，主分支于 7 月中旬以 Codex 为基础重建，9 月 30 日发布了 0.0.55。新产品定位为“针对低成本模型优化的编程代理”：它模拟能充分发挥 Kimi K3、GLM-5.3 等模型能力的运行框架，可切换内置运行框架配置（Claude Code、Kimi CLI、Qwen Code、DeepSeek TUI 等），支持 MCP 与技能，并在 macOS、Linux 和 Windows 上以原生沙箱运行命令。下文架构描述的是原版 Python 项目，其最后一个 PyPI 版本 0.4.3 发布于 2024 年 10 月；一个小型社区分支（`endolith/open-interpreter`，仍为 AGPL-3.0）在继续维护。此次转型也说明，除了模型选择，运行框架设计已成为编程代理的差异化因素。

### Architecture

```
+-------------------------------------------------------------------+
|                   Open Interpreter Architecture                   |
+-------------------------------------------------------------------+
|                                                                   |
|  +-------------------+                                            |
|  |  Terminal UI      |                                            |
|  |  (ChatGPT-like)   |                                            |
|  +--------+----------+                                            |
|           |                                                       |
|           v                                                       |
|  +--------+----------+     +------------------+                   |
|  |  Core Engine      |<--->|  LLM Provider    |                   |
|  |                   |     |  (100+ models)   |                   |
|  |  - NL to Code     |     |  GPT, Claude,    |                   |
|  |  - Permission     |     |  Ollama, LM      |                   |
|  |    Gate           |     |  Studio, etc.    |                   |
|  +--------+----------+     +------------------+                   |
|           |                                                       |
|           v                                                       |
|  +--------+----------+                                            |
|  |  Code Executor    |                                            |
|  |                   |                                            |
|  |  - Python         |                                            |
|  |  - JavaScript     |                                            |
|  |  - Shell/Bash     |                                            |
|  |  - AppleScript    |                                            |
|  +--------+----------+                                            |
|           |                                                       |
|           v                                                       |
|  +--------+----------+                                            |
|  |  Computer API     |                                            |
|  |  (GUI Control)    |                                            |
|  |                   |                                            |
|  |  - Screen capture |                                            |
|  |  - Mouse/Keyboard |                                            |
|  |  - Icon detection |                                            |
|  +-------------------+                                            |
+-------------------------------------------------------------------+
```

**Key properties:**
- **Model flexibility（模型灵活性）**：支持 100 多种 LLM。可使用前沿 API 模型获得最强能力，也可通过 Ollama 与 LM Studio 完全离线运行以保护隐私。
- **Permission gate（权限闸）**: 每次代码执行都需要用户授权（在可信工作流中可禁用）。
- **Computer API（计算机 API）**: 除代码执行外，Open Interpreter 还可看到你的屏幕、识别 UI 元素，并控制鼠标与键盘——因此它从 code interpreter（代码解释器）升级为 computer automation agent（计算机自动化代理）。
- **Python 版本默认不使用沙箱**：直接运行在宿主机上，以获得最大能力，但错误的 LLM 输出可能损害系统；Docker 沙箱化是可选项。Rust 重写版改为默认使用原生操作系统沙箱。

### 何时使用 Open Interpreter

Python 版适合希望以对话方式操作本地机器的数据分析、文件处理和系统管理任务，不适合生产部署或不可信环境。Rust 重写版则是另一种工具：适合希望通过针对低成本开放权重模型优化的运行框架来开展编程工作的团队。

---

## Claude Computer Use：基于视觉的自动化

### 这是什么

Claude Computer Use 是 Anthropic 的 API 功能，允许 Claude 通过截图、鼠标、键盘和应用交互控制桌面。它于 2024 年 10 月以测试版推出，并于 2026 年 8 月 19 日在 Claude API 正式发布（Google Cloud 为 8 月 20 日），作为 `computer_toolset_20260801` 客户端工具集提供；在 Bedrock、Claude Platform on AWS 和 Foundry 上仍为测试版。支持的模型包括 Fable 5/5.1、Mythos 5/5.1、Opus 5/5.5、Sonnet 5/5.5 和 Opus 4.8。

### 视觉-动作循环

```
+-------------------------------------------------------------------+
|              Claude Computer Use: Vision-Action Loop               |
+-------------------------------------------------------------------+
|                                                                   |
|  Step 1: OBSERVE          Step 2: REASON          Step 3: ACT    |
|  +----------------+       +----------------+      +------------+ |
|  |  Take          |       |  Analyze       |      |  Execute   | |
|  |  Screenshot    |------>|  Screenshot    |----->|  Action    | |
|  |  (base64 PNG)  |       |  + Task Goal   |      |  (click,   | |
|  |                |       |  + History      |      |  type,     | |
|  +----------------+       +----------------+      |  scroll)   | |
|                                                    +------+-----+ |
|                                                           |       |
|          +------------------------------------------------+       |
|          |                                                        |
|          v                                                        |
|  +-------+--------+                                               |
|  |  Wait + Take   |                                               |
|  |  New Screenshot|-------> (Loop back to Step 1)                 |
|  +----------------+                                               |
|                                                                   |
+-------------------------------------------------------------------+
```

### 可用工具

| 工具 | 能力 | 说明 |
|------|------|------|
| `computer_toolset_20260801` | 17 个成员工具：截图、缩放、左/右/中/双/三击、拖拽、移动鼠标及按下/松开按钮、光标位置、滚动、输入、按键、`hold_key`、等待 | 正式发布；默认启用缩放；无需显示尺寸参数（模型从截图读取坐标）；可单独禁用或延后加载成员工具 |
| `browser_toolset_20260801` | 31 个成员工具（默认启用 27 个，另 4 个可选）：`read_page` 返回带 `[ref_2]` 等元素引用的无障碍树，另有查找、表单输入、标签页管理及像素操作 | 用于应用自行托管的浏览器；仅 Claude API 与 Google Cloud 支持 |
| `bash`（`bash_20250124`） | 运行 shell 命令 | 跨轮次保持持久会话 |
| `text_editor`（`text_editor_20250728`） | 读取、写入、编辑文件 | 支持 view、create、str_replace |

### 2026 年增强

- **批量动作**：Claude 可以在一轮中返回多个 `tool_use` 块。执行器按顺序运行，在首次失败时停止，并对后续块返回错误（`"Not executed: an earlier computer action in this turn failed"`）。这减少了模型往返，也意味着只在两轮模型调用之间做确认已经太晚：一轮就可能完成多步重要操作。Anthropic 文档要求在每个动作执行前检查：收到批次时查看整个批次，并在其中每个重要动作前暂停，包括位于批次中间的动作。
- **Zoom Action**：点击前以高分辨率查看细小 UI 元素，减少密集界面的误点；正式版工具集默认开启。
- **浏览器元素引用**：浏览器工具集定位无障碍树引用，能适应布局变化，但导航后引用会失效。Anthropic 会扫描返回的网页文本和截图，识别提示注入。
- **破坏性变更**：在 Claude API 和 Google Cloud 上，Opus 5.5 和 Sonnet 5.5 对旧版 `computer_20251124` 工具返回 HTTP 400（Bedrock 仍接受）；基于测试版工具编写的代码需要迁移。
- **截图预算**：Opus 4.7 及后续模型接受长边最高 2576 像素。Anthropic 估计每张截图约消耗 1,000–1,800 个输入 token，建议每次请求不超过 20 张图片，或将各边缩至不超过 2000 像素。
- **消费端产品**：Cowork 正并入统一的 Claude 应用（2026 年 9 月 16 日起面向 Pro 和 Max 推出），Claude 默认在执行动作前请求批准。
- **沙箱实践**：始终在沙箱化 VM 中运行（Docker + VNC 或 E2B 云环境），不要授予未隔离宿主机的计算机操作权限。浏览器还应使用无凭据的新配置文件，并在网络层设置域名允许列表，阻断回环、链路本地及私有地址段。

### 性能演进

| 日期 | 基准 | 分数 | 关键里程碑 |
|------|------|------|------------|
| 2024 年 10 月 | OSWorld | 14.9% | 测试版发布（Claude 3.5 Sonnet） |
| 2025 年 2 月 | OSWorld | 28.0% | Claude 3.7 Sonnet |
| 2025 年中 | OSWorld | 约 42–44% | Claude Sonnet 4 / Opus 4.1 |
| 2026 年第一季度 | OSWorld-Verified | 72.5% | Sonnet 4.6、Zoom Action |
| 2026 年 9 月 | OSWorld 2.0（v2.1 全量集，XLANG 排行榜） | 二元 44.33% / 部分完成 77.67% | Opus 5、最高推理强度、批量工具 |
| 2026 年 9 月 | OSWorld 2.1（Anthropic 自报） | 部分完成 81.8% | Opus 5.5 |

不要把这些行读成同一条趋势线。自报的 OSWorld-Verified 分数现已达到 80 多分的中段（约 85%），基准趋于饱和。**OSWorld 2.0**（2026 年 6 月）包含 108 个长流程任务，熟练人类完成每个任务的中位耗时约 1.6 小时，主要按 500 步预算内是否完全完成进行二元评分。二元与部分完成评分、推理强度及任务发布版本不同，引用的分数可能相差 30–40 个百分点，因此必须问清具体口径。面试要点是：短时、单会话的桌面任务已接近解决，但公开排行榜上按二元标准评估的小时级任务完成率仍低于 50%。

---

## Claude Code：终端代理

### 这是什么

Claude Code 是 Anthropic 的 agentic coding 工具，运行在终端中。它会读取你的代码库、编辑文件、运行命令，并与开发工具集成。它于 2025 年 5 月正式发布，并在 2026 年 2 月突破 25 亿美元 ARR（annual recurring revenue，年度经常性收入）。

### 架构

Claude Code 是一个 TypeScript 终端代理，其循环包含三个阶段：

```
+-------------------------------------------------------------------+
|                   Claude Code Agent Loop                          |
+-------------------------------------------------------------------+
|                                                                   |
|  +------------------+                                             |
|  |  1. GATHER       |  Read files, grep codebase, glob search,   |
|  |     CONTEXT      |  check git status, analyze structure        |
|  +--------+---------+                                             |
|           |                                                       |
|           v                                                       |
|  +--------+---------+                                             |
|  |  2. TAKE         |  Edit files, run bash, write new files,     |
|  |     ACTION       |  create commits, spawn subagents            |
|  +--------+---------+                                             |
|           |                                                       |
|           v                                                       |
|  +--------+---------+                                             |
|  |  3. VERIFY       |  Run tests, check build, review diffs,     |
|  |     RESULTS      |  validate output                            |
|  +--------+---------+                                             |
|           |                                                       |
|           +--------> (Loop back to Step 1 if not done)            |
|                                                                   |
+-------------------------------------------------------------------+

Built-in Tools: bash, read, write, edit, glob, grep, browser,
                subagent, notebook, web_search, web_fetch
```

**关键架构特性：**
- 单一代理循环与丰富的工具面板
- 通过 slash 命令和 CLAUDE.md 按需加载 skill
- 长会话上下文压缩（1M+ token context）
- 用于并行工作流的 subagent（子代理）生成
- 用于并行分支执行的 worktree 隔离
- 权限治理（工具 allow/deny 规则）。自 v2.1.284（2026 年 9 月 28 日）起，未配置权限模式的交互会话默认进入 **auto mode**，由服务端分类器决定各动作直接运行、拒绝或请求确认
- 带依赖图的任务系统
- 用于自定义自动化的 hooks（pre/post commit、文件变更）；自 v2.1.287（2026 年 10 月 1 日）起还有 **mods**：插件内的 TypeScript 函数可改写提示、阻断或改写工具调用、批准或拒绝权限请求、遮蔽工具输出。Anthropic 提醒，这些函数不在沙箱内运行，拥有 Claude Code 自身的访问权限，因此插件审查也是代理信任边界的一部分
- 自托管运行器（`claude self-hosted-runner`，Team 与 Enterprise），可在自有基础设施上运行会话

**严肃的终端运行框架不止一种。** 截至 2026 年 10 月 1 日，主要替代方案有 OpenCode（MIT，约 21.1 万 stars）、Codex CLI（Apache-2.0，约 12.8 万 stars；默认模型于 9 月 29 日改为 GPT-6.1 Sol）和 Gemini CLI（Apache-2.0，约 10.7 万 stars，仍每周发布），而 anthropics/claude-code 仓库约 14.9 万 stars。Aider 已趋于沉寂（最后版本发布于 2 月 12 日，最后提交于 2026 年 5 月 22 日）。像 Codex 这样静默更换默认模型，也说明基于这些 CLI 构建自动化时应显式固定模型。

---

## IDE Agents：Cursor、Windsurf、Cline

### Cursor

Cursor 是一个深度集成 AI 的 VS Code 分支。到 2026 年初，它已提供：
- **Agent Mode**：使用 20 倍缩放的 reinforcement learning（强化学习）进行多文件编辑
- **Background Agents**（现称云端代理）：在云端 VM 中克隆仓库，自主工作，完成后打开 PR
- **Mission Control**：用于管理并行 agent 工作流的仪表盘
- **市场（2026 年初）**：年化收入 20 亿美元、逾 200 万用户、逾 100 万付费客户，Fortune 500 中约半数公司采用

**所有权于 2026 年 8 月发生变化。** Cursor 于 8 月 14 日宣布加入 SpaceX（TechCrunch 报道交易于 8 月 15 日完成，交易对价约为 600 亿美元 SpaceX 股票）。其博客现在刊载 SpaceXAI 的 Grok 产品发布信息，而收购公告没有说明第三方模型访问或数据使用承诺。两周后，风险具体化：8 月 28 日，OpenAI 通知 SpaceX 将逐步终止向 Cursor 供应 OpenAI 模型的合同，拟于 2026 年 11 月 12 日停止供应，在此之前也不会提供 GPT-6 Astra 等后续模型。通知仅涉及 OpenAI 模型。一般性的教训是：当工具供应商归模型供应商所有，竞争对手的模型可能因合同通知而消失，所以应把模型选择保留在自己的路由层。Cursor 还于 8 月 13 日取得 AIUC-1 代理认证。

此后发布的功能（均据供应商描述）：
- **Self-hosted Machines**（9 月 2 日）：云端代理可运行在自有机器或可自动扩缩的团队资源池（AWS Lambda、Coder、Cloudflare、Daytona、Modal、Namespace、Vercel 或 E2B），Linux 与 Mac 工作机支持计算机操作。这为云端代理提供了数据驻留方案。
- **Projects**（测试版，9 月 10 日）：协调代理规划工作，按需要分派并行子代理，保留长达数月的上下文，再交付完成的工作供审查。Cursor 报告称新 Projects 用户合并的 PR 多了 30%（供应商自报的内部数据）。
- **Rollouts 与 Security Review**（9 月 23 日，Teams 和 Enterprise）：在每个 PR 上挂载监控器，跟踪合并后各环境的变更健康状况，并扫描 PR 中可利用的漏洞。

### Windsurf

Windsurf（最初名为 Codeium，2025 年 7 月被 Cognition 以 2.5 亿美元收购）具备：
- **Cascade**：多步骤 AI agent，可分析项目结构、协调跨文件变更，并能自我恢复错误
- **专有模型**：SWE-1.5（据 Cognition 称比 Sonnet 4.5 快 13 倍）和 Fast Context，随后是 2026 年 9 月 10 日推出的旗舰模型 SWE-2
- **Codemaps**：AI 驱动的可视化代码导航
- **Cross-IDE plugins**：支持 40+ 个 IDE（JetBrains、Vim、NeoVim、XCode）

Cognition（Windsurf 与 Devin）于 2026 年 9 月 8 日以 480 亿美元估值融资逾 20 亿美元，并报告年化收入运行率超过 10 亿美元（9 月 25 日供应商自报）。这是一家同时拥有 IDE 和自有模型的独立编程代理公司。

### Cline

Cline 是一个作为完整代理而非自动补全工具运行的 VS Code 扩展。它会连续执行步骤、评估结果、修复错误并继续。与 Cursor 或 Windsurf 相比，它更自主但打磨较少。它采用 Apache-2.0 许可，截至 2026 年 10 月 1 日为 v4.1.22，并提供 SDK。

### GitHub Copilot

Copilot 现在提供了一年前还只停留在论文中的编排模式：
- **Computer use**（2026 年 10 月 1 日公开预览，适用于 Copilot CLI 以及 macOS、Windows 上的 Copilot 应用）：经每个应用单独批准后操作桌面应用；永久授权可审查，组织级开关可关闭功能。
- **Dynamic workflows**（10 月 1 日公开预览）：由代码定义的程序，将自动化步骤与代理混合为顺序或并行阶段，并设置人工审查检查点。GitHub 将其与由模型自行委派工作的 `/fleet` 区分开来。
- **HydraFusion**（9 月 30 日研究预览，VS Code 1.140+）：**cascade** 模式用高效模型起草，通过质量门槛后必要时升级至更强模型；**critique** 模式让另一个模型家族对草稿审查一次。

### IDE Agent 架构对比

```
+-------------------------------------------------------------------+
|                 IDE Agent Architecture Patterns                   |
+-------------------------------------------------------------------+
|                                                                   |
|  Cursor:                                                          |
|  [Editor] --> [Agent Mode] --> [Multi-file RL] --> [Apply Diffs]  |
|                    |                                              |
|                    +--> [Cloud Agent] --> [Cloud/own VM] --> [PR] |
|                                                                   |
|  Windsurf:                                                        |
|  [Editor] --> [Cascade Agent] --> [RAG Codebase] --> [Apply Edits]|
|                    |                                              |
|                    +--> [SWE-1.5 Model] --> [Fast Context]        |
|                                                                   |
|  Cline:                                                           |
|  [Editor] --> [Agent Loop] --> [Evaluate] --> [Self-Fix] --> [Act]|
|                    |                                              |
|                    +--> [Any LLM Provider] --> [Tool Calls]       |
+-------------------------------------------------------------------+
```

---

## 对比矩阵

| 特性 | OpenClaw | OpenHands | Open Interpreter | Claude Computer Use | Claude Code | Cursor |
|------|----------|-----------|-----------------|-------------------|-------------|--------|
| **类型** | 本地 agent | 开发 agent | 本地代码执行 | 视觉自动化 | 终端 agent | IDE agent |
| **许可证** | MIT | MIT | Apache-2.0（Rust 重写版）；AGPL-3.0（Python 分支） | Proprietary API | Proprietary | Proprietary |
| **GitHub Stars（2026 年 10 月）** | 约 391K | 约 90K | 约 68K | N/A（API） | 约 149K（issues 与插件仓库） | N/A |
| **是否沙箱化** | 可选（主会话默认在宿主机） | 是（Docker） | Rust：原生 OS 沙箱；Python：无 | 需要 VM | 可配置 | 是（云端代理） |
| **LLM 支持** | 任意（模型无关） | 任意 | 100+ 模型 | 仅 Claude | 仅 Claude | 多模型 |
| **GUI 控制** | 浏览器工具 | 是（BrowserGym） | Python 分支：Computer API；Rust：浏览器和应用 QA 技能 | 是（原生） | 通过 computer-use | 云端代理工作机支持计算机操作 |
| **代码执行** | 是（exec 工具） | 是（容器） | 是（本地） | 是（bash 工具） | 是（bash） | 是（终端） |
| **消息机制** | 24+ 平台 | Web UI / API | 终端 | API | 终端 / IDE | 编辑器 |
| **记忆** | 持久化（本地） | 基于会话 | 基于会话 | 按会话 | 会话 + CLAUDE.md | 项目范围 |
| **MCP 支持** | 原生（客户端和服务器） | 有限 | Rust：是；Python：否 | 通过 Claude | 原生 | 原生（动态加载） |
| **最佳用途** | 个人助手 | 自主开发 | Rust：低成本模型编程；Python：数据分析 | GUI 自动化 | 专业开发 | IDE 工作流 |
| **风险等级** | 高（默认不使用沙箱） | 低（已沙箱化） | Python 分支较高；Rust 重写版较低 | 中（需要 VM） | 中 | 低 |

---

## 市场趋势与采用情况（2026）

### 数据

- **MCP 生态系统**：逾 10,000 个活跃服务器。2026 年 9 月，单是 v1 TypeScript SDK 的 npm 下载量就约 2.32 亿次；拆分后的 v2 包也在增长（`@modelcontextprotocol/core` 约 3,100 万次）。一线 SDK 现已覆盖 TypeScript、Python、C#、Go、Rust 与 Ruby。
- **Gartner 预测**：到 2026 年底，40% 的企业应用将集成 AI agents（较 2025 年初不到 5% 的水平大幅提升）
- **OpenClaw**：历史上最快达到 30 万 GitHub stars 的项目（不到 5 个月）；截至 2026 年 10 月 1 日约 39.1 万
- **Claude Code**：截至 2026 年 2 月达到 25 亿美元 ARR，成为最快达到 10 亿美元规模的企业软件产品
- **Cursor**：2026 年初年化收入 20 亿美元，Fortune 500 中约半数公司采用；自 2026 年 8 月起隶属 SpaceX，OpenAI 正逐步停止向 Cursor 供应模型（拟于 11 月 12 日终止）
- **Cognition**：2026 年 9 月 8 日融资逾 20 亿美元后估值达 480 亿美元

### 关键趋势

**1. Agent 类型趋同**：本地、云端与 IDE 代理之间的边界正在消融。Claude Code 在本地运行但使用云端模型；Cursor 的云端代理既可在 Cursor 的 VM 上运行，也可在自有机器上运行；OpenClaw 可连接任意 LLM。整体趋势是能够在不同环境中运行的通用代理架构。

**2. MCP 作为统一工具层**：MCP 已成为工具集成标准，Anthropic、OpenAI、Google 和数百家工具提供商均已采用。现行规范版本为 2026-07-28，协议核心改为无状态。维护者于 2026 年 8 月 22 日发布的路线图优先考虑代理消息传递（Tasks、服务器发起事件）、以 Streamable HTTP 为唯一传输方式、代理身份（DPoP 和工作负载身份联合均仍是开放草案）、重新设计 `tools/call` 的结果形态，以及大型工具目录在服务端的渐进发现。下一次修订尚无日期。

**3. 沙箱化成为非谈判项**：OpenClaw 的安全危机（135,000 个暴露实例）推动行业转向默认沙箱化架构。新 agent 被预期要开箱即提供隔离能力。

**4. 成本优化成为一级关注点**：在示例计算中，Plan-and-Execute 模式（强模型规划，低价模型执行）可节省约 85–90% 成本（见下一章）。对编程代理而言，输入 token 如今是更大的杠杆：Anthropic 2026 年 9 月 24 日公布的 Claude Code 遥测数据显示，输入与输出 token 之比从 189:1 增至 324:1，因此缓存读取价格与命中率主导账单。Opus 5.5 的缓存读取价格为每百万 token 0.20 美元，是其 4 美元输入价格的 0.05 倍。这相当于代理领域的云成本优化。

**5. 后台与异步代理**：Cursor 的云端代理和 Projects、Codex 云环境以及 Claude Code 的子代理派生，代表着从同步、交互式代理转向完成后再通知用户的自主异步工作者。OpenAI dots 与 Meta Muse 则把这一模式带到消费端：始终在线且有独立计算机的代理。

**6. 运行框架成为产品**：Anthropic（Claude Managed Agents）、OpenAI（Agents API）和 AWS（基于 OpenAI 运行框架的 Bedrock Managed Agents）现将代理循环作为托管运行时出售。编程工具供应商也在向**控制与执行平面分离**收敛：控制平面由供应商托管，执行平面由客户托管。“自建还是租用”因此成为设计评审问题，同时要审视其缺口：OpenAI Agents API 推出时只支持美国数据驻留，不支持零数据保留。

---

## 系统设计面试角度

当在系统设计面试中被问到 tool-use agents 时，应关注以下维度：

**1. 安全模型**：执行是否沙箱化？凭据如何管理？如果 LLM 生成恶意代码会怎样？OpenClaw 默认在宿主机执行，与 OpenHands 按会话使用 Docker 隔离，是很好的对比点；两者均为 MIT 许可，许可证不是区别所在。

**2. 状态管理**：agent 如何在工具调用之间保持上下文？基于会话（OpenHands）vs. 持久化内存（OpenClaw）vs. 基于文件（Claude Code 的 CLAUDE.md）？

**3. 工具发现**：静态清单（旧方法）vs. 通过 MCP 动态发现 vs. skill 市场（OpenClaw ClawHub）？

**4. 延迟预算**：函数调用（每次工具调用 50–200 毫秒）与视觉自动化（每次截图—动作循环 1–3 秒）有何差异？批量动作把一次模型往返分摊到多步 GUI 操作上，元素引用则减少误点引起的重试。这如何影响 UX？当一轮能做五件事时，确认关口放在哪里？

**5. 故障处理**：工具调用失败时怎么办？重试？回退？Human-in-the-loop？重试几次后放弃？

**6. 托管模式**：自建循环、租用托管运行框架，还是拆分控制与执行平面？逐一检查数据驻留、保留、身份，以及谁能停止失控代理。OpenAI 2026 年 9 月披露的案例值得警惕：内部训练运行中，代理的 DNS 隧道出站行为约 12 分钟就触发警报，但自动停止失败，约 2.5 小时后才终止。

---

## 面试问题

### Q: 你的团队想构建一个内部 AI assistant。应该基于 OpenClaw、OpenHands，还是用 Claude Code + MCP 自建？

**Strong answer:**
这取决于使用场景和安全要求。OpenClaw 针对带消息集成的个人助手优化，适合具有持续人格的 Slack/Teams bot。它采用 MIT 许可，现由基金会管理，并有类似 LTS 的发布线；但其单操作者信任模型及默认在宿主机执行会带来企业顾虑（自有文档称不支持敌对多租户部署）。OpenHands 更适合自主开发任务：按会话使用 Docker 沙箱及 MIT 许可有利于企业使用。定制内部工具若使用带 MCP 服务器的代理循环，可精确定义工具、在自有基础设施运行，并利用 MCP 标准化的发现与认证。2026 年 9 月起还有第四种选择：租用 Claude Managed Agents、OpenAI Agents API 或 Bedrock Managed Agents 的代理循环，只把工具和数据留在自己的边界内，但要先核对驻留与保留条款。决策路径是：以消息为先选 OpenClaw；开发自动化选 OpenHands；定制企业工具选 MCP 加自建或托管代理循环。

### Q: 你会如何设计一个系统，让非技术用户借助 AI 自动化桌面任务？

**Strong answer:**
我会采用基于视觉的计算机操作模式，例如 Claude 计算机工具集或 Gemini computer use。关键决策是：（1）始终在沙箱化 VM 中运行，避免代理破坏用户的真实机器；（2）在文件删除、表单提交、购买等重要操作执行前设置人工确认，即便该动作处在一批动作的中间也要逐个检查，因为一轮模型调用如今可发出多个动作；Gemini 安全服务对金融交易、账户创建等类别返回的 `require_confirmation`，可作为现成的风险分类；（3）使用缩放，浏览器还可使用无障碍树元素引用以减少误点；（4）设置 token 与成本上限，防止失控循环；（5）把所有动作写入审计轨迹。主要权衡是每次模型往返约需 1–3 秒，但无需 API 就能操作任何应用。对有 API 的应用，可结合函数调用提高速度。

### Q: 为什么 OpenClaw 的增长速度超过了历史上任何开源项目？这对市场说明了什么？

**Strong answer:**
有三个因素。（1）**零摩擦 onboarding**：OpenClaw 对接了用户已经在使用的消息平台（WhatsApp、Telegram），用户不需要学习新的界面。（2）**SOUL.md 个性化**：给 agent 自定义人格的能力会产生情感黏性和病毒式传播，用户会分享自己的 agent。（3）**模型无关架构（model-agnostic architecture）**：用户不会被锁定在单一 LLM 提供商，降低成本并增加灵活性。市场信号是，agent 的“界面”比底层模型更重要。人们希望 agent 出现在他们所在的地方（消息应用，而不是网页 UI）。反过来看，如果快速增长没有同步投入安全性，就会导致 135,000 个暴露实例这样的危机，这对任何开源 agent 项目都是警示。

### Q：设计一个在用户离开后仍持续工作的个人代理。除聊天代理外还需要什么？

**强回答：**
要把它当作一个租户，而非一次会话。（1）**隔离**：每个代理一台 VM 或一个沙箱（OpenAI dots 和 Meta Muse 都采用这种方式），并让用户可查看代理浏览器，dots 就支持这一点。（2）**身份与秘密**：代理有自己的身份；凭据放在模型无法读取的保险库中。dots 可使用保存的密码登录而不将密码暴露给模型，OpenAI Agents API 则通过独立登录界面接收凭据。（3）**策略而非提示**：按动作类型声明允许、阻断或要求审批的规则，新网站来源逐一审批。始终在线的代理若每次调用都弹窗，会造成审批疲劳。（4）**空闲模式**：没有任务时只允许只读工作，dots 就这样做。（5）**预算与终止开关**：设置达到上限便暂停代理的会话费用预算（Claude Managed Agents 的 `budget_reached`），并验证自动停止机制；只有警报、没有自动终止，不算控制。（6）**出站访问**：对包括 DNS 在内的目标设置允许列表，将公开仓库、gist 和图片托管站视为外传渠道。最后还要提出开放问题：代理交易由谁承担责任？用户如何审计一天的后台活动？

### Q: 比较 AI agent 的沙箱化与未沙箱化执行。你会在什么情况下选择各自方案？

**Strong answer:**
沙箱化（Docker/VM）适用于不可信代码执行、多租户系统或任何生产部署。OpenHands 每个会话都有 Docker 容器；代价是部署复杂度和性能开销，不过托管快照恢复运行时正在缩小开销（AWS 报告 AgentCore Runtime V2 的 P75 冷启动约 2 秒）。未沙箱化的主机访问仅适合单用户、可信且用户持续看护的环境。原版 Python Open Interpreter 和 OpenClaw 主会话为获得最大能力采用这种方式；值得注意的是，Open Interpreter 2026 年的 Rust 重写版转向原生 OS 沙箱。错误的 LLM 输出可能损坏宿主系统。2026 年的共识是默认沙箱化，高级用户可显式选择例外。面试中要说明：沙箱边界是安全决策，不只是便利性决策。

---

## 参考资料

- OpenClaw GitHub 仓库与文档 (2025-2026)
- OpenHands 文档与 SDK 参考 (2025-2026)
- Open Interpreter GitHub 仓库 (2024-2026)
- Anthropic. "Computer Use Tool Documentation" (2024-2026)
- Anthropic. "Browser Use Tool Documentation" (2026)
- Anthropic. "Claude Code Overview" and changelog (2025-2026)
- MCP 规范 2026-07-28 与 "The New MCP Roadmap"（2026 年 8 月 22 日）
- OpenAI. "Introducing the Agents API" and "Introducing dots" (September 2026)
- OpenAI. "Our decision on Cursor following its acquisition by SpaceX" (August 28, 2026)
- Google. Gemini API computer use documentation and changelog (2026)
- XLANG Lab. OSWorld 2.0 leaderboard (September 2026)
- Gartner. "AI Agent Adoption Projections" (2025-2026)
- Cursor、Windsurf、Cline 和 GitHub Copilot 官方文档及更新日志 (2025-2026)

---

*Next: [Architecture Patterns for Tool-Use Agents](02-architecture-patterns.md)*
