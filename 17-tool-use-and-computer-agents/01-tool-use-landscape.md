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

2026 年的 tool-use（工具调用）生态已围绕四种架构模式收敛，每种模式都针对不同程度的 autonomy（自治性）、安全性与集成深度进行优化：

```
+-----------------------------------------------------------------------+
|                     2026 Tool-Use Ecosystem                           |
+-----------------------------------------------------------------------+
|                                                                       |
|  +-------------------+  +-------------------+  +-------------------+  |
|  |  LOCAL AGENTS     |  |  CLOUD AGENTS     |  |  IDE AGENTS       |  |
|  |                   |  |                   |  |                   |  |
|  |  OpenClaw         |  |  Claude Code      |  |  Cursor           |  |
|  |  Open Interpreter |  |  OpenAI Codex     |  |  Windsurf         |  |
|  |  OpenHands (local)|  |  OpenHands Cloud  |  |  Cline            |  |
|  |  LM Studio Agent  |  |  Google Jules     |  |  GitHub Copilot   |  |
|  +-------------------+  +-------------------+  +-------------------+  |
|                                                                       |
|  +-------------------+  +-------------------+  +-------------------+  |
|  |  COMPUTER-USE     |  |  MCP SERVERS      |  |  MESSAGING AGENTS |  |
|  |                   |  |                   |  |                   |  |
|  |  Claude Computer  |  |  10,000+ servers  |  |  OpenClaw (multi) |  |
|  |  Use API          |  |  97M monthly SDK  |  |  Custom bots      |  |
|  |  Open Interpreter |  |  downloads        |  |  via MCP bridges  |  |
|  |  (Computer API)   |  |                   |  |                   |  |
|  +-------------------+  +-------------------+  +-------------------+  |
+-----------------------------------------------------------------------+
```

2026 年的关键洞察在于：这些类别正在趋同。Claude Code 是在本地运行的 cloud agent（云端代理）；OpenClaw 是连接到云端 LLM 的本地 agent（本地代理）；Cursor 是具有云侧 Background Agents（后台代理）的 IDE agent（集成式开发环境代理）。边界正在模糊，真正重要的是底层的 **architecture pattern（架构模式）**（下一章会展开）。

---

## Category Taxonomy

### 1. Local Agents（自托管、用户可控的代理）

在用户本机上运行的代理。LLM 调用可能走云端，但代理进程、memory（记忆）与 tool execution（工具执行）均在本地。

**Key properties:**
- 用户机器上拥有完整文件系统访问权限
- 持久化 memory（记忆）保存在本地（SQLite、JSON、Markdown）
- 用户拥有全部数据；无供应商锁定
- 安全责任完全由操作者承担

**Examples:** OpenClaw、Open Interpreter、local OpenHands deployments

### 2. Cloud Agents（供应商托管、API 驱动）

在供应商管理的云环境中运行的代理。代码执行发生在沙箱化 VM 或容器中。

**Key properties:**
- 沙箱化执行（Docker、Firecracker VMs、E2B）
- 无本地文件系统访问（在克隆的仓库上工作）
- 供应商负责扩缩容、安全与基础设施
- 按量计费或订阅定价

**Examples:** Claude Code（cloud mode）、OpenAI Codex、Google Jules、OpenHands Cloud

### 3. IDE Agents（编辑器集成、上下文感知）

直接嵌入代码编辑器的代理。它们深度理解项目结构、打开的文件与编辑器状态。

**Key properties:**
- 与编辑器 UI 深度集成（inline diffs、tab completion）
- 通过 embedding（嵌入）或 AST parsing（抽象语法树解析）进行代码库索引
- 后台代理可在分支上异步工作
- 为开发者工作流优化，而非通用自动化

**Examples:** Cursor（Agent Mode + Background Agents）、Windsurf（Cascade）、Cline、GitHub Copilot、Google Antigravity（Gemini 3 的 agent-first workspace（以 Agent 为先的工作区）与多代理管理器视图，继承 Gemini CLI 的方案）

### 4. Computer-Use Agents（基于视觉、GUI 驱动）

像人类一样与软件交互的代理：通过查看截图并执行点击。

**Key properties:**
- Model（模型）看到截图，并决策鼠标/键盘动作
- 可与任何应用配合使用（无需 API）
- 延迟更高（screenshot-action loop（截图-动作循环）每步约 1-3 秒）
- 为安全起见需要沙箱化环境（VM + VNC）

**Examples:** Claude Computer Use API、Open Interpreter Computer API

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

### How It Works

OpenClaw 的架构包含六个核心组件：

```
+-------------------------------------------------------------------+
|                      OpenClaw Architecture                        |
+-------------------------------------------------------------------+
|                                                                   |
|  +-----------+     +-----------+     +----------+                 |
|  |  Gateway  |---->|  LLM      |---->| PI Agent |                 |
|  |           |     |  (Brain)  |     | (Exec)   |                 |
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

**2. LLM（The Brain）**: 天然模型无关（model-agnostic）。支持 GPT-4o、Claude、Gemini、DeepSeek 或通过 Ollama 使用本地模型。用户选择模型，架构不做限定。

**3. PI Agent（Process Interactor）**: 一个轻量运行时，允许 LLM 创建、编辑、运行和删除主机系统上的文件。LLM 生成代码，PI Agent 将其保存并执行。这是 agent 的“hands（手）”。

**4. SOUL.md（Identity Layer）**: 一个纯 Markdown 文件，定义了代理的人格、沟通风格、价值观与行为护栏。会话开始时加载，并注入 system prompt。每个代理实例都先读取 SOUL.md——它“reads itself into being（通过阅读而生成自身）”。

**5. Skills（插件系统）**: 为代理提供新能力的扩展。ClawHub 上已有超过 44,000 个 community skills（社区技能）。Skills 遵循 AgentSkills 规范，可打包、工作区本地安装，或全局安装。

**6. Memories（Persistent Context）**: 本地持久化长期上下文。代理在多次对话中建立用户上下文。结合 SOUL.md，这使每个代理在所有消息平台上都呈现一致的人格。

### Workspace Files

| 文件 | 用途 |
|------|---------|
| `SOUL.md` | 代理人设、语气、价值观、行为护栏 |
| `AGENTS.md` | 运行说明、工具配置 |
| `HEARTBEAT.md` | 计划好的自主行为（cron-like） |
| `Memories/` | 跨会话持久上下文 |

### Security Concerns

OpenClaw 的快速增长速度已经超过了安全实践的同步速度。截至 2026 年 5 月，已有超过 135,000 个实例暴露在公共互联网中，许多实例使用默认配置。ClawHub 技能市场的安全审查较少：技能以 Markdown 为主，并可选 TypeScript，创建和安装都很容易，也容易被滥用。这是任何在生产环境部署 OpenClaw 时必须重点考虑的设计问题。

---

## OpenHands: Autonomous Developer Agent

### What It Is

OpenHands（前称 OpenDevin）是一个开源 autonomous AI software engineer（自主 AI 软件工程师）。它基于 MIT 授权，可修改代码、执行命令、浏览网页并与 API 交互。与只提供代码片段建议的工具不同，OpenHands 会克隆仓库、运行终端命令、执行测试并在沙箱化 Docker containers（容器）中调试错误。

### Architecture: Event-Stream + Sandboxed Runtime

```
+-------------------------------------------------------------------+
|                     OpenHands Architecture                        |
+-------------------------------------------------------------------+
|                                                                   |
|  +------------------+                                             |
|  |   User / API     |                                             |
|  +--------+---------+                                             |
|           |                                                       |
|           v                                                       |
|  +--------+---------+     +------------------+                    |
|  |  Agent Controller |<--->|  Event Stream    |                   |
|  |  (CodeAct 1.0)   |     |  Hub             |                   |
|  +--------+---------+     +--------+---------+                    |
|           |                        |                              |
|           v                        v                              |
|  +--------+---------+     +--------+---------+                    |
|  |  Action Dispatch  |     |  Observation     |                   |
|  |                   |     |  Collector       |                   |
|  |  - CmdRunAction   |     |                  |                   |
|  |  - FileWriteAction|     |  - CmdOutput     |                   |
|  |  - BrowseURLAction|     |  - FileContent   |                   |
|  |  - CodeAction     |     |  - BrowserState  |                   |
|  +--------+---------+     +------------------+                    |
|           |                                                       |
|           v                                                       |
|  +--------+--------------------------------------------------+    |
|  |              Docker Sandbox (Per Session)                 |    |
|  |                                                           |    |
|  |  +----------+  +----------+  +----------+                |    |
|  |  | Terminal  |  |  Python  |  | Browser  |                |    |
|  |  | (bash)   |  | (stateful)|  | (BrowserGym)             |    |
|  |  +----------+  +----------+  +----------+                |    |
|  +-----------------------------------------------------------+    |
+-------------------------------------------------------------------+
```

**Key architectural decisions:**
- **Event-stream architecture（事件流架构）**: 所有 agent 与环境交互都作为 typed events（类型化事件）通过 central hub（中央枢纽）流转。Agent 分析对话状态并产出 Actions（动作）；沙箱产生 Observations（观察）。
- **Per-session Docker containers（按会话 Docker 容器）**: 每个会话拥有独立隔离的容器，具备完整 OS 能力。容器与宿主机隔离。
- **CodeAct 1.0**: 默认 agent 模板。将 LLM 推理嵌入统一的 coding control plane（代码控制平面），并维持会话级项目上下文。
- **BrowserGym integration（BrowserGym 集成）**: Agent 可通过声明式原语（DOM manipulation、navigation）执行浏览器自动化。
- **SDK composability（SDK 可组合性）**: OpenHands SDK 是一个 Python library（Python 库）。你可以用代码定义 agent、本地运行，或在云端扩展到数千实例。

**Recent updates (v1.6.0, March 2026):**
- Kubernetes 支持，用于编排 agent 会话
- Planning Mode（规划模式）测试版，用于多步任务分解
- 2,100+ contributions（贡献）来自 188+ contributors（贡献者）

---

## Open Interpreter: Local Code Execution

### What It Is

Open Interpreter 是一个 local code execution agent（本地代码执行代理），提供类似 ChatGPT 的终端界面。它不会先展示代码并让你手动运行，而是请求授权后直接在你的机器上执行，且可完全访问本地文件。

### Architecture

```
+-------------------------------------------------------------------+
|                  Open Interpreter Architecture                    |
+-------------------------------------------------------------------+
|                                                                   |
|  +------------------+                                             |
|  |  Terminal UI      |                                            |
|  |  (ChatGPT-like)  |                                            |
|  +--------+---------+                                             |
|           |                                                       |
|           v                                                       |
|  +--------+---------+     +------------------+                    |
|  |  Core Engine      |<--->|  LLM Provider   |                   |
|  |                   |     |  (100+ models)  |                    |
|  |  - NL to Code     |     |  GPT, Claude,   |                   |
|  |  - Permission     |     |  Ollama, LM     |                   |
|  |    Gate            |     |  Studio, etc.   |                   |
|  +--------+---------+     +------------------+                    |
|           |                                                       |
|           v                                                       |
|  +--------+---------+                                             |
|  |  Code Executor    |                                            |
|  |                   |                                            |
|  |  - Python         |                                            |
|  |  - JavaScript     |                                            |
|  |  - Shell/Bash     |                                            |
|  |  - AppleScript    |                                            |
|  +--------+---------+                                             |
|           |                                                       |
|           v                                                       |
|  +--------+---------+                                             |
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
- **Model flexibility（模型灵活性）**: 支持 100+ LLM。可使用 GPT-4o 或 Claude 以获取最佳能力，也可通过 Ollama 与 LM Studio 完全离线运行以提升隐私性。
- **Permission gate（权限闸）**: 每次代码执行都需要用户授权（在可信工作流中可禁用）。
- **Computer API（计算机 API）**: 除代码执行外，Open Interpreter 还可看到你的屏幕、识别 UI 元素，并控制鼠标与键盘——因此它从 code interpreter（代码解释器）升级为 computer automation agent（计算机自动化代理）。
- **Unsandboxed by default（默认非沙箱）**: 直接运行在宿主机上，这是出于最大能力的一种设计选择，但意味着错误 LLM 输出可能损害系统。Docker 沙箱化是可选项。

### 何时使用 Open Interpreter

最适合用于数据分析、文件处理和系统管理任务，适用于希望以对话方式操作本地机器的场景。不适合生产部署或不可信环境。

---

## Claude Computer Use：基于视觉的自动化

### 这是什么

Claude Computer Use 是 Anthropic 的一项 API 功能，允许 Claude 通过截图、鼠标移动、键盘输入和应用交互来控制桌面。它于 2024 年 10 月作为 beta 版推出，此后有了显著演进。到 2026 年 5 月，Sonnet 4.6 在 OSWorld-Verified 上达到 72.5%，较发布时的 14.9% 大幅提升，而 Opus 4.7 在 agentic coding 基准测试中进一步推进（64.3% SWE-bench Pro）。

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
| `computer` | 鼠标、键盘、截图 | 全桌面 GUI 控制 |
| `bash` | 运行 shell 命令 | 跨轮次保持持久会话 |
| `text_editor` | 读取/写入/编辑文件 | 支持查看、创建、str_replace |

### 2026 年增强

- **Zoom Action**：在点击前以高分辨率检查小型 UI 元素，降低密集界面中的误点率。
- **可用于 Claude Cowork 和 Claude Code**：面向 Pro 和 Max 用户的研究预览版，在执行破坏性操作前需要人工确认。
- **沙箱化最佳实践**：始终在沙箱化 VM 中运行（Docker + VNC，或 E2B cloud）。切勿将 computer-use 权限授予未沙箱化的主机机器。

### 性能演进

| 日期 | OSWorld Score | 关键里程碑 |
|------|---------------|------------|
| 2024 年 10 月 | 14.9% | Beta 发布（Claude 3.5 Sonnet） |
| 2025 年中 | ~40% | Claude 3.7 改进 |
| 2026 年第一季度 | 72.5% | Sonnet 4.6、Zoom Action |

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
- 权限治理（工具 allow/deny 规则）
- 带依赖图的任务系统
- 用于自定义自动化的 hooks（pre/post commit、文件变更）

---

## IDE Agents：Cursor、Windsurf、Cline

### Cursor

Cursor 是一个深度集成 AI 的 VS Code fork。2.0 版本（2026 年初）引入了：
- **Agent Mode**：使用 20 倍缩放的 reinforcement learning（强化学习）进行多文件编辑
- **Background Agents**：在云端 VM 中克隆你的仓库，自主工作，完成后打开 PR
- **Mission Control**：用于管理并行 agent 工作流的仪表盘
- **Market**：年化收入 20 亿美元，200 万+ 用户，100 万+ 付费客户，被 Fortune 500 一半公司采用

### Windsurf

Windsurf（最初名为 Codeium，2025 年 7 月被 Cognition 以 2.5 亿美元收购）具备：
- **Cascade**：多步骤 AI agent，可分析项目结构、协调跨文件变更，并能自我恢复错误
- **Proprietary models**：SWE-1.5（比 Sonnet 4.5 快 13 倍）和 Fast Context
- **Codemaps**：AI 驱动的可视化代码导航
- **Cross-IDE plugins**：支持 40+ 个 IDE（JetBrains、Vim、NeoVim、XCode）

### Cline

Cline 是一个 VS Code 扩展，作为完整 agent 而非自动补全工具运行。它会执行一系列步骤、评估结果、修复自身错误并继续前进。它比 Cursor 或 Windsurf 更自主，但打磨程度较低。

### IDE Agent 架构对比

```
+-------------------------------------------------------------------+
|                 IDE Agent Architecture Patterns                   |
+-------------------------------------------------------------------+
|                                                                   |
|  Cursor:                                                          |
|  [Editor] --> [Agent Mode] --> [Multi-file RL] --> [Apply Diffs]  |
|                    |                                               |
|                    +--> [Background Agent] --> [Cloud VM] --> [PR] |
|                                                                   |
|  Windsurf:                                                        |
|  [Editor] --> [Cascade Agent] --> [RAG Codebase] --> [Apply Edits]|
|                    |                                               |
|                    +--> [SWE-1.5 Model] --> [Fast Context]        |
|                                                                   |
|  Cline:                                                           |
|  [Editor] --> [Agent Loop] --> [Evaluate] --> [Self-Fix] --> [Act]|
|                    |                                               |
|                    +--> [Any LLM Provider] --> [Tool Calls]       |
+-------------------------------------------------------------------+
```

---

## 对比矩阵

| 特性 | OpenClaw | OpenHands | Open Interpreter | Claude Computer Use | Claude Code | Cursor |
|------|----------|-----------|-----------------|-------------------|-------------|--------|
| **类型** | 本地 agent | 开发 agent | 本地代码执行 | 视觉自动化 | 终端 agent | IDE agent |
| **许可证** | AGPL-3.0 | MIT | AGPL-3.0 | Proprietary API | Proprietary | Proprietary |
| **GitHub Stars** | 346K | 51K+ | 58K+ | N/A (API) | 42K+ | N/A |
| **是否沙箱化** | 否（主机） | 是（Docker） | 否（主机） | 需要 VM | 可配置 | 是（BG agents） |
| **LLM 支持** | 任意（模型无关） | 任意 | 100+ 模型 | 仅 Claude | 仅 Claude | 多模型 |
| **GUI 控制** | 否 | 是（BrowserGym） | 是（Computer API） | 是（原生） | 通过 computer-use | 否 |
| **代码执行** | 是（PI Agent） | 是（容器） | 是（本地） | 是（bash 工具） | 是（bash） | 是（终端） |
| **消息机制** | 24+ 平台 | Web UI / API | 终端 | API | 终端 / IDE | 编辑器 |
| **记忆** | 持久化（本地） | 基于会话 | 基于会话 | 按会话 | 会话 + CLAUDE.md | 项目范围 |
| **MCP 支持** | 社区 skill | 有限 | 否 | 通过 Claude | 原生 | 持续增长 |
| **最佳用途** | 个人助手 | 自主开发 | 数据分析 | GUI 自动化 | 专业开发 | IDE 工作流 |
| **风险等级** | 高（未沙箱化） | 低（已沙箱化） | 高（未沙箱化） | 中（需要 VM） | 中 | 低 |

---

## 市场趋势与采用情况（2026）

### 数据

- **MCP 生态系统**：10,000+ 个活跃服务器，9,700 万次月度 SDK 下载
- **Gartner 预测**：到 2026 年底，40% 的企业应用将集成 AI agents（较 2025 年初不到 5% 的水平大幅提升）
- **OpenClaw**：历史上最快达到 30 万 GitHub stars 的项目（不到 5 个月）
- **Claude Code**：截至 2026 年 2 月达到 25 亿美元 ARR，成为最快达到 10 亿美元规模的企业软件产品
- **Cursor**：年化收入 20 亿美元，Fortune 500 中一半公司采用

### 关键趋势

**1. Agent 类型趋同**：本地、云端与 IDE agent 之间的边界正在消融。Claude Code 在本地运行但使用云端模型；Cursor 的 Background Agents 在云端运行；OpenClaw 可连接任意 LLM。整体趋势正在走向一种可在任何环境中运行的通用 agent 架构。

**2. MCP 作为统一工具层**：MCP 已成为工具集成的标准，并被 Anthropic、OpenAI、Google 以及数百家工具提供商采用。2026 年路线图聚焦企业级准备能力：身份传递、工具预算、结构化错误语义和审计轨迹。

**3. 沙箱化成为非谈判项**：OpenClaw 的安全危机（135,000 个暴露实例）推动行业转向默认沙箱化架构。新 agent 被预期要开箱即提供隔离能力。

**4. 成本优化成为一级关注点**：Plan-and-Execute 模式（强模型负责规划，便宜模型负责执行）可将成本降低 90%。这是 agentic 形态对应云成本优化的做法。

**5. 后台与异步 agent**：Cursor 的 Background Agents 与 Claude Code 的 subagent spawning，代表着从同步、交互式 agent 向自治、异步 worker 的转变，这些 worker 会在完成后通知你。

---

## 系统设计面试角度

当在系统设计面试中被问到 tool-use agents 时，应关注以下维度：

**1. 安全模型**：执行是否沙箱化？凭证如何管理？如果 LLM 生成恶意代码会怎样？（OpenClaw 的 AGPL 许可证和未沙箱化执行 vs. OpenHands 的 Docker 隔离，是很好的对比点。）

**2. 状态管理**：agent 如何在工具调用之间保持上下文？基于会话（OpenHands）vs. 持久化内存（OpenClaw）vs. 基于文件（Claude Code 的 CLAUDE.md）？

**3. 工具发现**：静态清单（旧方法）vs. 通过 MCP 动态发现 vs. skill 市场（OpenClaw ClawHub）？

**4. 延迟预算**：函数调用（每次 tool call 50-200ms）vs. 基于视觉的自动化（每次截图-动作循环 1-3 秒）。这会如何影响 UX？

**5. 故障处理**：工具调用失败时怎么办？重试？回退？Human-in-the-loop？重试几次后放弃？

---

## 面试问题

### Q: 你的团队想构建一个内部 AI assistant。应该基于 OpenClaw、OpenHands，还是用 Claude Code + MCP 自建？

**Strong answer:**
这取决于使用场景和安全要求。OpenClaw 更适合面向个人助手且带消息集成的场景——如果目标是一个 Slack/Teams bot，并且希望保留持续的人格特征，它是理想选择。但其未沙箱化执行和 AGPL 许可证会带来企业合规方面的顾虑。OpenHands 更适合自主开发任务——它的 Docker 沙箱和 MIT 许可证更符合企业需求。对于定制的内部工具，Claude Code 配合 MCP servers 能提供最高控制力：你可以精确定义可用工具，在自己的基础设施中运行，并受益于 MCP 标准化的发现和认证。决策树是：以消息为先？选 OpenClaw。开发自动化？选 OpenHands。定制企业工具？选 MCP + 你自己的 agent loop。

### Q: 你会如何设计一个系统，让非技术用户借助 AI 自动化桌面任务？

**Strong answer:**
我会采用基于视觉的 computer-use 模式（例如 Claude Computer Use 或类似方案）。关键设计决策是：（1）始终在沙箱化 VM 中运行，让 agent 无法破坏用户的真实机器；（2）在任何破坏性操作前加入 Human-in-the-Loop 确认步骤，例如文件删除、表单提交、购买；（3）使用 Zoom Action 模式降低密集 UI 中的误点率；（4）设置 token/成本上限，防止失控循环；（5）把所有操作记录成审计轨迹。主要权衡是延迟——每个截图-动作步骤需要 1-3 秒——但这种方法无需 API 就能适用于任何应用。对于更高速度的工作流，可以把 computer-use 与 function calling 结合，用于有 API 的应用。

### Q: 为什么 OpenClaw 的增长速度超过了历史上任何开源项目？这对市场说明了什么？

**Strong answer:**
有三个因素。（1）**零摩擦 onboarding**：OpenClaw 对接了用户已经在使用的消息平台（WhatsApp、Telegram），用户不需要学习新的界面。（2）**SOUL.md 个性化**：给 agent 自定义人格的能力会产生情感黏性和病毒式传播，用户会分享自己的 agent。（3）**模型无关架构（model-agnostic architecture）**：用户不会被锁定在单一 LLM 提供商，降低成本并增加灵活性。市场信号是，agent 的“界面”比底层模型更重要。人们希望 agent 出现在他们所在的地方（消息应用，而不是网页 UI）。反过来看，如果快速增长没有同步投入安全性，就会导致 135,000 个暴露实例这样的危机，这对任何开源 agent 项目都是警示。

### Q: 比较 AI agent 的沙箱化与未沙箱化执行。你会在什么情况下选择各自方案？

**Strong answer:**
沙箱化（Docker/VM）：用于不可信代码执行、多租户系统或任何生产部署。OpenHands 在这方面做得很好——每个会话都有自己的 Docker 容器。代价是部署复杂度和性能开销。未沙箱化（主机访问）：仅用于单用户、可信、且用户全程看护的环境。Open Interpreter 和 OpenClaw 采用这种方式以获得最大能力。风险是，糟糕的 LLM 输出可能损坏主机系统。2026 年的共识是默认沙箱化，并为高级用户保留“逃逸”入口。在面试中，一定要说明：沙箱边界是安全决策，而不仅仅是便利性决策。

---

## 参考资料

- OpenClaw GitHub 仓库与文档 (2025-2026)
- OpenHands 文档与 SDK 参考 (2025-2026)
- Open Interpreter GitHub 仓库 (2024-2026)
- Anthropic. "Computer Use Tool Documentation" (2024-2026)
- Anthropic. "Claude Code Overview" (2025-2026)
- MCP 规范 2025-11-25 与 2026 年路线图
- Gartner. "AI Agent Adoption Projections" (2025-2026)
- Cursor、Windsurf 和 Cline 官方文档 (2025-2026)

---

*Next: [Architecture Patterns for Tool-Use Agents](02-architecture-patterns.md)*
