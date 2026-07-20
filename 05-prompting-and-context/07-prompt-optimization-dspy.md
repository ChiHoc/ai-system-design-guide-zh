# 提示优化（DSPy）

提示工程已经从“手工调参”时代进入“程序化”时代。**DSPy（Declarative Self-improving Language Programs，声明式自我改进语言程序）** 是构建稳健 LLM（大语言模型）流水线的事实标准，提示会由算法自动优化。3.x 版本线（DSPy 3.1.3 于 2 月发布，5、2026，并在 5 月持续发布点版本到 2026）引入了与 reasoning-native models（原生推理模型）的更紧密集成，以及更简洁的异步运行时。

## 目录

- [DSPy 理念：编程 vs. 提示](#dspy-理念-编程-vs-提示)
- [Signature（签名）与 Module（模块）](#signature-与-module)
- [Teleprompter（优化器）](#teleprompter-优化器)
- [“Prompt as Weight（提示即权重）”类比](#prompt-as-weight-提示即权重-类比)
- [基于指标的优化](#基于指标的优化)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## DSPy 理念：编程 vs. 提示

在传统提示工程中，更换模型（例如从 GPT-5.5 切换到 Claude Sonnet 4.6 或 Llama 4）需要重写所有提示。
**DSPy 将逻辑与格式分离。**

- **逻辑**：由 **Module（模块）** 定义（例如 ChainOfThought、ReAct）。
- **优化**：系统会自动为一个 *特定* 模型寻找最优提示和示例，以实现该逻辑。

---

## Signature 与 Module

你不再编写一段提示词，而是定义一个 **Signature（签名）**：输入是什么，输出应该是什么。

```python
# Signature pattern
class MultiHopQA(dspy.Signature):
    """Answer questions that require multiple context retrievals."""
    context = dspy.InputField()
    question = dspy.InputField()
    answer = dspy.OutputField(desc="A concise 1-sentence answer")

# Logic is handled by a Module
qa_system = dspy.ChainOfThought(MultiHopQA)
```

---

## Teleprompter（优化器）

Teleprompter 是一种会迭代你的程序以提升准确率的算法。
1. **BootstrapFewShot**：自动为你的提示寻找高质量示例。
2. **MIPROv2**：一种 Bayesian optimizer（贝叶斯优化器），会尝试不同的指令表述，并选择能最大化分数的那个。在 3.x 版本线中，它仍然是旗舰优化器。

**重要原因**：你不再需要猜测“Be helpful”还是“Think carefully”更好。优化器会用数据证明它。

---

## “Prompt as Weight（提示即权重）”类比

在 DSPy 中，你的提示就像神经网络中的权重。你不会去“硬编码”权重，而是训练它们。
- 如果你更换模型，只需 **Re-compile（重新编译）** 你的程序，也就是重新训练。优化器会为新模型找到它更容易理解的新 few-shot（少样本）示例。

---

## 基于指标的优化

优化需要一个 **Metric（指标）**（返回分数的函数）。
- **Exact Match（精确匹配）**：`prediction.answer == target.answer`
- **LLM-as-Judge（以大模型作评审）**：使用更大的模型（Claude Opus 4.7、GPT-5.5 reasoning）来评估更小模型的输出（Llama 4 8B、Claude Haiku 4.5）。

---

## 面试题

### Q: DSPy 如何解决提示工程的“脆弱性”？

**强回答：**
DSPy 将“格式化”和“grounding（落地/对齐事实）”的复杂性从人手中转移到编译器中。当我们手写提示时，本质上是在“硬编码”只适用于某个模型、某个特定时间点的行为（point-in-time tuning，时点调优）。如果那个模型更新或被替换，提示就会失效。DSPy 把提示视为可学习参数。通过定义清晰的 **Signature（签名）** 和 **Metric（指标）**，系统可以通过成千上万次模拟迭代来“搜索”最有效的提示，使最终系统对模型变化更具韧性。

### Q: 在 DSPy 语境中，什么是 “Teleprompter”？

**强回答：**
Teleprompter 是一种程序化优化器。它的工作是接收一个 DSPy 程序（可能是由多个模块组成的复杂链路）和一小组训练样本，然后将它们“编译”成一个优化后的版本。它通过生成候选的“thinking patterns（思维模式）”和示例，使用指标进行测试，并选出最有效的那些。简而言之，Teleprompter 就是提示工程世界里的“梯度下降（Gradient Descent）”。

---

## 参考资料
- Khattab 等人。“DSPy: Compiling Declarative Language Models” (2023/2024)
- Stanford NLP。“DSPy 文档与教程” (2025)

---

*下一篇：[提示注入与防御](08-prompt-injection-defense.md)*
