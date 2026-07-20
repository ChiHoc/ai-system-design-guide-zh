# Agentic RAG

Agentic RAG 从“线性流水线（Linear Pipeline）”转向 **“推理循环（Reasoning Loop）”**。它不再只检索一次，而是由代理（agent）决定 *何时*、*检索什么* 来解决查询。当前主流的生产模式包括 Self-RAG（模型输出反思标记）、Corrective RAG（带纠错路由的检索评估器）、Adaptive RAG（分类器选择流水线深度）、基于文档的 ReAct，以及多跳查询分解。LangGraph 是有状态循环最常见的控制流运行时；LlamaIndex Workflows 则常用于单一流水线、以检索为主的变体。

## 目录

- [线性 vs. Agentic RAG](#线性-vs-agentic-rag)
- [Self-RAG（自我反思）](#self-rag-自我反思)
- [Corrective RAG（CRAG）](#corrective-rag-crag)
- [多跳推理循环](#多跳推理循环)
- [Agentic 过滤与计划修订](#agentic-过滤与计划修订)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 线性 vs. Agentic RAG

| 模型 | 线性 RAG | Agentic RAG |
|-------|------------|-------------|
| **结构** | 预先确定的序列 | 动态循环 |
| **自我纠错** | 无 | 高（可重新检索） |
| **查询复杂度**| 简单（1 步） | 困难（多步） |
| **延迟** | 低（固定） | 可变（多轮） |

**原则**：当查询需要“综合证据证明（Synthesized Proof）”而不仅仅是“文档匹配（Document Match）”时，使用 Agentic RAG。预算要留足：一个 3-4 次迭代的循环通常端到端需要 8-12 秒，因此如果你的 UX 需要 3 秒以内响应，就把简单查询路由到快速路径（Adaptive RAG）。

---

## Self-RAG（自我反思）

在 2024/2025 年流行起来的 **Self-RAG** 使用“Critic Tokens”来评估自身工作。

1. **检索（Retrieve）**：模型拉取 Top-K 分块（chunk）。
2. **评估（Evaluate）**：信息是否相关？（CRITIC: `Relevant`）
3. **生成（Generate）**：答案是否有支撑？（CRITIC: `Supported`）
4. **迭代（Iterate）**：如果答案没有被支撑，模型会 *自动* 触发更广泛的检索。

---

## Corrective RAG（CRAG）

CRAG 在检索和生成之间增加了一层“可靠性层（Reliability Layer）”。

- **逻辑**：  
  - 如果检索结果**正确（Correct）**：直接生成。
  - 如果检索结果**模糊（Ambiguous）**：使用 Web-Search 工具补充。
  - 如果检索结果**错误（Incorrect）**：丢弃上下文并使用外部搜索或回退逻辑。

---

## 多跳推理循环

对于“Who is the CEO of the company that acquired Figma?”这类问题，系统必须：
1. **第 1 跳（Hop 1）**：搜索“Who acquired Figma?”（结果：Adobe）。
2. **第 2 跳（Hop 2）**：搜索“CEO of Adobe”（结果：Shantanu Narayen）。

**代理模式（Agentic Pattern）**：代理维护一个“状态对象（State Object）”，并在每次检索后更新其“子目标（Sub-goal）”，直到链路完成。

---

## Agentic 过滤与计划修订

现代代理使用**子步骤计划（Sub-Step Plans）**。
- 与其一次性检索，不如让代理写出一个计划：“先检查 X 的内部数据库，然后查看 Y 的公开 API。”
- **计划修订（Revised planning）**：如果第 1 步失败，代理会*重写*第 2 步。

---

## 面试题

### Q: Agentic RAG 中的“Reasoning-Retrieval Balance”是什么？

**标准答案：**
在 agentic loop 中，每一次“推理回合（Reasoning turn）”都会增加 token 成本和用户延迟。生产工程师的目标是找到“检索阈值（Retrieval Threshold）”。我们会使用 **Token-Budgeting**（Token 预算），只允许代理进行 3-5 个“回合”后就强制给出最终答案。我们还会使用 **Speculative Retrieval**（推测性检索）——代理预测接下来要执行的 2 个步骤，并同时为这两个步骤检索，以减少往返延迟。

### Q: 为什么 Agentic RAG 往往质量更高，但“可靠性”（Determinism，确定性）更低？

**标准答案：**
Agentic RAG 是非确定性的，因为模型在每一步都在“决定”自己的路径。用户查询的微小变化可能导致代理选择不同的工具或搜索策略，从而产生不同的答案格式。标准缓解方式是使用 **Constrained Agent Frameworks**（约束代理框架），例如 LangGraph 或 DSPy，其中“可能路径图（Graph of possible paths）”被严格定义，即便这些路径之间的选择仍然可能是随机的（stochastic）。

---

## 参考资料
- Asai 等人. “Self-RAG: Learning to Retrieve, Generate, and Critique” (2024/2025)
- Yan 等人. “Corrective Retrieval Augmented Generation（CRAG）” (2024)
- LangChain. “使用 LangGraph 的 Agentic RAG” (2025)

---

*下一篇：[高级检索模式](09-advanced-retrieval-patterns.md)*
