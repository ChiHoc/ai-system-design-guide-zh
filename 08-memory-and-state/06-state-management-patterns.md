# 状态管理模式

AI 系统中的状态管理已从简单的“会话”演进为 **有状态智能体图（Stateful Agent Graphs）**。管理智能体“心智”的流转与持久化与 LLM 本身同等关键：这是 LangGraph（1.2.12 于 2026 年 9 月 21 日发布）成为 LangChain 构建的智能体默认控制流运行时的主要原因之一。2026 年，“如何组织状态”之外又有了第二个问题：**谁来持有状态**，是自有检查点存储、持久化工作流引擎，还是托管式 agent 平台？

## 目录

- [状态对象](#状态对象)
- [状态机 vs. DAG 编排](#状态机-langgraph)
- [检查点与恢复](#检查点与恢复)
- [状态存放在哪里](#状态存放在哪里)
- [并行状态与 Fork/Join（分支/汇合）](#并行状态-fork-join)
- [时间旅行（状态重写）](#时间旅行-状态重写)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 状态对象

“State（状态）”是智能体会话的 **Single Source of Truth（唯一可信来源）**。  
```python
from typing import Annotated, Any, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    plan: list[str]
    current_task: str
    tool_results: dict[str, Any]
    user_context: dict[str, Any]
    iteration_count: int
```
**最佳实践**：在可能的情况下，状态应当 **严格类型化（Strictly Typed）** 且 **仅追加（Append-Only）**，以避免在长时间执行循环中丢失数据。仅追加对模型也很重要：最新的 Claude 模型会在先前消息变化时让 thinking 块失效，因此原地改写 `messages` 的状态归约器会悄然破坏推理连续性。

---

## 状态机（LangGraph）

行业实践已趋于采用 **循环图（Cyclic Graphs）**（State Machines）。  
- **节点（Nodes）**：接受状态并返回更新的函数。  
- **边（Edges）**：基于状态值决定下一个节点的条件逻辑（例如 `if state['error'] -> goto 'recovery_node'`）。

LangGraph 的领先优势已经缩小：CrewAI 在 1.14 中加入检查点；Microsoft Agent Framework 提供工作流检查点及可重新连接的后台响应；Google ADK 2.x 增加图工作流。参见 [LangGraph 编排](../09-frameworks-and-tools/02-langgraph-orchestration.md)。

---

## 检查点与恢复

在生产环境中，智能体可能持续运行数分钟甚至数小时。  
- **持久化层（Persistence Layer）**：每次状态更新都保存到数据库（Postgres/Redis）。  
- **恢复能力（Resiliency）**：如果服务器崩溃，编排器会恢复到最后一个 `checkpoint_id`，并从停下的位置继续。  
- **副作用**：恢复时会从上一个检查点重放，因此其后的工具调用可能执行两次。应为有副作用的工具提供幂等键，或在推进检查点前记录其结果。
- **用户体验（UX）**：这支持 **异步智能体（Asynchronous Agents）**，用户会先看到“我正在处理”提示，10 分钟后在状态为“完成”时收到通知。

---

## 状态存放在哪里

| 方案 | 状态持有者 | 优势 | 代价 |
|--------|---------------------|-----------|-------|
| **图检查点存储**（LangGraph + Postgres） | 你自己，按超步保存 | 完全可控、状态可检查、支持时间旅行 | 重试、超时和幂等性需要自己实现 |
| **持久化工作流引擎**（Temporal、Durable Functions） | 引擎的事件历史 | 重试、定时器和工作流逻辑中的恰好一次语义；模型与工具调用成为带重试策略的活动 | 工作流代码受确定性规则约束；还需运行一套系统 |
| **托管式 agent 平台**（Claude Managed Agents、OpenAI Agents API、预览版 Bedrock Managed Agents） | 供应商会话 | 无需自己维护循环或状态存储；agent 配置可版本化；会话预算 | 数据驻留和留存受供应商约束（OpenAI Agents API 自 2026 年 9 月 10 日公开测试以来仅支持美国驻留，且不支持 ZDR）；供应商锁定 |

前沿实验室也使用持久化执行（Temporal 报告 OpenAI 的使用量在不到一年内增长 60 倍），托管运行时则在改善冷启动：AWS 于 2026 年 9 月 18 日发布 AgentCore Runtime V2，报告 P75 冷启动约 2 秒，而原运行时约为 5.4 至 30 秒；虽然按更高费率计费，但消耗的 GB-hour 少得多（供应商数据）。自建与租用的取舍及面试题详见[持久化执行](../07-agentic-systems/11-durable-execution.md#托管式智能体运行时-租用持久循环)。

---

## 并行状态（Fork/Join）

对于复杂任务，我们会对状态进行 **Fork（分叉）**。  
1. **Fan-out（扇出）**：将状态发送给 3 个子智能体（例如 Researcher A、B、C）。  
2. **Fan-in（汇合，Join）**：一个“Manager（管理者）”智能体接收三者输出，并将其合并回主状态对象。

合并应通过归约器定义（按字段追加、求并集或采用最后写入者胜出），而不是任由分支覆盖共享键；还应限制扇出：例如 OpenAI Agents API 的 `max_concurrent_subagents` 默认值为 6。

---

## 时间旅行（状态重写）

如[人类在环模式](../07-agentic-systems/08-human-in-the-loop-patterns.md)所述，状态管理支持 **Human Intervention（人类干预）**。
- 开发者可以浏览会话历史，找到一个“bad turn（错误转折）”，编辑该时间点的状态对象，并从该点 **Re-run（重跑）** 图（Graph）。
- **将重写视为分叉，而非直接编辑。** 在 Claude Fable 5.1、Opus 5.5 和 Sonnet 5.5 上，thinking 块与产生它的精确对话前缀绑定。如果从编辑过的检查点重跑，却仍附带旧 thinking 块，2026 年 8 月 31 日及之后创建的账户会收到 400 错误（或在 `drop_block` beta 选项下丢弃这些块）。应从编辑点开始发起全新模型调用，并保留原分支供审计。

---

## 面试题

### Q: 为什么要为智能体使用“基于图的”状态机（LangGraph），而不是简单的“While 循环”？

**高质量答案：**  
While 循环是 **Opaque and Brittle（不透明且脆弱）**。你很难可视化其逻辑，错误处理也会演变为一团套娃式的 if 分支。基于图的方式是 **Observable and Modular（可观测且模块化）**。你可以可视化完整流程为 Mermaid 图，分别对单个节点进行单元测试，并通过新增边轻松实现 “Backtracking（回溯）” 或 “Parallel execution（并行执行）” 等复杂能力。它也使得 **State Persistence（状态持久化）** 变得几乎自动化，因为框架会处理节点间的保存与加载。不过也要承认：对于只有一条工具循环的单个 agent，while 循环配合持久化检查点通常就足够；只有存在分支、人类中断或并行子 agent 时，图的复杂度才值得付出。

### Q: 如何防止长期运行的智能体会话中出现 “State Bloat（状态膨胀）”？

**高质量答案：**  
我们使用 **State Pruning（状态裁剪）** 与 **Message Summarization（消息摘要化）**。我们不会在整个图中携带完整的 `tool_results` 字典，而是在子任务完成后对其进行裁剪，并在存储中保留指向完整输出的引用。对于 `messages` 列表，我们会在历史超过 token 阈值时压缩，优先采用供应商的压缩机制（可保持前缀缓存和 thinking 块有效），而不是编写会改写先前轮次的摘要器。摘要被视为不可信输出：保留原始转录，并检查摘要是否引入原文没有的指令。

### Q: 团队在 LangGraph 中编辑了一个错误轮次，然后从该检查点重放。切换到 Claude Opus 5.5 后，重放开始报 400 错误。发生了什么？

**高质量答案：**
Opus 5.5 将每个 thinking 块与模型及产生它的精确对话前缀绑定。编辑先前轮次会改变前缀，因此重放再次发送旧 thinking 块时，API 会检测到不匹配；对 2026 年 8 月 31 日及之后创建的账户，会返回 400。解决办法是把时间旅行视为分叉：去掉编辑点之后的 thinking 块，让模型重新推理；迁移期间也可以使用 binding-controls beta 的 `drop_block` 行为。我还会让主路径保持仅追加，用对话中途的系统消息修正内容，而非编辑旧消息，使只有刻意调试的会话需要承担重算成本。

---

## 参考资料
- [LangGraph 持久化与检查点文档](https://docs.langchain.com/oss/python/langgraph/persistence)
- [Temporal。“Amazon Bedrock AgentCore with Temporal Serverless Workers”（2026 年 9 月）](https://temporal.io/blog/amazon-bedrock-agentcore-with-temporal-serverless-workers)
- [AWS。“The new AgentCore Runtime”（2026 年 9 月）](https://aws.amazon.com/blogs/machine-learning/the-new-agentcore-runtime-elastic-optimized-and-consistently-fast-starts/)
- [Anthropic。Preserved thinking（thinking 块绑定）](https://platform.claude.com/docs/en/build-with-claude/preserved-thinking)

---

*下一篇：[第 09 节：框架与工具](../09-frameworks-and-tools/01-langchain-deep-dive.md)*
