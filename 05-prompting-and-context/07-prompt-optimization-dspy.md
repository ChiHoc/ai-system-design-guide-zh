# 提示优化（DSPy）

提示工程已经从“手工调参”时代进入“程序化”时代。**DSPy（Declarative Self-improving Language Programs，声明式自我改进语言程序）** 是构建由算法自动优化提示的 LLM 流水线的事实标准。当前版本为 DSPy 3.4.0（2026 年 9 月 25 日）；3.x 版本线的重心已从优化提示文本（MIPROv2），转向结合反思和程序结构进行优化（GEPA，以及 3.3 中的 Flex）。框架细节见 [DSPy 专章](../09-frameworks-and-tools/05-dspy.md)；本章聚焦提示设计理念。

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

在传统提示工程中，更换模型（例如从 GPT-6.1 Sol 切换到 Claude Sonnet 5.5 或 Qwen3.8-27B 这样的开放权重模型）需要重写所有提示。
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

默认情况下，`ChainOfThought` 会在答案前加入一个由模型填写的纯文本 `reasoning` 输出字段。对推理模型，这属于重复工作；在最新 Claude 模型（Fable 5.1、Opus 5.5、Sonnet 5.5）上，输出中的 `reasoning` 字段还是触发 `reasoning_extraction` 拒绝的已列出因素。应将它与固定推理强度、使用原生思考的 `dspy.Predict` 比较，再由指标选择。

---

## Teleprompter（优化器）

Teleprompter（旧称；DSPy 文档如今称为**优化器**）是一种会迭代程序以提升准确率的算法。
1. **BootstrapFewShot**：自动为你的提示寻找高质量示例。
2. **MIPROv2**：一种 Bayesian optimizer（贝叶斯优化器），会尝试不同的指令表述与示例，并选出分数最高的组合。对于拥有几百个标注示例、流水线固定的情况，它仍是主力工具。
3. **GEPA**（反思式提示演化）：LLM 读取执行轨迹和指标反馈，提出有针对性的指令修改，并保留候选方案的帕累托前沿。论文报告其以少得多的 rollout 达到或超过基于 RL 的调优效果；当每次 rollout 都是长智能体运行时，这点尤为重要。
4. **Flex**（DSPy 3.3.0，2026 年 8 月 3 日）：借助 GEPA 优化**程序结构**（有哪些模块、它们如何连接），不只优化提示文本。
5. **ReAnchor**（DSPy 3.4.0）：根据程序指标校准判断阈值、分数截断值和选项权重，适用于输出为类型化决策（是/否、选项、分数）而非自由文本的程序。

**重要原因**：你不再需要猜测“Be helpful”还是“Think carefully”更好。优化器会用数据证明它。

---

## “Prompt as Weight（提示即权重）”类比

在 DSPy 中，你的提示就像神经网络中的权重。你不会去“硬编码”权重，而是训练它们。
- 如果你更换模型，只需 **Re-compile（重新编译）** 你的程序，也就是重新训练。优化器会为新模型找到它更容易理解的新 few-shot（少样本）示例。
- 将**推理强度也视为模型的一部分**。默认值不同（Claude Opus 5.5 默认为 `medium`，Opus 5 为 `high`），最新 API 正在移除采样参数，因此在某一推理强度下编译的程序，不能视为在另一强度下已验证。
- 还应锁定 DSPy 版本。3.4.0 移除了 3.3 的实验性 typed LM API；OpenAI 风格的 `messages=` 调用如今会给出弃用警告，计划在 3.5 移除。

---

## 基于指标的优化

优化需要一个 **Metric（指标）**（返回分数的函数）。
- **Exact Match（精确匹配）**：`prediction.answer == target.answer`
- **LLM-as-Judge（以大模型作评审）**：使用更强模型（Claude Opus 5.5、GPT-6.1 Sol）评估较小模型（Claude Haiku 4.5、GPT-6 Luna、Gemini 3.8 Flash）的输出。应先用人工标签校准评审模型：优化器会利用指标的任何盲点。
- **评审成本**：一次优化会给数百至数千个候选输出打分，因此评审模型常是账单主体。对于二元检查项，类型化决策模型是更便宜的选择：一项比较（arXiv 2609.29769）发现，LLM 规则评审的成本是 TypeSafe Jev（早期访问）的 16 至 325x，而 27 组配对比较中，准确率出现显著差异的最多 8 组。两者也可能一起犯错：在 Jev 最有把握的错误案例中，约 96% 的 LLM 判定重复了同一错误，因此换评审模型不能取代人工校准集。
- **文本反馈**：当指标返回失败*原因*而不只是分数时，GEPA 效果最好。

---

## 面试题

### Q: DSPy 如何解决提示工程的“脆弱性”？

**强回答：**
DSPy 将“格式化”和“grounding（落地/对齐事实）”的复杂性从人手中转移到编译器中。当我们手写提示时，本质上是在“硬编码”只适用于某个模型、某个特定时间点的行为（point-in-time tuning，时点调优）。如果那个模型更新或被替换，提示就会失效。DSPy 把提示视为可学习参数。通过定义清晰的 **Signature（签名）** 和 **Metric（指标）**，系统可以通过数百至数千次经过评估的 rollout 来“搜索”最有效的提示，使最终系统对模型变化更具韧性。脆弱性并未消失，而是转移到指标中，因此现在必须把指标设计正确。

### Q: 在 DSPy 语境中，什么是 “Teleprompter”？

**强回答：**
Teleprompter（现称优化器）是一种程序化优化器。它的工作是接收一个 DSPy 程序（可能是由多个模块组成的复杂链路）和一小组训练样本，然后将它们“编译”成优化后的版本。它生成候选的“thinking patterns（思维模式）”和示例，使用指标测试并选出最有效的方案。简而言之，Teleprompter 就是提示工程世界里的“梯度下降（Gradient Descent）”。2026 年的扩展是，新优化器除提示文本外还搜索程序结构：Flex 可以新增验证步骤或改变模块边界，而不只是改写指令。

---

## 参考资料
- Khattab 等人。“DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines”（2023/2024）
- Agrawal 等人。“GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning”（2025）
- [DSPy 发布版本（3.3.0、3.4.0）](https://github.com/stanfordnlp/dspy/releases)
- [Rao 与 Callison-Burch。“JEV vs. LLMs as Rubric Judges: Cheaper, Faster, and Wrong in the Same Places”（arXiv 2609.29769）](https://arxiv.org/abs/2609.29769)
- Stanford NLP。“DSPy 文档与教程” (2025)
- [Anthropic。“拒绝与回退”：将推理保留在思考块中](https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback#keep-reasoning-in-thinking-blocks)

---

*下一篇：[提示注入与防御](08-prompt-injection-defense.md)*
