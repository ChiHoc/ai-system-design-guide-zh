# 思考链（Chain-of-Thought, CoT）

Chain-of-Thought（CoT，思考链）是一种鼓励 LLM 在给出最终答案前先生成中间推理步骤的技术。它已从一个简单的提示短语演化为推理模型的核心架构特征（o1、DeepSeek-R2、Claude Opus 4.7 with extended thinking、GPT-5.5 with extended thinking）。

## 目录

- [The CoT Revolution（CoT 革命）](#the-cot-revolution-cot-革命)
- [Zero-Shot vs. Programmatic CoT（零样本 vs. 程序化 CoT）](#zero-shot-vs-programmatic-cot-零样本-vs-程序化-cot)
- [The Rise of "Thinking" Models (o1, DeepSeek-R1)（“Thinking” 模型的兴起）](#the-rise-of-thinking-models-thinking-模型的兴起)
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
| **Zero-Shot CoT** | "Let's think step by step." | High（高） | Ad-hoc queries（临时查询）。 |
| **Few-Shot CoT** | （提供带逻辑的示例） | Higher Stability（更高稳定性） | Production pipelines（生产流水线）。 |
| **Programmatic CoT** | "1. Analyze X. 2. Verify Y. 3. Resolve Z." | **Best for Agents（最适合 Agent）** | Complex multi-tool tasks（复杂多工具任务）。 |

---

## The Rise of "Thinking" Models（“Thinking” 模型的兴起）

像 **OpenAI o1/GPT-5.5 extended thinking**、**DeepSeek-R2** 和 **Claude Opus 4.7** 这样的模型，通过强化学习（Reinforcement Learning, RL）将 CoT“内建”到了模型中。

1. **System-Level CoT（系统级 CoT）**：模型不仅仅是“打印”推理过程，它还拥有一个专门的“Thinking Window（思考窗口）”。
2. **Hidden CoT（隐藏 CoT）**：在许多企业版本中，推理链对用户隐藏，但可由系统验证，以防止 prompt injection（提示词注入）或“thought leakage（思维泄漏）”。
3. **Scaling Law（扩展定律）**：这些模型遵循 **Inference Scaling Law（推理扩展定律）**——它们“思考”得越久，解决难题的能力就越强（$o1$ 在足够时间下可以解决金牌级 IMO 数学题）。

---

## Self-Correction and Verification（自我纠错与验证）

生产流水线不再信任单一的 Chain-of-Thought。它们会叠加 **Self-Verification（自我验证）**。

```markdown
# Process
1. Generate Answer A via CoT.
2. Critique: "Are there any errors in the logic above?"
3. If errors: "Correct the logic and provide Answer B."
```

**Nuance（细微差别）**：这现在已集成到用于编程的 **Execution-Verified CoT（执行验证 CoT）** 中，模型会先编写逻辑，再运行代码，并在代码失败时进行自我修正。

---

## When CoT Fails (Over-thinking)（CoT 失效时：过度思考）

CoT 不是银弹。对于简单任务，它会带来：
1. **Latency（延迟）**：更多 token = 更慢的响应。
2. **Cost（成本）**：每一个“thought token（思考 token）”都要付费。
3. **Over-thinking（过度思考）**：模型可能会在不存在复杂性的地方强行编造复杂性（例如用 3 段话解释为什么 2+2=4）。

---

## Interview Questions（面试问题）

### Q: Why does CoT improve performance on mathematical word problems?（为什么 CoT 能提升数学文字题的表现？）

**Strong answer（标准答案）:**
CoT 通过将模型的计算复杂度与任务的逻辑复杂度对齐来提升性能。在标准单次生成中，模型必须基于有限的局部信息来预测最终答案 token。使用 CoT 后，模型会将问题“拆分”为更小、按自回归（auto-regressive）展开的步骤。每一步都会把上一步的输出作为上下文，使模型的注意力机制（attention mechanism）能够一次聚焦一个子问题（例如先加苹果，再减橘子），从而降低单次预测的“cognitive load（认知负荷）”。

### Q: How do you handle CoT in a production environment where latency is critical?（在延迟至关重要的生产环境中如何处理 CoT？）

**Strong answer（标准答案）:**
我们使用 **Hybrid Reasoning Architecture（混合推理架构）**：
1. **Tier 1（快速）**：分类器判断该查询是否需要深度推理。
2. **Tier 2（压缩 CoT）**：我们提示模型“Be concise in your reasoning（推理请简洁）”，或者使用 **Knowledge Distillation（知识蒸馏）**，让更小的模型只生成最终答案，同时受益于教师模型的 CoT 风格预训练。
3. **Tier 3（Streaming）**：我们将 CoT 流式输出给用户（如果是透明模式），或者交给后台进程，以便系统在其出现时就开始对最终结果进行“预处理（pre-processing）”。

---

## References（参考文献）
- Wei et al. "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models" (2022)
- Wang et al. "Self-Consistency Improves Chain of Thought Reasoning in Language Models" (2023)
- OpenAI. "Learning to Reason with LLMs" (2024)

---

*Next（下一步）: [Tree-of-Thought](04-tree-of-thought.md)*
