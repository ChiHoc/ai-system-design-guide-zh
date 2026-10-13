# 推理循环：ReAct 及其他模式

Reasoning Loops（推理循环）定义了 agent 的控制流。虽然 **ReAct** 曾是 2023 年的基线，但当前系统在推理原生模型之上使用了更复杂的模式，如 **Plan-and-Solve**、**Self-Reflexion** 和 **Inference-Time Scaling**。

## 目录

- [循环的演进](#循环的演进)
- [ReAct：经典模式](#react-推理-行动)
- [Self-Reflexion 循环](#self-reflexion-循环)
- [Plan-and-Solve](#plan-and-solve)
- [Flow Engineering（LangGraph 模式）](#flow-engineering-langgraph-模式)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 循环的演进

| 时代 | 模式 | 核心理念 |
|-----|---------|-----------------|
| **2023** | ReAct | 交替进行思考和行动。 |
| **2024** | Reflexion | 评估错误并重试。 |
| **2025** | System 2 Loops | 使用隐藏的 CoT（Chain of Thought，思维链）实现可靠的多步逻辑。 |
| **2026** | 经过工程设计的运行框架循环 | 在工具调用之间穿插思考，由运行框架负责终止、验证和预算（参见[循环工程](12-loop-engineering.md)）。 |

---

## ReAct：推理 + 行动

90% 的 agent 的基础循环：
1. **Thought（思考）**: "I need to find X."
2. **Action（行动）**: `search_engine("X")`
3. **Observation（观察）**: "X is at Y."
4. **Repeat（重复）**.

**Critique（批评）**: ReAct 很脆弱。如果搜索返回 "No results"，一个简单的 ReAct agent 往往会再次执行同样的搜索。现代循环会注入 **"Negative Constraints（负向约束）"**（例如，"Don't try search results we've already seen"）。

---

## Self-Reflexion 循环

Reflexion 为循环增加了一个 **"Critic（评估者）"** 步骤。

```mermaid
graph TD
    A[User Goal] --> B[Actor]
    B --> C[Action + Result]
    C --> D{Critic / Evaluator}
    D -- "Success" --> E[Final Result]
    D -- "Fail / Loop" --> F[Reflection / Lesson]
    F --> B
```

**Benefit（优势）**: 通过将这些 "Reflections（反思）" 存入短期记忆，agent 在当前会话中建立起一个 "Mental Map（心智地图）"，表示哪些操作行不通。

---

## Plan-and-Solve

与其逐步决策（贪心策略），agent 先生成一个 **Static Plan（静态计划）**，再执行它。

1. **Planner（规划器）**: "I will do A, then B, then C."
2. **Executor（执行器）**: 执行各个步骤。
3. **Re-planner（重规划器）**: 如果步骤 B 失败，则触发完整重规划，而不是局部修复。

**Why?**: 规划可以减少 "Stochastic Errors（随机性错误）"。当模型提交一条路径后，不太容易被嘈杂的工具结果分散注意力。

---

## Flow Engineering（LangGraph 模式）

现代 agentic 系统已从 "Chat interfaces（聊天界面）" 迁移到 **"State Machines（状态机）"**。

- **Cyclic Graphs（循环图）**: 不再是线性序列，而是定义一个图，让模型可多次回到 "Cleaning（清理）" 节点或 "Validation（校验）" 节点。
- **Micro-Agents（微代理）**: 图中的每个节点都是一个专门化的 "Prompt（提示）" 或 "Tool（工具）"。

**Key Nuance（关键细节）**: "Agent（代理）" 不再只是 LLM；agent 是 **Graph Execution Engine（图执行引擎）**。

---

## 面试题

### Q: 你会在什么场景下使用 "Reasoning Loop（推理循环）"（ReAct）而不是 "Plan-and-Solve（规划-执行）" 架构？

**Strong answer（优秀答案）:**
我会在 **Exploratory（探索性）** 任务中选择 **ReAct**，例如你还不知道 URL 结构的新网站浏览场景（环境不可预测）。这类任务中，agent 需要对每次观察作出反应。我会在 **Predictable（可预测）** 但复杂的工作流中选择 **Plan-and-Solve**，例如从 5 个已知 API 生成财务报告。规划能避免模型“胡乱游走”（meandering），并支持不互相依赖步骤的更好并行化。

### Q: 什么是 "Inference-Time Scaling（推理时扩展）"，它与 Agentic Loops（代理循环）有什么关系？

**Strong answer（优秀答案）:**
Inference-Time Scaling（推理时扩展）由 OpenAI 的 o1 于 2024 年推广，指的是在响应生成过程中投入更多计算，而不仅仅是在训练阶段投入。在当前 API 中，它表现为 **effort（努力程度）**设置：GPT-6 Astra 提供从 low 到 max 的五档设置，Claude Opus 5.5 和 Fable 5.1 则通过努力程度参数调节自适应思考。在智能体场景下，更多思考意味着模型在采取行动前会权衡备选方案，从而可能减少“真实世界”工具调用和失败。面试时我会区分两点：第一，厂商并未声称其推理模型在内部运行显式的树搜索；如果我需要**搜索树**（best-of-N，或带验证器的 MCTS），就会在运行框架中构建，以便观察和评分各个分支。第二，努力程度是成本和延迟调节参数，应按步骤设置：规划器使用高努力程度，常规执行步骤使用低努力程度，而不是每次工具调用都支付最高思考成本。

---

## 参考资料
- Yao 等人. "ReAct: Synergizing Reasoning and Acting in Language Models" (2022). https://arxiv.org/abs/2210.03629
- Shinn 等人. "Reflexion: Language Agents with Verbal Reinforcement Learning" (2023). https://arxiv.org/abs/2303.11366
- Wang 等人. "Plan-and-Solve Prompting" (2023). https://arxiv.org/abs/2305.04091

---

*下一篇：[Tool Use and the Model Context Protocol (MCP)](03-tool-use-and-mcp.md)*
