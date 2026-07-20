# 智能体基础

智能体（Agent）是由 LLM 驱动的系统，它们超越了“聊天”，进入“自主问题解决”。其定义已从简单的 ReAct 循环演变为**闭环推理系统（Closed-Loop Reasoning Systems）**，这些系统使用内置的“System 2”思维（Claude Opus 4.7 扩展思考、GPT-5.5 推理、DeepSeek-R2、Gemini 3.1 Pro Deep Think）。

## 目录

- [智能体公式](#智能体公式)
- [System 1（LLM）与 System 2（推理模型）](#system-1-与-system-2-思考)
- [自主性级别（自动化光谱）](#自主性级别)
- [核心组件](#核心组件)
- [智能体生命周期](#智能体生命周期)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 智能体公式

现代智能体性通常被描述为：
`Agent = Reasoning Model + Tool Use + Persistent Memory + Environment Feedback`

**细微差别**：在 2023 中，智能体曾经是聊天模型外面的“包装器”。如今，智能体正越来越多地变成**集成式**。前沿模型（Claude Opus 4.7、带推理的 GPT-5.5、DeepSeek-R2）已将“思考”过程内建到预训练中，使智能体循环更稳定，也更不容易“卡住”。

---

## System 1 与 System 2 思考

构建智能体时，需要选择合适的“思考模式”：

| 模式 | 认知类型 | 类比 | 当前技术栈 |
|------|----------------|---------|---------------|
| **System 1** | 快速、直觉式、反应式 | 反射 | Claude Haiku 4.5 / Sonnet 4.6 / GPT-5.5-mini / Gemini 3.1 Flash |
| **System 2** | 缓慢、逻辑式、规划式 | 深思 | Claude Opus 4.7 / GPT-5.5 reasoning / DeepSeek-R2 / Gemini 3.1 Pro Deep Think |

**设计模式**：对“快速 UI”和“路由”使用 System 1 模型。对“决策关口”和“复杂规划”使用 System 2 模型。

---

## 自主性级别

并非所有自主系统都是“智能体”。我们按**自主性级别**来分类：

1. **L0：脚本化链路**：固定顺序（例如标准 LangChain）。
2. **L1：工具增强型**：模型会选择工具，但不会规划。
3. **L2：ReAct 智能体**：“思考 -> 行动 -> 观察”的简单循环。
4. **L3：自主规划器**：将目标分解为子任务图。
5. **L4：环境常驻智能体**：在后台运行，仅在必要时介入。

---

## 核心组件

### 1. 推理模型（执行者）
智能体的 CPU。它决定“通往成功的路径”。

### 2. 工具（肢体）
允许智能体影响世界的接口（API、浏览器、数据库）。
> [!Note]
> **模型上下文协议（Model Context Protocol, MCP）** 现已成为工具互操作的行业标准，Anthropic、OpenAI、Google、Microsoft 和 AWS 均已采用。治理在 2025 年 12 月移交给 Linux Foundation 的 Agentic AI Foundation。

### 3. 记忆（经验）
- **短期**：上下文窗口（KV Cache，键值缓存）。
- **长期**：向量数据库或持久状态（例如 Mem0）。

---

## 智能体生命周期

1. **接收**：接收用户目标。
2. **分解**：将目标拆分为子步骤。
3. **执行**：调用工具并处理结果。
4. **反思**：评估观察结果是否让智能体更接近目标。
5. **完成**：为用户综合最终证据。

---

## 面试题

### 问：为什么“推理模型”（比如 Claude Opus 4.7 或带扩展思考的 GPT-5.5）在智能体能力上比标准 LLM 更强？

**强回答：**
标准 LLM（System 1）是基于模式匹配来预测*下一个*词元。如果它们在工具调用中遇到错误，往往会幻觉出一个修复方案，而不是承认失败。推理模型在推理阶段会使用**思维链（Chain-of-Thought, CoT）**。它们会在输出响应前，通过多个隐藏轮次进行“思考”。对于智能体来说，这意味着更高的**路径可靠性（Path Reliability）**——模型显著不太可能进入无限循环，或重复尝试同一个失败动作两次，因为它已经在内部模拟过该失败。

### 问：如何防止长任务中的“智能体漂移（Agentic Drift）”？

**强回答：**
当子步骤把智能体带得离原始目标太远，以至于丢失上下文时，就会发生智能体漂移。标准解决方案是**目标锚定（Goal Anchoring）**：将“原始目标”作为固定的系统消息，并使用一个**二级观察者模型（Secondary Observer Model）**（更小、更便宜的模型）对每个智能体动作相对于原始目标进行评分。如果分数低于阈值，智能体就会被迫从根部重新“规划”。

---

## 参考资料
- Kahneman, D. “Thinking, Fast and Slow”（应用于 AI，2025）
- OpenAI. “Learning to Reason with LLMs” (2024)
- DeepSeek. “R1: Cold-Start Data for Reasoning” (2025)

---

*下一篇：[推理循环：ReAct 及其之后](02-reasoning-loops-react-and-beyond.md)*
