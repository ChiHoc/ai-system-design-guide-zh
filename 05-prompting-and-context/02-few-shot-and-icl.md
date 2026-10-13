# 少样本（Few-Shot）与上下文学习（In-Context Learning, ICL）

上下文学习（In-Context Learning, ICL）是指大语言模型（LLM）仅通过查看提示词中的示例即可学习新任务，而无需进行任何权重更新（weight updates）的能力。最大化 ICL 效率是提升提示稳定性的关键杠杆。

## 目录

- [少样本示例的构成（The Anatomy of a Few-Shot Example）](#少样本示例的构成-the-anatomy-of-a-few-shot-example)
- [需要多少个示例？（How many examples?）](#需要多少个示例)
- [多样本 ICL 与微调](#多样本-icl-与微调)
- [动态示例选择（Dynamic Example Selection）](#动态示例选择-dynamic-example-selection)
- [标签细微差别的重要性（The Importance of Labelling Nuance）](#标签细微差别的重要性-the-importance-of-labelling-nuance)
- [高级 ICL：类比与轻量再训练（Advanced ICL: Analogy and Retraining-lite）](#高级-icl-类比与-few-shot-cot)
- [面试问题（Interview Questions）](#面试问题-interview-questions)
- [参考资料（References）](#参考资料-references)

---

## 少样本示例的构成（The Anatomy of a Few-Shot Example）

高质量示例由三个部分组成：
1. **输入**（Input）：潜在用户数据的真实样本。
2. **推理（可选）**（Reasoning, Optional）：对输出为何如此的简短说明。
3. **输出**（Output）：“Gold Standard（金标准）”结果。

```markdown
User: "The weather is okay, but the flight was late."
Reasoning: The user is neutral about the weather but negative about the service.
Sentiment: Mixed
```

---

## 需要多少个示例？

| 模型规模（Model Size） | 最佳区间（Sweet Spot） | 扩展行为（Scaling Behavior） |
|------------|------------|------------------|
| **Small (8B)** | 5 - 10 | 增益会持续到约 20 个示例。 |
| **Medium（70B 级稠密模型，或约 30B 激活参数的 MoE）**| 3 - 5 | 很快进入平台期；更多示例会增加延迟。 |
| **Frontier（闭源模型或 1T 级 MoE）**| 0 - 2 | 能力很强；通常“Instruction Following（指令遵循）”就足够了。示例主要用于固定输出格式。 |

**经验法则**：如果在短上下文预算下需要超过 20 个示例才能得到稳定输出，任务对该模型可能过于复杂。传统的下一步是**微调**；如今有了 1M-token 窗口和低价缓存读取，**多样本 ICL** 也成为切实可行的替代方案。

---

## 多样本 ICL 与微调

多样本 ICL 把数百乃至数千个示例放进提示。Google DeepMind 的研究（Agarwal 等人，2024）发现，许多任务的收益远超少样本范围；在一些案例中，多样本提示还能克服少样本提示无法改变的预训练偏差。

2026 年的经济条件发生变化，因为示例块是**稳定前缀**，而缓存读取很便宜：

| 方案（每请求标价） | 50K-token 示例块的输入成本 |
|----------------------------------|------------------------------------------|
| Claude Sonnet 5.5，未缓存（$2/1M） | $0.10 |
| Claude Sonnet 5.5 或 Opus 5.5，缓存读取（$0.20/1M） | $0.01 |
| GPT-6.1 Sol，缓存读取（$0.10/1M） | $0.005 |

按这些价格，多样本 ICL 在迭代速度（只需改示例，无需再训练）和可移植性（原样移到下个模型）方面优于微调。微调在逐请求延迟、示例放不进上下文，或必须在不发送示例的情况下获得该行为时仍占优。还要考虑平台风险：OpenAI 正逐步停止自助式微调，自 2027 年 1 月 6 日起，现有客户也不能创建新的微调任务。参见[微调策略](../03-training-and-adaptation/02-fine-tuning-strategies.md)。

---

## 动态示例选择（Dynamic Example Selection）

在生产环境中的 RAG 或分类任务里，不要对每个用户都使用同一组静态示例。
**动态模式：**
1. 用户提供一个查询。
2. 在“Gold Examples 向量数据库（Vector DB of Gold Examples）”中检索 3 个语义上最**相似**（semantically similar）的案例。
3. 将这 3 个特定案例注入到提示词（prompt）中。

**结果**：准确率会显著提高，因为模型能够看到与当前用户相关的“局部”模式。

**权衡**：动态示例每次请求都会变化，无法放在缓存前缀中。应把它们放在最后一个缓存断点之后；如果缓存节省超过逐查询选择的准确率收益，也可改用静态多样本块。

---

## 标签细微差别的重要性（The Importance of Labelling Nuance）

前沿模型（Frontier models）对示例中的**分布偏差（Distribution Bias）**很敏感。
- 如果你提供 5 个“Positive（正向）”示例和 1 个“Negative（负向）”示例，模型会偏向“Positive（正向）”。
- **修正**：始终使用**标签平衡（Label Balancing）**。确保少样本示例的大致输出分布与预期一致，或者完全平衡（1:1）。

---

## 高级 ICL：类比与“Few-Shot CoT”

**类比提示（Analogy Prompting）**：与其说“做 X”，不如提供一个类比。  
“像翻译者把一首诗从法语译成英语那样翻译这段代码——保留灵魂（逻辑），但改变语法（syntax）。”

**Few-Shot CoT**：提供 2 个推理过程明确的示例。这样会“预热”模型的注意力，让它更聚焦于逻辑，而不仅仅是模仿输出字符串。对于本就会在回答前推理的模型，这一点不那么重要；此时应通过示例展示希望模型采用的*判断标准*，而非编写思考脚本。示例中的推理只需简短理由：在最新 Claude 模型上，要求在输出中展示完整推理可能被拒绝（见[思维链](03-chain-of-thought.md#zero-shot-vs-programmatic-cot-零样本-vs-程序化-cot)）。

---

## 面试问题（Interview Questions）

### 问：为什么不直接把我们现有的 50 个示例全放进提示词里？

**强有力的答案：**
主要有三个原因：
1. **上下文窗口延迟（Context Window Latency）**：每个示例都会增加 token，提升“Prefill（预填充）”时间和每次请求的成本。
2. **注意力稀释（Attention Dilution）**：即使有 1M-token 窗口，模型也可能在过多无关数据中“丢失”特定约束（“lost-in-the-middle”效应和上下文腐化）。
3. **过拟合（Overfitting）**：提供过多窄化示例会使模型过于严格地模仿示例的*格式*，从而丧失处理该集合之外边界情况的通用能力。

反过来，如果 50 个示例稳定不变，就能成为缓存前缀；当缓存 token 的价格为每 1M $0.10 到 $0.20 时，成本顾虑基本消失。此时应以实测决定：分别用 3 个动态示例、全部 50 个示例和更多样本运行评测，选择满足质量门槛的最低成本配置。

### 问：在上下文学习（In-Context Learning）中，什么是“Label Bias（标签偏置）”？

**强有力的答案：**
标签偏置（Label Bias）是指模型更频繁地预测某个特定标签，仅仅因为它在少样本示例中出现得更频繁，或者因为它出现在列表末尾（多数标签偏差和近期偏差；Zhao 等人，2021）。标准缓解方法有：
1. 为不同请求打乱示例顺序。逐请求打乱会破坏前缀缓存，因此对于缓存示例块，应按提示版本选择一次平衡顺序，并通过置换测试验证。
2. 确保正向/负向/中性样本数量相等。
3. 在提示词开发过程中使用“Permutation Testing（置换测试）”，确保模型响应的是内容，而不是顺序。
4. 使用不含内容的输入（如“N/A”）校准，以测量并扣除先验偏差。

---

## 参考资料（References）
- Brown et al. "Language Models are Few-Shot Learners" (2020)
- Zhao 等人。“Calibrate Before Use: Improving Few-Shot Performance of Language Models”（2021）
- Min et al. "Rethinking the Role of Demonstrations: What Makes In-Context Learning Work?" (2022)
- Agarwal 等人。“Many-Shot In-Context Learning”（NeurIPS 2024）
- [OpenAI 弃用公告（微调逐步停止）](https://developers.openai.com/api/docs/deprecations)

---

*下一步： [Chain-of-Thought](03-chain-of-thought.md)*
