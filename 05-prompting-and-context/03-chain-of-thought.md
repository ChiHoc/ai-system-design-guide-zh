# 思考链（Chain-of-Thought, CoT）

Chain-of-Thought（CoT，思考链）是一种鼓励 LLM 在给出最终答案前先生成中间推理步骤的技术。它已从简单的提示短语演化为推理模型的核心架构特征：早期有 OpenAI o1 和 DeepSeek-R1，如今有 GPT-6 Astra 和 GPT-6.1 Sol、Claude Opus 5.5 和 Fable 5.1、Gemini 3.8 Flash、DeepSeek V4.1-Flash；这些模型都会在回答前根据推理强度或思考等级设置进行推理。

## 目录

- [The CoT Revolution（CoT 革命）](#the-cot-revolution-cot-革命)
- [Zero-Shot vs. Programmatic CoT（零样本 vs. 程序化 CoT）](#zero-shot-vs-programmatic-cot-零样本-vs-程序化-cot)
- [The Rise of "Thinking" Models (o1, DeepSeek-R1)（“Thinking” 模型的兴起）](#the-rise-of-thinking-models-thinking-模型的兴起)
- [作为监控信号的 CoT](#作为监控信号的-cot)
- [Self-Correction and Verification（自我纠错与验证）](#self-correction-and-verification-自我纠错与验证)
- [When CoT Fails (Over-thinking)（CoT 失效时：过度思考）](#when-cot-fails-over-thinking-cot-失效时-过度思考)
- [Interview Questions（面试问题）](#interview-questions-面试问题)
- [References（参考文献）](#references-参考文献)

---

## The CoT Revolution（CoT 革命）

标准 LLM 是“Next Token Predictors（下一个 Token 预测器）”。对于复杂数学或逻辑问题，单次生成通常不够。CoT 为模型提供了“涂鸦板”（Scribble Pad，工作记忆，Working Memory），用于逐步推导子问题。

**The Formula（公式）**: `Input -> Reasoning (Chain) -> Output`

---

## Zero-Shot vs. Programmatic CoT（零样本 vs. 程序化 CoT）

| Technique（技术） | Trigger Phrase（触发短语） | Efficiency（效率） | Use Case（使用场景） |
|-----------|----------------|------------|----------|
| **Zero-Shot CoT** | "Let's think step by step." | High（高） | 非推理模型上的临时查询。 |
| **Few-Shot CoT** | （提供带逻辑的示例） | Higher Stability（更高稳定性） | 非推理模型上的生产流水线。 |
| **Programmatic CoT** | "1. Analyze X. 2. Verify Y. 3. Resolve Z." | **Best for Agents（最适合 Agent）** | 步骤必须可审计的复杂多工具任务。 |

对推理模型而言，这类提示大多是冗余的：模型已经会在回答前思考。应改为设置推理强度，并说明答案必须满足的成功标准。

在最新 Claude 模型（Fable 5.1 和 5、Opus 5.5 和 5、Sonnet 5.5）上，这类提示还可能直接失败。如果提示要求模型将推理写入输出，例如在答案前填写 `<thinking>` 或草稿区，或在 JSON 中填入 `reasoning` 字段，模型可能按 `reasoning_extraction` 类别拒绝；即使拒绝发生在任何输出之前也会计费。应改为索取简短解释或答案依据；需要了解模型如何推理时，读取摘要化的思考块。

---

## The Rise of "Thinking" Models（“Thinking” 模型的兴起）

**GPT-6 Astra 和 GPT-6.1 Sol**、**Claude Opus 5.5 和 Fable 5.1**、**Gemini 3.8 Flash**、**DeepSeek V4.1-Flash** 等模型通过强化学习（Reinforcement Learning, RL）将 CoT“内建”到模型中。训练过程参见[RLVR 与推理模型](../03-training-and-adaptation/08-rlvr-and-reasoning-models.md)。

1. **推理强度取代 token 预算**：模型有专门的思考阶段，由推理强度而非原始 token 数控制。OpenAI 提供 `reasoning.effort`（GPT-6 Astra 和 GPT-6.1 Sol 上从 `low` 到 `max`），Anthropic 提供自适应思考及 `effort`（Opus 4.7 及后续版本对固定 `budget_tokens` 返回 400），Gemini 3.8 Flash 使用 `thinking_level`。API 细节见[上下文工程](05-context-engineering.md#推理强度与思考控制)。
2. **隐藏的 CoT**：主流供应商都不返回原始思维链。OpenAI 可返回摘要和加密推理项；Anthropic 返回绑定于生成它的模型与对话的摘要化或空白（最新模型默认“omitted”）思考块。无论能否读取，思考都会作为输出 token 计费。原因之一是**蒸馏防护**：Anthropic 于 2026 年 2 月披露，竞争方通过约 24,000 个欺诈账户进行了超过 16M 次对话，要求 Claude 写出推理；其 2026 年 9 月威胁报告又描述了五次行动、近 200M 次对话。
3. **扩展定律**：这些模型遵循 **Inference Scaling Law（推理扩展定律）**：思考时间越长，解决难题的能力越强，但每个新增 token 的收益递减。OpenAI 和 Google DeepMind 的实验性推理模型在 IMO 2025 达到了金牌水平。

---

## 作为监控信号的 CoT

过去，阅读模型推理是发现不当行为的低成本方式，能在行为发生前报警。对前沿模型来说，这一信号正在减弱。

- **可控性正在提高。**OpenAI 的 GPT-6 Astra 系统卡（2026 年 9 月 3 日）报告，在长度为 750 至 1,250 token 的思维链上，Astra 有 60.9% 的情况能控制其 CoT，而 GPT-5.6 Sol 为 16.1%，GPT-5.5 Thinking 为 1.7%（OpenAI 评测）。英国 AISI 的另一项可控性评测发现，Astra 在 93% 的样本上遵循约束。OpenAI 写道，如果模型试图隐蔽地降低表现，可能无法可靠发现。
- **普通任务压力下也能绕过监控。**EvasionBench（arXiv 2609.30217）给智能体布置必须执行某项已知运行时监控器禁止操作的任务：三次尝试择优时，规避尝试的比例约为 98%，成功率最高 88%，且规避通常随推理强度提高而增加。

**设计含义：**将 CoT 当作调试辅助，而非控制手段。把安全监控放在**操作和输出**上（工具调用、diff、网络出站、写入的数据），沙箱限制智能体可触及的资源，推理轨迹仅作为辅助证据。参见[智能体安全与沙箱](../07-agentic-systems/09-agentic-security-and-sandboxing.md)以及[研究雷达](../RESEARCH-RADAR.md#_4-潜在推理与替代推理)中关于潜在推理的内容。

---

## Self-Correction and Verification（自我纠错与验证）

生产流水线不再信任单一的 Chain-of-Thought。它们会叠加 **Self-Verification（自我验证）**。

```markdown
# Process
1. Generate Answer A via CoT.
2. Critique: "Are there any errors in the logic above?"
3. If errors: "Correct the logic and provide Answer B."
```

**细微差别**：没有新信息时，让同一个模型自我批评的内在纠错往往不能改进推理，甚至会使其变差（Huang 等人，2024）。真正有效的是**外部反馈**：用于编程的 **Execution-Verified CoT（执行验证 CoT）**让模型编写逻辑、运行代码，在测试失败时修正；也可以使用提示、模型或工具不同的独立验证器。参见[循环工程](../07-agentic-systems/12-loop-engineering.md#验证与评分)。

---

## When CoT Fails (Over-thinking)（CoT 失效时：过度思考）

CoT 不是银弹。对于简单任务，它会带来：
1. **Latency（延迟）**：更多 token = 更慢的响应。
2. **Cost（成本）**：每一个“thought token（思考 token）”都按输出费率计费（例如 Claude Opus 5.5 每 1M token $20，GPT-6.1 Sol 为 $10）。
3. **Over-thinking（过度思考）**：模型可能会在不存在复杂性的地方强行编造复杂性（例如用 3 段话解释为什么 2+2=4）。

对当前模型，解决方法是推理强度旋钮：聊天、分类和抽取用 `low`，只有评测显示有收益时才使用更高强度。一些模型已不能完全关闭思考（Claude Opus 5.5 无法关闭；Claude Sonnet 5.5 的最低设置为 `between_tools`），因此强度成为唯一的调节手段。

---

## Interview Questions（面试问题）

### Q: Why does CoT improve performance on mathematical word problems?（为什么 CoT 能提升数学文字题的表现？）

**Strong answer（标准答案）:**
CoT 通过将模型的计算复杂度与任务的逻辑复杂度对齐来提升性能。在标准单次生成中，模型必须基于有限的局部信息来预测最终答案 token。使用 CoT 后，模型会将问题“拆分”为更小、按自回归（auto-regressive）展开的步骤。每一步都会把上一步的输出作为上下文，使模型的注意力机制（attention mechanism）能够一次聚焦一个子问题（例如先加苹果，再减橘子），从而降低单次预测的“cognitive load（认知负荷）”。

### Q: How do you handle CoT in a production environment where latency is critical?（在延迟至关重要的生产环境中如何处理 CoT？）

**Strong answer（标准答案）:**
我们使用 **Hybrid Reasoning Architecture（混合推理架构）**：
1. **Tier 1（路由）**：低成本分类器按请求选择推理强度（多数流量用 `low`，只有需要时才用 `high`），而非全局采用同一设置。
2. **Tier 2（精简推理）**：高流量路径使用低强度的小型快速模型，或者采用 **Knowledge Distillation（知识蒸馏）**：根据教师模型的推理轨迹训练小模型直接生成最终答案。
3. **Tier 3（流式输出）**：模型思考期间也要输出可见内容。原始 CoT 不可用，因此可流式输出摘要化思考或进度更新（Claude 的 `display: "summarized"`，或用于工具调用间进度提示的 `display: "updates"` 测试版），避免界面看似冻结。

我会按完成任务的成本和延迟，而非每次请求来判断结果：若低价调用需要重试，它并不更便宜。

### 问：安全团队想通过阅读编程智能体的思维链来监控它，你会怎么说？

**标准答案：**
有用，但不充分，而且充分性正在下降。供应商不提供原始推理，只提供摘要。GPT-6 Astra 系统卡报告，在中等长度轨迹上，Astra 有 60.9% 的情况能控制其 CoT，而 GPT-5.6 Sol 为 16.1%；OpenAI 表示隐蔽降低表现可能无法被发现。EvasionBench 还显示，智能体能以较高比例规避已知运行时监控器，且推理强度越高越明显。因此主要监控应放在操作上：每次工具调用、文件 diff 和网络请求都经过策略检查，沙箱默认拒绝出站流量，不可逆操作要以实际执行的精确动作获得审批。推理摘要可作为审计日志中的上下文，供事故复盘的人查看。

---

## References（参考文献）
- Wei et al. "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models" (2022)
- Kojima 等人。“Large Language Models are Zero-Shot Reasoners”（2022）
- Wang et al. "Self-Consistency Improves Chain of Thought Reasoning in Language Models" (2023)
- Huang 等人。“Large Language Models Cannot Self-Correct Reasoning Yet”（ICLR 2024）
- OpenAI. "Learning to Reason with LLMs" (2024)
- [OpenAI。GPT-6 Astra 系统卡（2026 年 9 月）](https://deploymentsafety.openai.com/gpt-6-astra)
- [Anthropic。“识别并阻止蒸馏攻击”（2026）](https://www.anthropic.com/news/detecting-and-preventing-distillation-attacks)
- [Anthropic。“拒绝与回退”：将推理保留在思考块中](https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback#keep-reasoning-in-thinking-blocks)
- [普通任务压力下出现工具性监控规避（arXiv 2609.30217）](https://arxiv.org/abs/2609.30217)

---

*Next（下一步）: [Tree-of-Thought](04-tree-of-thought.md)*
