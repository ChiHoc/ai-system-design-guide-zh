# 规划与分解

规划（Planning）是让 agent 解决多阶段问题而不“走神”的“System 2”组件。生产级 agent 已从简单的“Chain-of-Thought（链式思维）”发展到 **Recursive Decomposition（递归分解）** 和 **Tree Search（树搜索）**，由推理原生模型（Claude Opus 5.5 和 Fable 5.1、GPT-6 Astra 和 GPT-6.1 Sol）按照所设努力程度在内部完成繁重的规划。

## 目录

- [规划光谱](#规划光谱)
- [静态规划与动态规划](#静态规划与动态规划)
- [分解前先澄清](#分解前先澄清)
- [CoT 与推理模型](#cot-与推理模型)
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

## 分解前先澄清

代价最高的规划错误，是把错误的目标分解得很精细；2026 年的测量结果表明，智能体很少主动提问。在 Sierra 的 hyper-tau-bench（2026 年 9 月）中，开发智能体必须从业务记录和客户访谈中恢复需求，再构建客服智能体。Claude Opus 5 独自在 Claude Code 中完成任务时，通过了 23.9% 的保留测试；同类模型若与掌握深入背景的工程师协作，则达到 82.2%。开发智能体面对约 1,700 份银行文件，打开了不到 80 份；客户独自掌握 20 至 25 项需求，它们最多只问了 4 个问题。一句架构建议便让电信任务得分从 31% 提升至 67%。OSWorld 2.0 的失败分析对桌面智能体指出同样缺口：缺少信息，因为智能体很少主动澄清。

设计上的结果：

- **把需求探询设为明确的规划步骤**，给它单独的预算，而非让模型自行决定是否跳过。
- **仅在答案会改变计划时提问。**OpenAI 对 Codex 中 GPT-6 Astra 的描述是：只针对影响重大的决策提出聚焦问题，并继续完成不依赖答案的工作。这才是合适形态：每处分叉只问一个会阻塞决策的问题，而不是发问卷。
- **提供架构提示。**如果人类知道合适的架构，一句写进规划提示词的建议，比无论多少智能体探索都便宜。

---

## CoT 与推理模型

模型内部的“思考”窗口（Inference scaling，推理扩展）充当 **Hidden Planner（隐式规划器）**。
- 与其使用单独的“Planner LLM（规划器大模型）”，我们改用推理模型（如 Claude Opus 5.5、GPT-6 Astra）生成一个“Mental Draft（心理草稿）”。
- 这份草稿会被转换为 **Task DAG（任务有向无环图，Directed Acyclic Graph）**，由 orchestrator（编排器）执行。
- **努力程度就是规划预算。**同一模型的规划调用使用高努力程度，执行步骤使用低努力程度，而非切换模型。要明确固定努力程度：版本间默认值会变化（Opus 5.5 默认 `medium`，Opus 5 默认 `high`）。

---

## 递归任务分解

对于大规模任务（例如“Build a full-stack app”）我们会使用 **Sub-Agent Spawning（子 agent 派生）**。
1. **Master Agent（主 agent）**：将“Project（项目）”分解为“Frontend（前端）”“Backend（后端）”和“DB（数据库）”。
2. **Sub-Agents（子 agent）**：每个 agent 接收一个“Sub-Goal（子目标）”，并进行自己的分解。
3. **Consolidation（汇总）**：Master Agent 合并结果。

**关键细节**：每个子 agent 只会获得 **Minimal Context（最小上下文）**，也就是只提供它完成任务所需的信息，以防止 token 膨胀和幻觉（hallucination）。

**在平台层而非提示词中限制扇出。**协调器产品现在会大规模派生子智能体（Cursor 的 Projects beta 根据计划需要委派给任意数量的并行子智能体），因此上限必须设在模型之外：OpenAI Agents API 提供 `max_concurrent_subagents`（默认 6）；整棵任务树的总预算应由网关控制。

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
在托管运行时，我还会设置平台自带的并发上限（例如 OpenAI Agents API 的 `max_concurrent_subagents`）及会话支出上限（Claude Managed Agents 达到上限会以 `budget_reached` 暂停），因为模型能说服自己绕开的限制算不上真正的限制。

### Q: 为什么“Plan Revision（计划修订）”通常比“Plan Generation（计划生成）”更昂贵？

**有力回答：**
计划生成是“Fresh Start（全新开始）”。计划修订需要 **Context Re-evaluation（上下文重新评估）**，也就是模型必须理解哪些内容*已经完成*、为什么*上一步失败*，以及如何在不撤销既有成果的前提下修复问题。这要求更高的 **Reasoning Density（推理密度）**。在生产环境中，我们为 **Revision（修订）** 步骤投入比初始规划更多的资源：可以使用更强的模型（例如 Claude Opus 5.5 或 GPT-6 Astra），但现在更常见的是对同一模型使用更高的努力程度，保留上下文和缓存，同时增加思考量。

---

## 参考文献
- Silver 等人. “Mastering the game of Go with deep neural networks and tree search”（Nature，2016），MCTS 与学习式价值搜索相结合并应用于 LLM 智能体的来源
- Wang 等人. “Self-Consistency Improves Chain of Thought Reasoning in Language Models”（2022）。https://arxiv.org/abs/2203.11171
- LangGraph. “Multi-Agent Planning Patterns”（2025）
- Sierra. “hyper-tau-bench: evaluating agents that build agents”（2026 年 9 月）。https://sierra.ai/blog/hyper-t-bench-evaluating-agents-that-build-agents

---

*下一篇：[错误处理与恢复](07-error-handling-and-recovery.md)*
