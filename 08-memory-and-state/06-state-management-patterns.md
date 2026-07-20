# 状态管理模式

AI 系统中的状态管理已从简单的“会话”演进为 **有状态智能体图（Stateful Agent Graphs）**。管理智能体“心智”的流转与持久化与 LLM 本身同等关键：这是 LangGraph 成为 LangChain 构建的智能体默认控制流运行时的主要原因之一。

## 目录

- [状态对象](#状态对象)
- [状态机 vs. DAG 编排](#状态机-langgraph)
- [检查点与恢复](#检查点与恢复)
- [并行状态与 Fork/Join（分支/汇合）](#并行状态-fork-join)
- [时间旅行（状态重写）](#时间旅行-状态重写)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 状态对象

“State（状态）”是智能体会话的 **Single Source of Truth（唯一可信来源）**。  
```python
class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    plan: list[str]
    current_task: str
    tool_results: dict[str, Any]
    user_context: dict[str, Any]
    iteration_count: int
```
**最佳实践**：在可能的情况下，状态应当 **严格类型化（Strictly Typed）** 且 **仅追加（Append-Only）**，以避免在长时间执行循环中丢失数据。

---

## 状态机（LangGraph）

行业实践已趋于采用 **循环图（Cyclic Graphs）**（State Machines）。  
- **节点（Nodes）**：接受状态并返回更新的函数。  
- **边（Edges）**：基于状态值决定下一个节点的条件逻辑（例如 `if state['error'] -> goto 'recovery_node'`）。

---

## 检查点与恢复

在生产环境中，智能体可能持续运行数分钟甚至数小时。  
- **持久化层（Persistence Layer）**：每次状态更新都保存到数据库（Postgres/Redis）。  
- **恢复能力（Resiliency）**：如果服务器崩溃，编排器会恢复到最后一个 `checkpoint_id`，并从停下的位置继续。  
- **用户体验（UX）**：这支持 **异步智能体（Asynchronous Agents）**，用户会先看到“我正在处理”提示，10 分钟后在状态为“完成”时收到通知。

---

## 并行状态（Fork/Join）

对于复杂任务，我们会对状态进行 **Fork（分叉）**。  
1. **Fan-out（扇出）**：将状态发送给 3 个子智能体（例如 Researcher A、B、C）。  
2. **Fan-in（汇合，Join）**：一个“Manager（管理者）”智能体接收三者输出，并将其合并回主状态对象。

---

## 时间旅行（状态重写）

如 HITL（Human-In-The-Loop，人类在环）章节所述，状态管理支持 **Human Intervention（人类干预）**。  
- 开发者可以浏览会话历史，找到一个“bad turn（错误转折）”，编辑该时间点的状态对象，并从该点 **Re-run（重跑）** 图（Graph）。

---

## 面试题

### Q: 为什么要为智能体使用“基于图的”状态机（LangGraph），而不是简单的“While 循环”？

**高质量答案：**  
While 循环是 **Opaque and Brittle（不透明且脆弱）**。你很难可视化其逻辑，错误处理也会演变为一团套娃式的 if 分支。基于图的方式是 **Observable and Modular（可观测且模块化）**。你可以可视化完整流程为 Mermaid 图，分别对单个节点进行单元测试，并通过新增边轻松实现 “Backtracking（回溯）” 或 “Parallel execution（并行执行）” 等复杂能力。它也使得 **State Persistence（状态持久化）** 变得几乎自动化，因为框架会处理节点间的保存与加载。

### Q: 如何防止长期运行的智能体会话中出现 “State Bloat（状态膨胀）”？

**高质量答案：**  
我们使用 **State Pruning（状态裁剪）** 与 **Message Summarization（消息摘要化）**。我们不会在整个图中携带完整的 `tool_results` 字典，而是在子任务完成后对其进行裁剪。对于 `messages` 列表，我们使用一个专门的 “Summarizer Node（摘要节点）”，每 10 轮运行一次，将历史压缩为简洁的上下文块，以避免触及 token 限制，同时保持状态对象的响应能力。

---

## 参考资料
- LangChain. “LangGraph: Multi-Agent Workflows” (2024/2025)
- Temporal.io. “Stateful AI Agents at Scale” (2025)
- AWS Bedrock. “Managing Long-Running Agent Sessions” (2025)

---

*下一篇：[第 09 节：框架与工具](../09-frameworks-and-tools/01-langchain-deep-dive.md)*
