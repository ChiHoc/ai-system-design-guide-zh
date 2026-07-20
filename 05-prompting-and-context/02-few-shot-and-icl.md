# 少样本（Few-Shot）与上下文学习（In-Context Learning, ICL）

上下文学习（In-Context Learning, ICL）是指大语言模型（LLM）仅通过查看提示词中的示例即可学习新任务，而无需进行任何权重更新（weight updates）的能力。最大化 ICL 效率是提升提示稳定性的关键杠杆。

## 目录

- [少样本示例的构成（The Anatomy of a Few-Shot Example）](#少样本示例的构成-the-anatomy-of-a-few-shot-example)
- [需要多少个示例？（How many examples?）](#需要多少个示例)
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
| **Medium (70B)**| 3 - 5 | 很快进入平台期；更多示例会增加延迟。 |
| **Frontier (405B)**| 1 - 2 | 能力很强；通常“Instruction Following（指令遵循）”就足够了。 |

**经验法则**：如果你需要超过 20 个示例才能得到稳定输出，那么你的任务很可能对模型来说过于复杂，或者你应当考虑 **Fine-tuning（微调）**。

---

## 动态示例选择（Dynamic Example Selection）

在生产环境中的 RAG 或分类任务里，不要对每个用户都使用同一组静态示例。
**动态模式：**
1. 用户提供一个查询。
2. 在“Gold Examples 向量数据库（Vector DB of Gold Examples）”中检索 3 个语义上最**相似**（semantically similar）的案例。
3. 将这 3 个特定案例注入到提示词（prompt）中。

**结果**：准确率会显著提高，因为模型能够看到与当前用户相关的“局部”模式。

---

## 标签细微差别的重要性（The Importance of Labelling Nuance）

前沿模型（Frontier models）对示例中的**分布偏差（Distribution Bias）**很敏感。
- 如果你提供 5 个“Positive（正向）”示例和 1 个“Negative（负向）”示例，模型会偏向“Positive（正向）”。
- **修正**：始终使用**标签平衡（Label Balancing）**。确保少样本示例的大致输出分布与预期一致，或者完全平衡（1:1）。

---

## 高级 ICL：类比与“Few-Shot CoT”

**类比提示（Analogy Prompting）**：与其说“做 X”，不如提供一个类比。  
“像翻译者把一首诗从法语译成英语那样翻译这段代码——保留灵魂（逻辑），但改变语法（syntax）。”

**Few-Shot CoT**：提供 2 个推理过程明确的示例。这样会“预热”模型的注意力，让它更聚焦于逻辑，而不仅仅是模仿输出字符串。

---

## 面试问题（Interview Questions）

### 问：为什么不直接把我们现有的 50 个示例全放进提示词里？

**强有力的答案：**
主要有三个原因：
1. **上下文窗口延迟（Context Window Latency）**：每个示例都会增加 token，提升“Prefill（预填充）”时间和每次请求的成本。
2. **注意力稀释（Attention Dilution）**：即使有 128k 上下文，模型也可能在过多无关数据中“丢失”特定约束（“lost-in-the-middle”效应）。
3. **过拟合（Overfitting）**：提供过多窄化示例会使模型过于严格地模仿示例的*格式*，从而丧失处理该集合之外边界情况的通用能力。

### 问：在上下文学习（In-Context Learning）中，什么是“Label Bias（标签偏置）”？

**强有力的答案：**
标签偏置（Label Bias）是指模型更频繁地预测某个特定标签，仅仅因为它在少样本示例中出现得更频繁，或者因为它出现在列表末尾。标准缓解方法有：
1. 为不同请求打乱示例顺序。
2. 确保正向/负向/中性样本数量相等。
3. 在提示词开发过程中使用“Permutation Testing（置换测试）”，确保模型响应的是内容，而不是顺序。

---

## 参考资料（References）
- Brown et al. "Language Models are Few-Shot Learners" (2020)
- Min et al. "Rethinking the Role of Demonstrations: What Makes In-Context Learning Work?" (2022)

---

*下一步： [Chain-of-Thought](03-chain-of-thought.md)*
