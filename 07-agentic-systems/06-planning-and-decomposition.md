# 规划与分解

规划（Planning）是让 agent 解决多阶段问题而不“走神”的“System 2”组件。生产级 agent 已从简单的“Chain-of-Thought（链式思维）”发展到 **Recursive Decomposition（递归分解）** 和 **Tree Search（树搜索）**，并使用 reasoning-native models（推理原生模型，Claude Opus 4.7、GPT-5.5 extended thinking、DeepSeek-R2）在内部完成大量规划。

## 目录

- [规划光谱](#规划光谱)
- [静态规划与动态规划](#静态规划与动态规划)
- [Chain-of-Thought（链式思维）与 o1 Reasoning（推理）](#chain-of-thought-链式思维-与-o1-reasoning-o1-推理)
- [递归任务分解](#递归任务分解)
- [用于 agent 路径的树搜索（MCTS）](#树搜索-mcts)
- [面试问题](#面试问题)
- [参考文献](#参考文献)

---

## 规划光谱

| 方法 | 策略 | 复杂度 | 最适合 |
|--------|----------|------------|----------|
| **线性** | 一步一步执行 | 低 | 简单工具 |
| **分支** | If-Then-Else 逻辑（如果-那么-否则） | 中 | 条件流程 |
| **分层** | 总体计划 -> 子计划 | 高 | 软件工程 |
| **基于搜索** | 在内部尝试多条路径 | 最高 | 科学研究 |

---

## 静态规划与动态规划

### 静态（Plan-and-Solve）
agent 会先写一个 10 步计划，并严格按此执行。
- **优点**：性能高，易于并行化。
- **缺点**：脆弱。如果第 2 步失败，第 3-10 步就都无效。

### 动态（Adaptive，自适应）
agent 会先写计划，但会在每次工具调用后**重新评估**。
- **最佳实践**：使用 **Checkpointed Planning（带检查点的规划）**。agent 被迫在每个主要子目标后将进度“提交（Commit）”到状态存储（state store），以便在计划失败时能够恢复和“回溯（Backtracking）”。

---

## Chain-of-Thought（链式思维）与 o1 Reasoning（o1 推理）

模型内部的“思考”窗口（Inference scaling，推理扩展）充当 **Hidden Planner（隐式规划器）**。
- 与其使用单独的“Planner LLM（规划器大模型）”，我们改用推理模型（reasoning model，如 Claude Opus 4.7、GPT-5.5 extended thinking、DeepSeek-R2）生成一个“Mental Draft（心理草稿）”。
- 这份草稿会被转换为 **Task DAG（任务有向无环图，Directed Acyclic Graph）**，由 orchestrator（编排器）执行。

---

## 递归任务分解

对于大规模任务（例如“Build a full-stack app”）我们会使用 **Sub-Agent Spawning（子 agent 派生）**。
1. **Master Agent（主 agent）**：将“Project（项目）”分解为“Frontend（前端）”“Backend（后端）”和“DB（数据库）”。
2. **Sub-Agents（子 agent）**：每个 agent 接收一个“Sub-Goal（子目标）”，并进行自己的分解。
3. **Consolidation（汇总）**：Master Agent 合并结果。

**关键细节**：每个子 agent 只会获得 **Minimal Context（最小上下文）**，也就是只提供它完成任务所需的信息，以防止 token 膨胀和幻觉（hallucination）。

---

## 树搜索（MCTS）

对于高风险决策，我们会在 agent 循环中使用 **Monte Carlo Tree Search（MCTS，蒙特卡罗树搜索）**。
- agent 会“模拟（Simulates）”10 种可能的工具调用。
- **Reward Model（奖励模型）**（或单独的 LLM 提示词）会对每次模拟进行打分。
- agent 选择奖励最高的路径继续执行。

---

## 面试问题

### Q: 如何防止 agent 在任务分解过程中出现“Infinite Recursion（无限递归）”？

**有力回答：**
我们会实施 **Decomposition Depth Limits（分解深度限制）**（通常为 3 层）和 **Granularity Checks（粒度检查）**。在派生子 agent 之前，我们会问 Supervisor model（监督模型）：  
“这个任务是否足够小，可以通过一次工具调用解决？”  
如果可以，就直接执行；如果不行，就继续分解。我们还会使用 **Global Controller（全局控制器）** 跟踪总 **Agent Count（agent 数量）**，防止出现可能耗尽 API 预算的递归爆炸（fork bomb）。

### Q: 为什么“Plan Revision（计划修订）”通常比“Plan Generation（计划生成）”更昂贵？

**有力回答：**
计划生成是“Fresh Start（全新开始）”。计划修订需要 **Context Re-evaluation（上下文重新评估）**，也就是模型必须理解哪些内容*已经完成*、为什么*上一步失败*，以及如何在不撤销既有成果的前提下修复问题。这要求更高的 **Reasoning Density（推理密度）**。在生产环境中，我们通常会在 **Revision（修订）** 步骤使用更大的模型（例如 Sonnet 3.7 或 o1），而在初始计划生成阶段使用更小的模型。

---

## 参考文献
- Silver 等人. “Mastering the game of Go with deep neural networks and tree search”（应用于 LLMs，2024/2025）
- Wang 等人. “Self-Consistency Improves Chain of Thought Reasoning”（2022/2025 更新）
- LangGraph. “Multi-Agent Planning Patterns”（2025）

---

*下一篇：[错误处理与恢复](07-error-handling-and-recovery.md)*
