# LangGraph 编排

LangGraph 是构建有状态、多智能体系统的**事实标准**。它在 2025 年 10 月达到 v1.0，并于 2026 年 9 月 21 日发布 1.2.12；LangGraph 0.4 会处于维护模式直到 2026 年 12 月。不同于简单链式流程，LangGraph 支持**循环**、**状态持久化**以及**Human-in-the-Loop（人类参与闭环）**干预。

采用情况取决于你查看的指标。截至 2026 年 10 月 1 日，CrewAI 在 GitHub stars 上仍领先（约 59.3K，`langchain-ai/langgraph` 约 42.6K）。按下载量看，LangGraph 则领先一个数量级：截至 10 月 1 日的一个月内，PyPI 下载量约 43.7M，而 `crewai` 约 2.4M；`@langchain/langgraph` 在 8 月 31 日至 9 月 29 日期间的 npm 下载量约 13.9M。star 衡量关注度；下载量衡量依赖采用，但会被 CI 和传递依赖放大。引用数字时应选择与论断相符的指标。

## 目录

- [图的理念](#图的理念)
- [循环与无环工作流](#循环与无环)
- [LangGraph 中的状态管理](#状态管理)
- [持久化与检查点](#持久化与检查点)
- [多智能体编排模式](#多智能体模式)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 图的理念

在 2023 年，智能体还是“黑盒”。
如今，智能体是**图**。
一个图由以下部分组成：
- **节点**：Python 函数（LLM、工具或数据处理）。
- **边**：节点之间的路径。
- **条件边**：根据**状态**决定路径的逻辑。

---

## 循环与无环

标准 LangChain 是**无环的**（顺序式）。
LangGraph 是**有环的**。
- **循环的力量**：智能体可以尝试一个工具，看到错误，然后**循环返回**到“思考”节点再试一次。这是 **ReAct** 模式的基础。

---

## 状态管理

**状态模式**是图的“大脑”。
```python
class GraphState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    plan: list[str]
    is_secure: bool
```
**细微差别**：将 `Annotated` 与 `add_messages` 结合使用，可以让图对历史进行**追加**而不是覆盖，从而保留完整的推理轨迹。

---

## 持久化与检查点

当前 LangGraph 使用**基于线程的持久化**。
- **概念**：每个会话都有一个 `thread_id`，检查点存储（Postgres、SQLite、Redis，测试时也可用内存）会在每个超步后保存状态。
- **收益**：如果用户在 2 天后回来，智能体仍记得自己在多步骤工作流中的精确位置。
- **中断**：`interrupt()` 暂停节点以等待人工审批，然后从检查点恢复；持久的人类在环因此无需轮询循环。
- **时间旅行**：开发者可以从之前的状态“重新运行”某个特定线程，以调试故障。

竞争差距已经缩小。CrewAI 在 1.14（2026 年 4 月）加入检查点，Microsoft Agent Framework 提供工作流检查点，Google ADK 2.0 增加可暂停与恢复的图工作流。LangGraph 剩余优势在于成熟度：从任意检查点分叉调试，以及 LangSmith 追踪集成。

---

## 多智能体模式

| 模式 | 描述 | 案例研究 |
|---------|-------------|------------|
| **监督者** | 一个“管理者”指挥专门的工作者。 | 研究团队 |
| **点对点**| 智能体直接彼此移交任务。 | 客户支持 |
| **分层式**| 图中的图（嵌套图）。 | 企业工程 |

这些模式中的工具访问越来越多地通过 MCP 实现：自 `langchain` 1.4.0（2026 年 9 月 3 日）起，MCP 适配器已进入核心 `langchain` 包，因此 LangGraph 节点可挂载 MCP 服务器，而无需单独的适配器依赖。

---

## 面试题

### Q: 为什么使用 LangGraph，而不是 OpenAI Agents API 或 Claude Managed Agents 等托管式 agent 运行时？

**强有力的回答：**
**控制力与可移植性，和卸下运维负担之间的取舍。** 过去这个问题常拿 OpenAI Assistants API 作比较；它于 2026 年 8 月 26 日关闭，迫使所有基于 Threads 的应用迁移到 Responses 加 Conversations。这首先说明：供应商托管的状态可能按供应商的时间表消失。取代它的托管运行时好得多（2026 年 9 月 10 日公开测试的 OpenAI Agents API 运行 Codex 执行框架，提供持久会话、压缩与恢复；Claude Managed Agents 增加会话预算、服务端评估的权限策略，以及以 `ant apply` 定义 agent 配置），也确实减少了工作量。但循环在供应商一侧运行。LangGraph 是**白盒框架**：我可以使用任意模型（OpenAI、Claude、开放权重模型），精确控制何时调用工具，在步骤之间注入校验，并在本地部署。对受监管工作负载，关键事实很具体：Agents API 公测版仅支持美国数据驻留，且不支持 Zero Data Retention。我的默认选择是在核心工作流使用 LangGraph（或轻量自定义循环）；当托管运行时的压缩和沙箱收益超过锁定成本时，用它处理叶子 agent。

### Q: 在一个有 20+ 个节点的图中，你如何处理“状态过载”？

**强有力的回答：**
我们使用**状态收窄**。我们不会把整个全局状态传给每个节点，而是为子图定义专门的子状态。我们还使用 `trim_messages`（或摘要节点）在消息历史送入 LLM 之前对其进行裁剪，确保在持久化层保留“事实”的同时，不浪费 token。大型工具结果会放入存储，在状态中留下指针；Haystack 3.0 和 Agno 3.0 也已将这种工具结果转存模式内置。

---

## 参考资料
- LangChain。“LangGraph: Multi-Agent Workflows”（2024 年 1 月）：https://www.langchain.com/blog/langgraph-multi-agent-workflows
- LangGraph 持久化文档：https://docs.langchain.com/oss/python/langgraph/persistence
- LangChain 发布策略：https://docs.langchain.com/oss/python/release-policy
- Anthropic。“Building Effective AI Agents”（2024 年 12 月；工作流与 agent、编排者与工作者、评估者与优化者）：https://www.anthropic.com/engineering/building-effective-agents

---

*下一篇: [LangSmith 可观测性](03-langsmith-observability.md)*
