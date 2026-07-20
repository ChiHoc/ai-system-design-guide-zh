# LangSmith 可观测性

2023 年，LLM 可观测性还只是“记录字符串”。如今，它是**完整轨迹调试**和**自动化评估流水线**。LangSmith 是 LangChain 原生的选择，位于拥挤的 **LLMOps** 层中，这一层还包括 Langfuse（于 2026 年 1 月被 ClickHouse 收购）、LangWatch、Braintrust 和 Arize Phoenix。

## 目录

- [可观测性金字塔](#可观测性金字塔)
- [追踪与轨迹](#追踪与轨迹)
- [LLM 的单元测试（数据集）](#llm-的单元测试-数据集)
- [自动化评估器（LLM 作为裁判）](#自动化评估器)
- [部署管理：A/B 测试](#a-b-测试)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 可观测性金字塔

1. **顶部（价值）**：用户任务是否完成？（成功率）
2. **中部（流程）**：哪个 agent 节点是瓶颈？（每个节点的延迟/成本）
3. **底部（原始）**：精确的 prompt/completion 对是什么？（追踪记录）

---

## 追踪与轨迹

LangSmith 会自动捕获 **LangGraph** 或 **Chain** 中的每个节点。
- **元数据标记**：为每条 trace 标记 `user_id`、`model_tier` 和 `is_canary`。
- **调试器**：你可以在 LangSmith UI 中“回放”一条 trace，修改 prompt，并查看响应如何变化。此过程无需重新运行整个应用。

---

## LLM 的单元测试（数据集）

没有 **Dataset** 的 LLM 应用开发，就是“凭感觉开发”。
- **黄金标准数据集**：由 `(Input, Expected_Output)` 对组成的集合。
- **标准工作流**：每当用户提供负面反馈，这次交互就会自动进入“纠错数据集”，供后续测试使用。

---

## 自动化评估器

你不可能每天早上手动检查 1,000 条日志记录。
- **LLM-as-Judge**：使用更强的模型（Claude Opus 4.7、GPT-5.5 reasoning、DeepSeek-R2）对生产模型在 **语气**、**准确性** 和 **安全动作执行** 等类别上打分。
- **自定义评估器**：用于检查正则表达式模式、JSON schema 有效性或毒性分数的 Python 函数。

---

## A/B 测试

LangSmith 支持**实验分支**。
- 在新的“System Prompt”版本上运行 2% 的流量。
- 实时比较**成功率**和**Token 成本**。
- 如果失败率超过阈值，自动回滚。

---

## 面试题

### Q: 为什么“Trace Attribution（轨迹归因）”对 Staff 级工程师至关重要？

**强答：**
在复杂的多智能体系统中，最终输出可能很差，但错误实际上发生在 10 步之前的“Researcher”节点。如果没有 **Trace Attribution（轨迹归因）**，你只是在猜测该修哪里。归因让我能看到**推理链路**。我可以看出“Researcher”没有找到正确的 URL，进而导致“Summarizer”产生幻觉。这使得我们能够进行**定向优化**，而不是泛泛地做“提示词工程”。

### Q: 你如何证明像 LangSmith 这样的可观测性平台的成本是合理的？

**强答：**
这部分成本会被**开发者生产力**和**Token 效率**抵消。工程师仅靠“猜”模型为什么出错所耗费的一天成本，往往远高于每月订阅费。此外，通过 LangSmith 找出“游移型”agent（即步骤太多的 agent），我可以把图的平均步骤数从 8 优化到 5，从而直接带来 **LLM API 账单减少 30-40%**。

---

## 参考资料
- LangChain 团队. “LangSmith: The Unified Evaluation Platform” (2025)
- Microsoft. “Tracing and Debugging Multi-Agent Systems” (2025)
- Weights & Biases. “将 LLOps 集成到 CI/CD 流水线中” (2024/2025)

---

*下一篇：[LlamaIndex 与数据中心 AI](04-llamaindex.md)*
