# LangSmith 可观测性

2023 年，LLM 可观测性还只是“记录字符串”。如今，它是**完整轨迹调试**和**自动化评估流水线**；到 2026 年末，各平台正打通从追踪到评估再到微调的闭环。LangSmith 是 LangChain 原生的选择，位于拥挤的 **LLMOps** 层中，这一层还包括 Langfuse（自 2026 年 1 月起属于 ClickHouse；Python SDK 4.16.0）、LangWatch、Braintrust 和 Arize Phoenix（2026 年 10 月 1 日版本 20.19.0，采用 Elastic-2.0 许可证；Dynatrace 于 2026 年 8 月 13 日同意以 $915M 收购 Arize）。所有权变化如今也是选型标准：优先使用可接收 OpenTelemetry、并允许导出追踪和数据集的工具。

## 目录

- [可观测性金字塔](#可观测性金字塔)
- [追踪与轨迹](#追踪与轨迹)
- [LLM 的单元测试（数据集）](#llm-的单元测试-数据集)
- [自动化评估器（LLM 作为裁判）](#自动化评估器)
- [部署管理：A/B 测试](#a-b-测试)
- [2026 年 9 月的平台变化](#_2026-年-9-月的平台变化)
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
- **轨迹视图**：2026 年 9 月推出的会话级视图可展示完整的多轮 agent 运行，而不是一次只看一条 trace。
- **传输层注意事项**：OpenAI Python SDK 3.0（2026 年 8 月 12 日）和 Anthropic Python SDK 1.0（8 月 20 日）改用 `httpx2`。根据 Anthropic 迁移指南，挂钩 `httpx` 的插桩（OpenTelemetry 的 HTTPX instrumentor、Sentry、`respx`、`vcrpy`）可能悄然漏掉 SDK 调用，除非在任何代码导入 `httpx` 前运行 `httpx2.alias_httpx()`。升级 SDK 后，应先确认 span 仍在到达，再相信安静的仪表盘。

---

## LLM 的单元测试（数据集）

没有 **Dataset** 的 LLM 应用开发，就是“凭感觉开发”。
- **黄金标准数据集**：由 `(Input, Expected_Output)` 对组成的集合。
- **标准工作流**：每当用户提供负面反馈，这次交互就会自动进入“纠错数据集”，供后续测试使用。

---

## 自动化评估器

你不可能每天早上手动检查 1,000 条日志记录。
- **LLM-as-Judge**：使用强模型，最好与被测模型来自不同家族（例如由 Claude Opus 5.5 评审 GPT-6.1 Sol agent），对生产模型在**语气**、**准确性**和**安全动作执行**等类别上打分。
- **决策模型评审者**：2026 年 9 月出现了第三层选择。TypeSafe 的 Jev（早期访问，每 1M 输入 token 收费 $0.042，输出不计费）返回带概率的类型化是/否、选项或分数，而非生成文本；LangSmith 于 9 月 21 日将其加入评估器。LangChain 测得每次调用约 $0.00035、平均延迟 0.44 s，而 LLM 评审者为 2.16 至 2.83 s（供应商测量）。问题在于：一项配对研究（arXiv 2609.29769）发现，Jev 最有把握的错误中，约 96% 的 LLM 评审结论也犯了相同错误，级联评审者最多只提高 2.7 分。可以用决策模型对 100% 的流量做廉价二元检查，需要书面理由时继续使用 LLM 评审者，并保留人类标注的黄金集合，因为在评审者之间升级无法捕获相关性错误。
- **自定义评估器**：用于检查正则表达式模式、JSON schema 有效性或毒性分数的 Python 函数。

---

## A/B 测试

LangSmith 支持线下**实验比较**和线上的变体标记。流量划分与回滚由部署层（功能开关或网关）负责，而非追踪工具：
- 在新的“System Prompt”版本上运行 2% 的流量，为每条 trace 标记变体。
- 利用对抽样 trace 运行的在线评估器，近实时比较每个变体的**成功率**和**Token 成本**。
- 将失败率阈值的警报连接到功能开关系统，使其自动回滚。

---

## 2026 年 9 月的平台变化

| 变化 | 日期 | 设计含义 |
|---|---|---|
| 延长留存的 SaaS 追踪最多保留 **180 天** | 自 2026 年 9 月 14 日起 | SaaS 追踪存储不是审计日志。若合规要求更久留存，应导出到自有存储，或使用自托管/BYOC（规则未变） |
| **LangSmith Fine-Tuning** 公开测试（`smithtune` CLI） | 2026 年 9 月 24 日 | 追踪轨迹可通过 Fireworks 或 Baseten 成为开放权重模型的 SFT 或 LoRA 运行，再评估与部署。值得关注，因为 OpenAI 正逐步结束自助微调（自 2027 年 1 月 6 日起，现有客户也不能创建新任务） |
| **Engine v2** | 2026 年 9 月 24 至 25 日 | 生成红队假设，发现错误、延迟、成本趋势和重复工具调用，并在更广的评估集上验证修复建议。LangChain 称 Engine 现在使用的 usage credit 减少 40% |
| SDK 发布节奏 | 2026 年 8 至 9 月 | `langsmith` 从 0.11.0（8 月 14 日）升至 0.14.2（9 月 30 日）：应像其他依赖一样固定版本 |

---

## 面试题

### Q: 为什么“Trace Attribution（轨迹归因）”对 Staff 级工程师至关重要？

**强答：**
在复杂的多智能体系统中，最终输出可能很差，但错误实际上发生在 10 步之前的“Researcher”节点。如果没有 **Trace Attribution（轨迹归因）**，你只是在猜测该修哪里。归因让我能看到**推理链路**。我可以看出“Researcher”没有找到正确的 URL，进而导致“Summarizer”产生幻觉。这使得我们能够进行**定向优化**，而不是泛泛地做“提示词工程”。

### Q: 你如何证明像 LangSmith 这样的可观测性平台的成本是合理的？

**强答：**
这部分成本会被**开发者生产力**和**Token 效率**抵消。工程师仅靠“猜”模型为什么出错所耗费的一天成本，往往远高于每月订阅费。此外，通过 LangSmith 找出“游移型”agent（即步骤太多的 agent），我可以把图的平均步骤数从 8 优化到 5。由于每一步都会重发不断增长的上下文，输入 token 的减少幅度可能超过步骤数下降的 37.5%；当 agent 工作负载每输出一个 token 就消耗数百个输入 token 时，这很重要。我还会为评审者编列预算：如果每条 trace 都用 LLM 评审，其费用可能超过可观测性平台的席位费，因此默认用廉价决策模型覆盖 100% 流量，再抽样使用 LLM 评审者更合理。

---

## 参考资料
- LangChain。“LangSmith Observability” 文档：https://docs.langchain.com/langsmith/home
- LangChain。“LangSmith Engine, agents, fine-tuning and trajectories”（2026 年 9 月）：https://www.langchain.com/blog/langsmith-engine-agents-fine-tuning-trajectories
- Rao 与 Callison-Burch。“JEV vs. LLMs as Rubric Judges: Cheaper, Faster, and Wrong in the Same Places”（arXiv 2609.29769，2026 年 9 月）：https://arxiv.org/abs/2609.29769

---

*下一篇：[LlamaIndex 与数据中心 AI](04-llamaindex.md)*
