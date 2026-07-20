# Microsoft Agent Framework、CrewAI 与 Agent SDK 生态

过去一年里，多智能体框架生态显著收敛。Microsoft **已弃用 AutoGen**，并将其与 Semantic Kernel 合并为统一的 **Microsoft Agent Framework**（RC 1.0，2 月 2026；GA 目标为 2026 年第二季度）。CrewAI 已成熟到 v1.13，具备企业级特性，并报告被 Fortune 500 强中 60%+ 的公司采用。与此同时，每一家主要 AI 实验室都发布了自己的 agent SDK：Anthropic 的 Claude Agent SDK、OpenAI 的 Agents SDK，以及 Google 的 ADK。

## 目录

- [CrewAI：管理者视角](#crewai-管理者视角)
- [Microsoft Agent Framework（AutoGen 的继任者）](#microsoft-agent-framework-autogen-的继任者)
- [Agent SDK 生态](#agent-sdk-生态)
- [群体与点对点通信](#群体与-p2p)
- [框架比较矩阵](#框架比较矩阵)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## CrewAI：管理者视角

CrewAI 围绕 **Process（流程）** 这一概念构建。
- **基于角色的智能体**：你定义一个“研究员”、一个“写作者”和一个“经理”。
- **任务**：带有明确输出的显式目标。
- **流程编排**：顺序式、层级式或协商式（基于共识）。

### CrewAI Flows

CrewAI **Flows** 在经典 Crew 模式之上增加了一层 **状态机（state-machine）**：

```python
from crewai.flow.flow import Flow, listen, start

class ContentFlow(Flow):
    @start()
    def research_topic(self):
        # Returns research output
        return research_crew.kickoff({"topic": self.state["topic"]})
    
    @listen(research_topic)
    def write_article(self, research):
        # Triggered after research completes
        return writing_crew.kickoff({"research": research})
    
    @listen(write_article)
    def publish(self, article):
        # Final step
        return publisher.publish(article)
```

### CrewAI v1.13 亮点

CrewAI v1.13 标志着向企业级生产就绪迈出的一个转折点：

- **企业 SSO**：单点登录已为企业部署完整文档化
- **RBAC 改进**：基于角色的访问控制，附带完整的权限参考矩阵
- **GPT-5 兼容性**：修复了 OpenAI GPT-5 以及更新的、移除了对 `stop` 参数支持的 o 系列模型
- **A2A 任务执行**：以结构化、确定性的方式进行 Agent-to-Agent（智能体间）动态任务委派
- **NVIDIA NemoClaw 集成**：用于安全企业部署的基础设施级策略强制执行
- **RuntimeState RootModel**：为复杂工作流统一状态序列化

**适用场景**：CrewAI + Flows 最适合用于 **业务流程自动化**（内容流水线、数据分析工作流），这类场景的结构是清晰定义好的。CrewAI 报告称其支撑了大约 20 亿次 agentic 执行。

> *已于 2026 月核实。来源：docs.crewai.com/en/changelog*

---

## Microsoft Agent Framework（AutoGen 的继任者）

### 合并：AutoGen + Semantic Kernel = Agent Framework

Microsoft 在 2025 年底将 AutoGen 作为独立产品弃用，并将其与 Semantic Kernel 合并为统一的 **Microsoft Agent Framework**。Release Candidate 1.0 已于 2026 年 2 月发布，GA 目标为 2026 年第二季度。

**这次合并整合了什么：**
- **来自 AutoGen**：用于单智能体和多智能体对话模式的简单抽象（群聊、轮询、交接）
- **来自 Semantic Kernel**：企业级会话管理、类型安全、过滤器、遥测以及广泛的模型/嵌入支持

### 迁移路径

AutoGen 仍会继续获得 bug 修复和安全补丁，但 **新特性只会进入 Agent Framework**。Microsoft 提供了官方迁移指南。如果要启动新项目，请直接使用 Agent Framework。

### 关键能力

```python
# Microsoft Agent Framework: Graph-based workflow
from agent_framework import Agent, Workflow, HandoffStep

planner = Agent("Planner", model="gpt-5.5", system_message="Decompose tasks.")
executor = Agent("Executor", model="gpt-5.5-mini", system_message="Execute sub-tasks.")

workflow = Workflow(
    steps=[
        HandoffStep(from_agent=planner, to_agent=executor),
    ],
    state_management="session",  # Built-in session persistence
)
```

**框架亮点：**
- **统一的 .NET 与 Python**：两种语言使用相同的编程模型
- **基于图的工作流**：顺序、并发、交接和群聊模式，具备显式控制
- **状态管理**：面向长时运行和人类在环场景的稳健、基于会话的持久化
- **MCP 支持**：用于工具访问的原生 Model Context Protocol 集成
- **多提供方**：支持 OpenAI、Azure OpenAI、Anthropic、Google 以及本地模型

> *已于 2026 月核实。来源：learn.microsoft.com/en-us/agent-framework*

---

## Agent SDK 生态

如今，每一家主要 AI 实验室都发布了自己的 agent 框架。截止 2026 年 5 月，生态如下：

### Claude Agent SDK（Anthropic）

Claude Agent SDK（由 Claude Code SDK 更名而来）提供了驱动 Claude Code 的同样工具、agent 循环和上下文管理，作为 Python 和 TypeScript 的库提供。

- **内置工具**：文件读取、命令执行、代码编辑，智能体可立即工作，无需自定义工具实现
- **监督者模式**：带委派的层级式智能体树
- **部署**：支持 AWS Bedrock、Google Vertex AI 和 Azure
- **截至 2026 年 5 月**：Python v0.1.48+、TypeScript v0.2.71+

### OpenAI Agents SDK

OpenAI 面向多智能体工作流的轻量级框架，使用原生 Python/TypeScript 构造：

- **基于交接**：智能体通过 `Handoff(TargetAgent)` 相互委派，不需要中央监督者
- **Guardrails（护栏）**：内置输入验证和安全检查
- **MCP 集成**：原生支持 MCP 服务器工具
- **实时智能体**：支持 gpt-realtime-1.5 的语音智能体

### OpenAI AgentKit

AgentKit 是 OpenAI 构建在 Responses API 和 Agents SDK 之上的更高层工具集。Agents SDK 偏代码优先，而 AgentKit 面向希望用更少样板代码组装并交付智能体的团队：

- **Agent Builder**：用于组合和版本化多智能体工作流（节点、分支、循环）的可视化画布，然后导出为 Agents SDK 代码。
- **ChatKit**：可嵌入、可主题化的聊天 UI，可将智能体体验直接嵌入你的产品，而无需自己构建前端。
- **Connector Registry**：用于管理数据源和工具如何跨 OpenAI 产品连接的集中式管理界面，带治理和访问控制。
- **评估与护栏**：内置 trace 评分、数据集和提示优化钩子，让从构建到评估的闭环保持在同一处。

**何时使用**：AgentKit 适合希望使用托管式构建与交付闭环、并接受 OpenAI 基础设施的团队。当你需要完全控制循环时，切换到原始 Agents SDK；当你需要框架中立或自托管运行时，则切换到 LangGraph / Microsoft Agent Framework。

### OpenAI Apps SDK

Apps SDK 扩展了 **Model Context Protocol**，使一个 MCP 服务器能够连同其工具一起交付 UI。开发者同时定义逻辑和交互界面，应用在像 ChatGPT 这样的客户端中渲染。这与 MCP 规范正在标准化的 “MCP Apps”（服务器渲染 UI）理念相同，它把 MCP 服务器从无头工具端点变成了交互式界面。参见 [工具使用与 MCP](../07-agentic-systems/03-tool-use-and-mcp.md)。

### Google Agent Development Kit（ADK）

Google 的框架针对 Google 生态做了优化，但与模型无关：

- **多语言**：Python、TypeScript、Java、Go（截至 2026 年 5 月均为 1.0+）
- **原生 A2A**：内置 Agent-to-Agent 协议支持，便于跨厂商编排
- **Vertex AI 集成**：可部署到 Agent Engine Runtime 以获得托管式主机服务
- **基于图**：将智能体工作流建模为有向图

> *已于 2026 月核实。*

---

## 群体与 P2P

这两个框架（以及更广义的 SDK 生态）都已采用 **群体模式（Swarm Patterns）**。
- **交接**：不再由中央监督者控制，而是让智能体将对话“交接”给最相关的专家。
- **示例**：一个“销售智能体”发现用户在问技术问题，于是将线程交接给“支持智能体”。

---

## 框架比较矩阵

| 特性 | CrewAI | MS Agent Framework | LangGraph | Claude Agent SDK | OpenAI Agents SDK | Google ADK |
|---------|--------|-------------------|-----------|-----------------|-------------------|------------|
| **核心抽象** | 任务/流程/Flow | 工作流/智能体 | 状态/图 | 监督者/工具 | 交接/智能体 | 智能体图 |
| **架构** | 声明式 + 状态机 | 图工作流 | 命令式 DAG | 层级树 | 群体交接 | 有向图 |
| **易用性** | 高 | 中 | 低 | 中 | 高 | 中 |
| **控制力** | 低-中 | 中-高 | 高 | 中 | 低-中 | 中-高 |
| **最适合** | 业务自动化 | 企业 .NET/Python | 复杂编排 | 编码/工具型智能体 | 快速多智能体 | Google Cloud AI |
| **多语言** | Python | .NET + Python | Python | Python | Python + TS | Python、TS、Java、Go |
| **MCP 支持** | 是 | 是 | 通过工具 | 原生 | 是 | 是 |
| **A2A 支持** | 通过扩展 | 计划中 | 通过工具 | 否（直接） | 否（直接） | 原生 |

---

## 面试题

### 问：什么时候会选择 CrewAI 而不是 LangGraph？

**强答案：**
**速度 vs. 精度**。当我需要非常快速地为一个标准流程（例如内容生成或数据分析）搭建一组智能体时，我会使用 **CrewAI**。它开箱即提供了“规划”和“协作”的高层抽象。当我需要对每一次状态迁移、多轮人类在环触发器，或者无法放入“角色扮演团队”隐喻中的复杂错误恢复逻辑进行 **细粒度控制** 时，我会切换到 **LangGraph**。

### 问：Microsoft 已将 AutoGen 弃用于 Agent Framework。这会如何影响现有的 AutoGen 部署？

**强答案：**
AutoGen 仍会继续获得 bug 修复和安全补丁，因此现有部署不会立刻失效。然而，**所有新功能开发** 都会进入 Agent Framework。迁移路径已有详细文档：AutoGen 的 `AssistantAgent` 对应到 Agent Framework 的 `Agent` 类，`GroupChat` 对应到新的 `Workflow` 模式，而 Semantic Kernel 的企业特性（会话管理、遥测、过滤器）现在已经原生可用。迁移的关键收益是 **统一的 .NET 和 Python 支持** 以及 **基于图的工作流**，它们为多智能体执行路径提供了显式控制。新项目应直接从 Agent Framework 开始。

### 问：如何防止“无限循环”，即智能体彼此反复对话却始终无法解决任务？

**强答案：**
我们使用 **终止条件** 和 **最大对话轮次**。我们还会实现一个“批判智能体（Critic Agent）”，它唯一的职责是检测对话是否停滞。如果批判智能体检测到循环，就会触发用户代理来中断，或者强制将群聊管理器切换到不同的推理路径。我们还会监控 **Token Velocity（Token 速率）**：如果一对智能体在 100K 个 token、2 分钟内没有进展，我们会自动终止会话。在 2026 年，像 Microsoft Agent Framework 和 LangGraph 这样的框架提供了内置的工作流超时和状态检查点，使循环检测更具系统性。

---

## 参考资料
- CrewAI. "The Multi-Agent Process Engine" (2025/2026，v1.13)
- Microsoft. "Agent Framework Overview" (2026) — learn.microsoft.com/en-us/agent-framework
- Microsoft. "AutoGen to Agent Framework Migration Guide" (2026)
- Anthropic. "Claude Agent SDK" (2026) — platform.claude.com/docs/en/agent-sdk
- OpenAI. "Agents SDK Documentation" (2026)
- [OpenAI. "Introducing AgentKit" (2025)](https://openai.com/index/introducing-agentkit/)
- [OpenAI. "Apps SDK" (2025)](https://developers.openai.com/apps-sdk)
- Google. "Agent Development Kit" (2026) — google.github.io/adk-docs
- OpenAI Swarm. "Lightweight Multi-Agent Orchestration" (2024 技术报告)

---

*下一篇：[框架选择指南](08-framework-selection-guide.md)*
