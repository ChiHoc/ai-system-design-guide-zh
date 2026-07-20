# 树状思维（Tree-of-Thought, ToT）

树状思维（Tree-of-Thought，ToT）是一种高级 prompting（提示词设计）架构，模型会探索多条推理路径、对其进行评估，并在某条路径走到死胡同时“回溯（backtrack）”。它是现代自主研究 agent（智能体）背后的蓝图。

## 目录（Table of Contents）

- [树与链的区别](#树与链的区别)
- [ToT 循环：提出（Propose）、评估（Evaluate）、搜索（Search）](#tot-循环-提出-propose-、评估-evaluate-、搜索-search)
- [自我修正与回溯](#自我修正与回溯)
- [MCTS 与搜索即服务](#mcts-与搜索即服务)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 树与链的区别

虽然**链式思维（Chain-of-Thought）**是线性的（单一路径），**树状思维（Tree-of-Thought）**则允许分支。

| 特性 | Chain-of-Thought | Tree-of-Thought |
|---------|------------------|-----------------|
| **拓扑结构** | 线性（1 条路径） | 分支式（多条路径） |
| **逻辑** | 顺序式 | 并行 + 评估式 |
| **自我修正** | 低（承诺偏差） | 高（回溯） |
| **使用场景** | 数学、简单逻辑 | 谜题求解、编码架构、战略规划 |

---

## ToT 循环：提出（Propose）、评估（Evaluate）、搜索（Search）

一个 ToT 系统由三个模块组成：
1. **思路生成器（Thought Proposer）**：为一个问题生成 3-5 个潜在的“下一步”。
2. **状态评估器（State Evaluator）**：对每个步骤评分（例如，“Good”“Maybe”“Impossible”）。
3. **搜索算法（Search Algorithm）**：使用 BFS 或 DFS 决定下一步要探索哪个分支。

```python
# The ToT logic (Simplified):
For each branch:
   Score = Evaluate(branch)
   If Score < Threshold:
      Prune branch (Backtrack)
   Else:
      Continue exploring
```

---

## 自我修正与回溯

ToT 专门用于克服**幻觉级联（Hallucination Cascades）**。  
在线性链中，如果模型在第一步出错，则后续每一步都很可能是错误的。在 ToT 中，“评估器（Evaluator）”（可以是不同的模型，也可以是基于规则的检查）会在第一步就捕获错误，并迫使模型尝试不同的起点。

---

## MCTS 与搜索即服务

ToT 已演进为用于 LLM 的**蒙特卡洛树搜索（Monte Carlo Tree Search, MCTS）**。  
- **搜索时算力扩展（Search-time Compute Scaling）**：不再使用一个大提示词，而是使用 100 个小提示词去“搜索”最佳答案。
- **RAD-T（Reasoning-as-Data-Tree，推理即数据树）**：专门的“搜索器（Searcher）”模型（Gemini 3.1 Pro Deep Think、GPT-5.5 extended thinking、Claude Opus 4.7）经过原生训练，用于管理这些分支。

---

## 面试题

### Q：什么时候 ToT 明显优于简单的 CoT？

**标准答案：**
当问题具有“庞大搜索空间（large search space）”并且要求“全局一致性（global consistency）”时，ToT 更优。例如，在复杂的软件重构中，单一的链式思维（Chain-of-Thought）可能起步良好，但在 10 步后遇到约束冲突。使用 ToT 时，模型可以提出 3 种不同的重构模式，评估每种模式对代码库的影响，并在写入任何代码前丢弃会导致循环依赖的模式。

### Q：Tree-of-Thought 在面向消费者的应用中的主要缺点是什么？

**标准答案：**
其主要缺点是**指数级成本与延迟（Exponential Cost and Latency）**。将深度为 5 的 3 个分支全部探索可能需要 15-20 次独立的 LLM 调用。在消费级应用中，这可能导致单次查询出现 30 秒延迟和 0.50 美元的成本。标准缓解方法是“混合模型（Hybrid Model）”：对高风险的离线任务（如生成黄金数据集或安全审计）使用 ToT，并将这些结果蒸馏（distill）到一个快速的线性模型中用于实时交互。

---

## 参考资料
- Yao et al. “Tree of Thoughts: Deliberate Problem Solving with Large Language Models” (2023)
- Silver et al. “Mastering the Game of Go without Human Knowledge” (MCTS inspiration)

---

*Next: [Context Engineering](05-context-engineering.md)*
