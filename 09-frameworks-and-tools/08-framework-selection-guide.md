# 框架选择指南

过去一年，AI 框架的格局已显著整合。如今，每家主要 AI 实验室都在推出自己的智能体 SDK；微软将 AutoGen 和 Semantic Kernel 合并为统一的 Agent Framework（2026 年 4 月正式发布）；各实验室也开始以托管运行时提供智能体循环；互操作协议（MCP、A2A）已成为标配。本指南提供了用于根据生产需求、团队经验和系统规模选择技术栈的**决策矩阵**。

## 目录

- [框架格局](#框架格局)
- [决策矩阵](#决策矩阵)
- [自建 vs. 购买 vs. 框架](#自建-vs-购买-vs-框架)
- [应避免的反模式](#应避免的反模式)
- [Staff 级建议](#staff-级建议)
- [面试问题](#面试问题)

---

## 框架格局

### 编排与智能体框架

| 框架 | 层级 | 主要价值 | 主要弱点 |
|-----------|------|----------|----------|
| **LangGraph** | L1（核心） | 精确的状态控制、基于图的编排、检查点时间旅行 | 复杂度高，学习曲线陡峭 |
| **DSPy** | L1（核心） | 可靠性与优化（MIPROv2、GEPA、Flex） | 前期成本（每个模型都要编译运行） |
| **LlamaIndex**| L2（数据） | 高级检索（RAG）、摄取和解析 | 逻辑灵活性不足；厂商重心于 2026 年 9 月转向解析产品 |
| **CrewAI** | L3（应用） | 业务流程提速、企业 RBAC、检查点（1.14+） | 会掩盖失败 |
| **MS Agent Framework** | L1（企业） | 统一的 .NET + Python，取代 AutoGen + SK，2026 年 4 月正式发布并提供长期支持 | 以 Azure 为先；几乎每周发布新版本 |
| **Pydantic AI / Mastra** | L1（类型化） | Python（Pydantic AI 2.x）和 TypeScript（Mastra）的类型化智能体 | 生态规模较小；见[第 11 章](11-pydantic-ai-and-mastra.md) |
| **Vercel AI SDK 7** | L2（TS 运行时） | 厂商中立的 TS 调用、持久化 `WorkflowAgent`、实验性 `HarnessAgent` | 智能体抽象比其核心能力更新 |
| **Haystack 3** | L2（数据 + 智能体） | 带生命周期钩子、技能和工具结果外置的智能体（3.0，2026 年 7 月） | 3.0 移除了 `ToolInvoker`，并将 30 个组件拆入独立包 |
| **Agno 3** | L2（智能体） | 工具结果外置、CodeMode（用一个沙箱解释器替代宽泛的工具 schema） | 3.0（2026 年 8 月）要求迁移数据库 |

### Agent SDK（实验室特定）

| 框架 | 层级 | 主要价值 | 主要弱点 |
|-----------|------|----------|----------|
| **Claude Agent SDK** | L1（智能体） | 内置工具、生产级智能体循环、预算控制 | 需要 Claude 模型 |
| **OpenAI Agents SDK** | L1（智能体） | 轻量级交接（handoffs）、护栏（guardrails）、沙箱智能体 | 偏向 OpenAI 生态；0.x 小版本也会改变行为 |
| **Google ADK** | L1（智能体） | 图工作流（2.0）、多语言、原生 A2A + Google Cloud | 偏向 Google 生态；Java 仍处于 1.x |
| **AWS Strands Agents** | L1（智能体） | AWS 原生、模型无关，PyPI 下载量最高的实验室 SDK | Harness 包会在版本间改变默认模型 |

### 托管智能体运行时

| 运行时 | 层级 | 主要价值 | 主要弱点 |
|-----------|------|---------------|--------------|
| **Claude Managed Agents** | L1（托管） | 沙箱、会话预算、服务端评估的权限策略、智能体即代码（`ant apply`） | 仅 Claude；第二种计费项（每运行会话小时 $0.08） |
| **OpenAI Agents API** | L1（托管） | 托管 Codex harness：上下文压缩、恢复、子代理 | 公开 beta；仅美国数据驻留，不支持 ZDR |
| **Bedrock Managed Agents** | L1（托管） | AWS 内置 Agents API，集成 IAM 和 CloudTrail | 预览版；仅三个美国区域 |

### 编码智能体

| 框架 | 层级 | 主要价值 | 主要弱点 |
|-----------|------|----------|----------|
| **Claude Code** | L1（编码） | 自主式 CLI 编码智能体、插件、企业托管设置 | 需要 Claude 模型；闭源 |
| **Codex CLI** | L1（编码） | 开源（Apache-2.0）CLI、云端环境、代码审查 | 默认值偏向 OpenAI |
| **Cursor / Windsurf** | L2（IDE） | 紧密的 IDE + 智能体集成、云端智能体 | 闭源基础设施；Cursor 现属 SpaceX，Windsurf 现属 Cognition |
| **OpenCode / OpenHands** | L2（编码） | 开源、适配任意模型 | 自行负责托管、沙箱和升级 |

Semantic Kernel 不再作为新项目选项列出：Microsoft Agent Framework 是其继任者，现有 SK 用户应规划迁移。

采用数据也支持“叶子节点使用实验室 SDK、核心使用中立编排器”的建议。截至 2026 年 10 月 1 日的一个月内，PyPI 下载量为：`langchain` 1.694 亿、`langgraph` 4,370 万、`strands-agents` 3,650 万、`claude-agent-sdk` 2,890 万、`openai-agents` 1,210 万、`google-adk` 990 万、`llama-index-core` 660 万、`pydantic-ai` 530 万、`dspy` 520 万、`crewai` 240 万、`agno` 170 万、`agent-framework-core` 92 万、`haystack-ai` 54 万、`autogen-agentchat` 38 万、`semantic-kernel` 29 万。npm 下载量（8 月 31 日至 9 月 29 日）：`ai`（Vercel AI SDK）1.046 亿、`@anthropic-ai/claude-agent-sdk` 4,870 万、`@langchain/langgraph` 1,390 万、`@openai/agents` 730 万、`@mastra/core` 690 万。CI 安装和传递依赖都会抬高这些数字，因此应将其作为相对信号。

---

## 决策矩阵

**使用以下逻辑选择你的技术栈：**

### 核心编排
1. **这是纯 RAG 应用吗？** → **LlamaIndex**（将它放在自有检索接口之后）。
2. **是否需要长时间运行的状态/人类在环？** → **LangGraph**。
3. **高可靠性（99%+）和跨模型可移植性是否关键？** → **DSPy**。
4. **你是 C#/.NET 企业团队吗？** → **Microsoft Agent Framework**（替代 Semantic Kernel + AutoGen）。
5. **你在为业务用户构建高级自动化吗？** → **CrewAI + Flows**。
6. **服务是否以 TypeScript 为主？** → 调用使用 **Vercel AI SDK**，智能体与工作流使用 **Mastra** 或 **LangGraph TS**。

### Agent SDK（按主力模型提供方选择）
7. **在 Claude / Anthropic API 上构建智能体？** → **Claude Agent SDK**（Python/TS，内置文件/代码/命令工具）。
8. **在 OpenAI API 上构建智能体？** → **OpenAI Agents SDK**（轻量级交接，护栏，支持 MCP）。
9. **在 Google Cloud / Gemini 上构建智能体？** → **Google ADK**（图工作流、原生 A2A、Vertex AI 部署、多语言）。
10. **需要跨厂商智能体通信吗？** → 在上述任意框架之上使用 **A2A 协议**。
11. **希望由供应商运行智能体循环（上下文压缩、恢复、沙箱）？** → 先核对数据驻留、ZDR 和按会话时长计费，再选择**托管运行时**。

### 编码智能体
12. **你在做面向文件系统级别的自主编程任务吗？** → **Claude Code** 或 **Codex CLI**（终端），**Cline**（VS Code）。
13. **需要适配任意 LLM 的开源编码智能体吗？** → **OpenCode**（MIT）或 **OpenHands**（Docker）。
14. **希望获得最佳 IDE + AI 体验吗？** → **Cursor**（闭源）或 **Windsurf**（Cognition）。

---

## 自建 vs. 购买 vs. 框架

作为 Staff Engineer，你必须抵制**框架臃肿**。

- 当它解决的是**非平凡计算机科学问题**时使用框架（例如：状态持久化、贝叶斯提示优化、向量-图连接）。
- 当你只是在进行简单的 LLM 调用时，**自建轻量封装**。框架会带来额外延迟、更新频繁的变化以及调试开销，对于单轮智能体而言通常不值得。

**先说清模式，再选择框架。** 从 2026 年 6 月末到 9 月末，多个独立框架都交付了以下三种原语：

| 模式 | 作用 | 实现示例 |
|---|---|---|
| **Harness 优先的 API** | 智能体是可配置的 harness（工具、钩子、指令和设置打包为 capability），而非裸循环 | Pydantic AI 2 capability、AI SDK 7 `HarnessAgent`（实验性）、MAF Harness Agent、OpenAI Agents API（托管 Codex harness） |
| **工具结果外置** | 大型工具输出写入文件或存储，向上下文提供指针及读取/搜索工具 | Haystack 3.0 `ToolResultOffloadHook`、Agno 3.0（结果超过 16,000 字符时） |
| **代码模式工具** | 模型在沙箱解释器中编写调用工具的代码，而非为每个工具输出一条 JSON 调用 | Agno CodeMode、MAF `HyperlightCodeActProvider`（微软报告在其工作负载上减少超过 60% 的 token）、DSPy 3.4 `LocalInterpreter` |

好的设计回答应解释这些机制，并将框架视为实现细节。如果框架缺少其中一种，通常只需几百行代码即可补上。

---

## 应避免的反模式

1. **框架隧道化**：试图把复杂逻辑流程强行塞进不支持它的框架里（例如，用纯 RAG 库去做编码智能体）。
2. **金锤子效应**：因为 LangChain 很流行就使用它，而一个 50 行的 Python 脚本会更快、更便宜。
3. **忽视可观测性**：在没有 LLMOps 层（LangSmith、Langfuse、Phoenix）的情况下部署任何框架；最好选用能摄取 OpenTelemetry、便于导出追踪的方案。
4. **信任默认值**：让框架选择模型。2026 年 8 月和 9 月，OpenAI Agents SDK（0.20.0）、Claude Code（2.1.280 与 2.1.284）、Codex CLI（rust-v0.159.1）和 Strands harness 包都改变了默认模型，让所有未显式设置模型的调用方在成本、延迟和行为上悄然变化。

---

## Staff 级建议

对于一个现代、生产级的 agentic 系统：
- **编排**：LangGraph（用于状态与循环）或 Microsoft Agent Framework（用于 .NET 团队）。
- **Agent SDK**：与模型提供方匹配：Claude Agent SDK（Anthropic）、Agents SDK（OpenAI）、ADK（Google）、Strands（AWS）。都支持 MCP 工具接入。
- **托管运行时**：只在叶子智能体上使用，且上下文压缩、恢复与沙箱的收益高于锁定成本，并满足数据驻留和 ZDR 条款。
- **优化**：DSPy（用于为不同模型层级编译提示）。
- **检索**：LlamaIndex（用于多阶段 RAG）。
- **可观测性**：选用可导出数据、兼容 OpenTelemetry 的追踪工具（LangSmith、Langfuse、Phoenix）。
- **跨厂商智能体**：A2A 协议，用于组织边界内外的智能体协同。
- **自主编码**：Claude Code 或 Codex CLI（终端）、Cline（VS Code），用于文件级编辑任务。
- **开源编码智能体**：OpenCode 或 OpenHands，用于自托管或 CI 流水线集成。

**2026 年洞察**：
1. agentic 编码工具（Claude Code、Codex、Cursor、OpenHands）不是编排框架的替代品。它们是一个**新类别**，运行在文件系统层，位于 LLM API 之上、应用逻辑之下。AI SDK 7 的 `HarnessAgent` 更进一步，把这些 harness 当作可插拔依赖。
2. 协议层已经成熟：**MCP 用于智能体到工具**，**A2A 用于智能体到智能体**，它们正在成为基础设施标准，而不是可选附加项。你的架构应同时支持两者。
3. 每家实验室都发布自己的 agent SDK，如今还提供自己的托管运行时，会带来**厂商锁定风险**。可通过 MCP 处理工具接入（跨 SDK 可移植）、A2A 处理智能体协同（厂商中立），并在自有仓库中以代码保存智能体定义来缓解。
4. 框架正在收敛于相同的运行时原语（harness 优先 API、工具结果外置、代码模式工具），因此持久的能力是理解这些原语，而非记住类名。

---

## 面试问题

### 问：为什么我们看到从“提示词编写（Prompting）”转向“编程（Programming，DSPy）”的趋势？

**强答案：**
**工业化**。提示工程像“炼金术”：它不稳定且无法规模化。通过类似 DSPy 的框架对 LLM 进行编程，可以让我们把 AI 视为一门**软件工程学科**。我们可以应用 CI/CD、单元测试（指标）和自动优化。这使 AI 从“非确定性魔法”转变为更大分布式系统中的一个**可预测组件**，而这正是任何关键生产环境的要求。

### 问：如果你必须构建一个能够同时在 OpenAI、Anthropic 和本地开放权重模型上运行的系统，你会如何设计架构？

**强答案：**
我会在提示层使用 **DSPy**，在编排层使用 **LangGraph**。DSPy 的 **Signatures** 让我可以将任务定义与模型的具体行为解耦。然后用**通用模型网关**（如 LiteLLM 或内部代理）处理不同的 API 格式。网关持有所有供应商密钥，因此是安全关键基础设施：2026 年 LiteLLM 自身就出现未经认证的 RCE（CVE-2026-37004，CVSS 9.8，修复于 1.83.7）和认证绕过（CVE-2026-49468，修复于 1.84.0），两个 PyPI 版本（1.82.7 和 1.82.8）遭到入侵。通过 `api_base` 窃取已存密钥的漏洞（CVE-2026-84377）仅在各小版本线的特定补丁版本中修复（例如 1.96.2），因此单一版本下限不足以保证安全。我会按公告中的修复版本清单固定精确版本，设置 `allow_client_side_credentials=false`，并避免将网关直接暴露在公网。网关还必须停止注入采样参数，因为 GPT-6 Astra 和近期 Claude 模型会拒绝自定义 `temperature`。工具接入使用 **MCP**：它与模型无关，同一 MCP 服务器可服务不同 LLM 后端。跨团队智能体协同则在边界层使用 **A2A**。这样从 GPT-6.1 Sol 切到 Claude Sonnet 5.5 时，不必重写 50 个提示词；只需重新编译、重跑评估套件并更新配置。

### 问：当每家 AI 实验室都在推出自己的 Agent SDK（Claude Agent SDK、OpenAI Agents SDK、Google ADK）时，你如何避免厂商锁定？

**强答案：**
关键是**将编排层与模型层分离**。我会使用与厂商无关的编排器，比如 LangGraph，或一个轻量级自定义封装，来处理核心工作流逻辑。模型专用 SDK 在原型阶段或当你已经确定只使用单一提供方时很有用，但在生产级多厂商系统中，我会把模型交互封装在抽象层之后（LiteLLM 网关或 DSPy Signatures）。在工具接入方面，**MCP** 提供可移植性，同一个 MCP server 可以配合任何 SDK 使用；在智能体协同方面，**A2A** 提供厂商中立的智能体通信。实际规则是：在叶子节点（单个智能体实现）使用实验室特定 SDK 和托管运行时，但把编排图、智能体定义和评估套件保留在自己的仓库中，并保持厂商中立。锁定也体现在生命周期上：如今同一个模型在不同云平台的退役日期不同，因此要按（模型、平台）配对跟踪，而非只按模型跟踪。

---

## 参考资料
- Gartner. “Gartner Predicts 40% of Enterprise Apps Will Feature Task-Specific AI Agents by 2026, Up from Less Than 5% in 2025”（新闻稿，2025 年 8 月 26 日）：https://www.gartner.com/en/newsroom/press-releases/2025-08-26-gartner-predicts-40-percent-of-enterprise-apps-will-feature-task-specific-ai-agents-by-2026-up-from-less-than-5-percent-in-2025
- Thoughtworks. Technology Radar（第 34 期，2026 年 4 月）：https://www.thoughtworks.com/radar
- Microsoft. “Agent Framework Overview”：https://learn.microsoft.com/en-us/agent-framework/overview/
- Anthropic. “Agent SDK reference: Python”：https://code.claude.com/docs/en/agent-sdk/python
- Google. “Agent Development Kit”：https://google.github.io/adk-docs
- OpenAI. Agents SDK releases：https://github.com/openai/openai-agents-python/releases
- OpenAI. “Agents API overview”（beta，2026 年 9 月）：https://developers.openai.com/api/docs/guides/agents-api/overview
- Vercel. “AI SDK 7”（2026 年 6 月）：https://vercel.com/blog/ai-sdk-7
- deepset. Haystack 3.0 发布说明（2026 年 7 月）：https://github.com/deepset-ai/haystack/releases/tag/v3.0.0
- Agno 3.0 发布说明（2026 年 8 月）：https://github.com/agno-agi/agno/releases/tag/v3.0.0

---

*下一篇： [Navigating Framework Churn](12-navigating-framework-churn.md)*
