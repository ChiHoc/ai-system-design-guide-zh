# 树状思维（Tree-of-Thought, ToT）

树状思维（Tree-of-Thought，ToT）是一种高级 prompting（提示词设计）架构，模型会探索多条推理路径、对其进行评估，并在某条路径走到死胡同时“回溯（backtrack）”。它是现代基于搜索的智能体背后的蓝图；经强化学习训练的推理模型如今已把其中许多能力内化到一条长推理轨迹中。

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
# The ToT logic (simplified breadth-first search with pruning)
def tree_of_thought(problem, propose, evaluate, depth=3, breadth=3, threshold=0.5):
    frontier = [[]]  # each state is the list of thoughts so far
    for _ in range(depth):
        candidates = []
        for state in frontier:
            for thought in propose(problem, state, k=breadth):
                new_state = state + [thought]
                score = evaluate(problem, new_state)
                if score >= threshold:  # below threshold: prune (backtrack)
                    candidates.append((score, new_state))
        candidates.sort(key=lambda c: c[0], reverse=True)
        frontier = [state for _, state in candidates[:breadth]]
        if not frontier:
            return None  # every branch was pruned
    return frontier[0]
```

---

## 自我修正与回溯

ToT 专门用于克服**幻觉级联（Hallucination Cascades）**。  
在线性链中，如果模型在第一步出错，则后续每一步都很可能是错误的。在 ToT 中，“评估器（Evaluator）”（可以是不同的模型，也可以是基于规则的检查）会在第一步就捕获错误，并迫使模型尝试不同的起点。

评估器决定了成败。让 LLM 给自己的分支打分，会继承它犯错时的盲点；**确定性评估器**（单元测试、类型检查器、约束求解器、游戏引擎）才能让回溯变得可靠。

---

## MCTS 与搜索即服务

ToT 已演进为用于 LLM 的**蒙特卡洛树搜索（Monte Carlo Tree Search, MCTS）**（例如 RAP：把 LLM 作为世界模型，将推理视为规划）。
- **搜索时算力扩展（Search-time Compute Scaling）**：不再使用一个大提示词，而是通过多次小调用“搜索”最佳答案：best-of-N 采样、自洽投票，或由验证器引导的完整树搜索。
- **内化搜索**：经强化学习训练的推理模型（GPT-6 Astra、Claude Fable 5.1 与 Opus 5.5、带并行思考的 Gemini Deep Think 模式）学会在一条推理轨迹内提出、检查和回溯，推理强度设置控制其搜索量。显式 ToT 框架如今主要在两种情况下值得付出成本：存在模型自身无法运行的外部验证器，或需要独立并行样本以便打分比较。

**框架与模型本身同样重要。**ARC Prize 于 2026 年 9 月在 ARC-AGI-3 上测试 GPT-6 Astra：最大推理强度下，最小化的 Standard 框架得分 62.7%（$26,098）；保留请求间模型推理状态并使用压缩的 Provider Adapter 框架，在高推理强度下得分 99.9%（$18,817）。相同模型和测试集，保留模型自身推理状态的框架高出 37 分，却使用了更低的强度和成本。

---

## 面试题

### Q：什么时候 ToT 明显优于简单的 CoT？

**标准答案：**
当问题具有“庞大搜索空间（large search space）”并且要求“全局一致性（global consistency）”时，ToT 更优。例如，在复杂的软件重构中，单一的链式思维（Chain-of-Thought）可能起步良好，但在 10 步后遇到约束冲突。使用 ToT 时，模型可以提出 3 种不同的重构模式，评估每种模式对代码库的影响，并在写入任何代码前丢弃会导致循环依赖的模式。如果每个分支都能由测试集或编译器等客观机制检验，收益最大。

### Q：Tree-of-Thought 在面向消费者的应用中的主要缺点是什么？

**标准答案：**
其主要缺点是**指数级成本与延迟（Exponential Cost and Latency）**。探索 3 个分支、深度为 5，每层每个分支都需提出和评估，即使积极剪枝也会产生 30 次或更多 LLM 调用。在消费级应用中，这可能导致单次查询出现 30 秒延迟和 $0.50 的成本。标准缓解方法是“混合模型（Hybrid Model）”：对高风险的离线任务（如生成黄金数据集或安全审计）使用 ToT，并将这些结果蒸馏（distill）到一个快速的线性模型中用于实时交互。

### 问：如果模型本身已经是推理模型，还需要显式 ToT 吗？

**标准答案：**
通常不需要额外实现搜索：推理模型在较高强度下已经会在内部探索和回溯，单次 `high` 强度调用比编排 30 次调用更简单，且往往更便宜。不过两种情况下我仍会构建显式搜索。第一，有模型自身无法运行的外部验证器，如专有测试框架或求解器，因为验证器信号优于模型自评。第二，需要多样性和可审计性：能够打分、比较和记录的独立样本。应按解决一个任务的成本，而非单次调用成本作比较。

---

## 参考资料
- Yao et al. “Tree of Thoughts: Deliberate Problem Solving with Large Language Models” (2023)
- Hao 等人。“Reasoning with Language Model is Planning with World Model”（RAP，2023）
- Wang 等人。“Self-Consistency Improves Chain of Thought Reasoning in Language Models”（2023）
- Silver et al. “Mastering the Game of Go without Human Knowledge” (MCTS inspiration)
- [ARC Prize。GPT-6 Astra 在 ARC-AGI-3 上的表现（2026 年 9 月）](https://arcprize.org/blog/astra)

---

*Next: [Context Engineering](05-context-engineering.md)*
