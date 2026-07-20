# 框架选择指南

过去一年，AI 框架的格局已显著整合。如今，每家主要 AI 实验室都在推出自己的智能体 SDK，微软将 AutoGen 和 Semantic Kernel 合并为统一的 Agent Framework，互操作协议（MCP、A2A）已成为标配。本指南提供了用于根据生产需求、团队经验和系统规模选择技术栈的**决策矩阵**。

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
| **LangGraph** | L1（核心） | 精确的状态控制，基于图的编排 | 复杂度高，学习曲线陡峭 |
| **DSPy** | L1（核心） | 可靠性与优化 | 前期成本（训练） |
| **LlamaIndex**| L2（数据） | 高级检索（RAG） | 逻辑灵活性不足 |
| **CrewAI** | L3（应用） | 业务流程提速、企业 RBAC | 会掩盖失败 |
| **MS Agent Framework** | L1（企业） | 统一的 .NET + Python，取代 AutoGen + SK | RC 状态（GA 预计为 2026 年 Q2） |

### Agent SDK（实验室特定）

| 框架 | 层级 | 主要价值 | 主要弱点 |
|-----------|------|----------|----------|
| **Claude Agent SDK** | L1（智能体） | 内置工具，生产级智能体循环 | 需要 Anthropic API |
| **OpenAI Agents SDK** | L1（智能体） | 轻量级交接（handoffs），护栏（guardrails） | 偏向 OpenAI 生态 |
| **Google ADK** | L1（智能体） | 多语言，原生 A2A + Google Cloud | 偏向 Google 生态 |

### 编码智能体

| 框架 | 层级 | 主要价值 | 主要弱点 |
|-----------|------|----------|----------|
| **Claude Code** | L1（编码） | 自主式 CLI 编码智能体 | 需要 Anthropic API |
| **Cursor / Windsurf** | L2（IDE） | 紧密的 IDE + 智能体集成 | 闭源基础设施 |
| **OpenHands** | L2（编码） | 开源自主智能体 | 需要自托管 |

> **2026 年 4 月说明**：Semantic Kernel 不再作为独立框架列出。它已并入 Microsoft Agent Framework。现有 SK 用户应规划迁移。

---

## 决策矩阵

**使用以下逻辑选择你的技术栈：**

### 核心编排
1. **这是纯 RAG 应用吗？** → **LlamaIndex**。
2. **是否需要长时间运行的状态/人类在环？** → **LangGraph**。
3. **高可靠性（99%+）和跨模型可移植性是否关键？** → **DSPy**。
4. **你是 C#/.NET 企业团队吗？** → **Microsoft Agent Framework**（替代 Semantic Kernel + AutoGen）。
5. **你在为业务用户构建高级自动化吗？** → **CrewAI + Flows**。

### Agent SDK（按主力模型提供方选择）
6. **在 Claude / Anthropic API 上构建智能体？** → **Claude Agent SDK**（Python/TS，内置文件/代码/命令工具）。
7. **在 OpenAI API 上构建智能体？** → **OpenAI Agents SDK**（轻量级交接，护栏，支持 MCP）。
8. **在 Google Cloud / Gemini 上构建智能体？** → **Google ADK**（原生 A2A，Vertex AI 部署，多语言）。
9. **需要跨厂商智能体通信吗？** → 在上述任意框架之上使用 **A2A 协议**。

### 编码智能体
10. **你在做面向文件系统级别的自主编程任务吗？** → **Claude Code**（CLI）或 **Cline**（VS Code）。
11. **需要适配任意 LLM 的开源编码智能体吗？** → **OpenHands**（Docker）。
12. **希望获得最佳 IDE + AI 体验吗？** → **Cursor**（闭源）或 **Windsurf**（Codeium）。

---

## 自建 vs. 购买 vs. 框架

作为 Staff Engineer，你必须抵制**框架臃肿**。

- 当它解决的是**非平凡计算机科学问题**时使用框架（例如：状态持久化、贝叶斯提示优化、向量-图连接）。
- 当你只是在进行简单的 LLM 调用时，**自建轻量封装**。框架会带来额外延迟、更新频繁的变化以及调试开销，对于单轮智能体而言通常不值得。

---

## 应避免的反模式

1. **框架隧道化**：试图把复杂逻辑流程强行塞进不支持它的框架里（例如，用纯 RAG 库去做编码智能体）。
2. **金锤子效应**：因为 LangChain 很流行就使用它，而一个 50 行的 Python 脚本会更快、更便宜。
3. **忽视可观测性**：在没有 LLOps 层（LangSmith/Phoenix）的情况下部署任何框架。

---

## Staff 级建议

对于一个现代、生产级的 agentic 系统：
- **编排**：LangGraph（用于状态与循环）或 Microsoft Agent Framework（用于 .NET 团队）。
- **Agent SDK**：与模型提供方匹配——Claude Agent SDK（Anthropic）、Agents SDK（OpenAI）、ADK（Google）。都支持 MCP 工具接入。
- **优化**：DSPy（用于为不同模型层级编译提示）。
- **检索**：LlamaIndex（用于多阶段 RAG）。
- **可观测性**：LangSmith（用于追踪与评估）。
- **跨厂商智能体**：A2A 协议，用于组织边界内外的智能体协同。
- **自主编码**：Claude Code（CLI）或 Cline（VS Code），用于文件级编辑任务。
- **开源编码智能体**：OpenHands，用于自托管或 CI 流水线集成。

**2026 年洞察**：
1. agentic 编码工具（Claude Code、Cursor、OpenHands）不是编排框架的替代品，它们是一个**新类别**，运行在文件系统层，位于 LLM API 之上、应用逻辑之下。
2. 协议层已经成熟：**MCP 用于智能体到工具**，**A2A 用于智能体到智能体**，它们正在成为基础设施标准，而不是可选附加项。你的架构应同时支持两者。
3. 每家实验室都发布自己的 agent SDK 会带来**厂商锁定风险**。可通过使用 MCP 处理工具接入（跨 SDK 可移植）以及 A2A 处理智能体协同（厂商中立）来缓解。

> *更新于 2026 年 5 月。*

---

## 面试问题

### 问：为什么我们看到从“提示词编写（Prompting）”转向“编程（Programming，DSPy）”的趋势？

**强答案：**
**工业化**。提示工程像“炼金术”：它不稳定且无法规模化。通过类似 DSPy 的框架对 LLM 进行编程，可以让我们把 AI 视为一门**软件工程学科**。我们可以应用 CI/CD、单元测试（指标）和自动优化。这使 AI 从“非确定性魔法”转变为更大分布式系统中的一个**可预测组件**，而这正是任何关键生产环境的要求。

### 问：如果你必须构建一个能够同时在 OpenAI、Anthropic 和本地 Llama 模型上运行的系统，你会如何设计架构？

**强答案：**
我会在提示层使用 **DSPy**，在编排层使用 **LangGraph**。DSPy 的 **Signatures** 让我可以将任务定义与模型的具体行为解耦。然后我会使用一个 **通用模型网关**（比如 LiteLLM 或内部代理）来处理不同的 API 格式。在工具接入方面，我会使用 **MCP**，因为它与模型无关，因此无论哪个 LLM 后端处于激活状态，相同的 MCP 服务器都能工作。如果我需要跨团队的智能体协同，我会在边界层使用 **A2A**。这套技术栈确保当我因为成本或延迟原因需要从 GPT-4o 切换到 Claude Sonnet 4 时，不必重写 50 个提示词；我只需要重新编译或更新配置。

### 问：当每家 AI 实验室都在推出自己的 Agent SDK（Claude Agent SDK、OpenAI Agents SDK、Google ADK）时，你如何避免厂商锁定？

**强答案：**
关键是**将编排层与模型层分离**。我会使用与厂商无关的编排器，比如 LangGraph，或一个轻量级自定义封装，来处理核心工作流逻辑。模型专用 SDK 在原型阶段或当你已经确定只使用单一提供方时很有用，但在生产级多厂商系统中，我会把模型交互封装在抽象层之后（LiteLLM 网关或 DSPy Signatures）。在工具接入方面，**MCP** 提供可移植性，同一个 MCP server 可以配合任何 SDK 使用；在智能体协同方面，**A2A** 提供厂商中立的智能体通信。实际规则是：在叶子节点（单个智能体实现）使用实验室特定 SDK，但让编排图保持厂商中立。

---

## 参考资料
- Google Cloud. "Enterprise Generative AI Reference Architecture" (2025)
- Gartner. "Magic Quadrant for AI Application Frameworks" (2025)
- Gartner. "Predicts 2026: 40% of Enterprise Apps to Feature AI Agents" (2025)
- Thoughtworks. "Technology Radar: The Rise of Agentic Frameworks" (Nov 2024/2025)
- Microsoft. "Agent Framework Overview" (2026)
- Anthropic. "Claude Agent SDK" (2026)
- Google. "Agent Development Kit" (2026)
- OpenAI. "Agents SDK" (2026)

---

*下一篇： [Navigating Framework Churn](12-navigating-framework-churn.md)*
