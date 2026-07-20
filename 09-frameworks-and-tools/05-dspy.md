# DSPy：编程式语言模型

**DSPy** 已成为高可靠性 AI 系统的行业参考。它代表了从“提示工程”（试错）到 **提示编译**（自动化优化）的范式转变，基准测试持续显示其质量相较手工调优提示提升了 10-40%。

## 目录

- [编程范式](#编程范式)
- [签名：描述任务](#签名-描述任务)
- [优化器与 MIPROv2](#优化器与-miprov2)
- [断言与约束](#断言与约束)
- [管理模型漂移](#管理模型漂移)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 编程范式

DSPy 将一个 LLM 应用视为一个 **神经网络**。
- **模块**：可复用的逻辑块（例如 `ChainOfThought`）。
- **签名**：对模块功能的声明式规范（输入 -> 输出）。
- **优化器**：根据某个度量为模块寻找最佳“权重”（提示）的过程。

---

## 签名：描述任务

你无需编写一个 100 行的提示，而是编写一个 **签名**：
```python
class ResearchAssistant(dspy.Signature):
    """Answer the question by synthesizing the provided web context."""
    context = dspy.InputField(desc="Scraped web content")
    question = dspy.InputField()
    answer = dspy.OutputField(desc="A technical summary with citations")
```
**关键优势**：签名是 **模型无关** 的。你可以在不更改一行代码的情况下，将它们编译到 Claude Opus 4.7、Claude Sonnet 4.6、GPT-5.5、Gemini 3.1 Pro，或 Llama 4 8B 上。

---

## 优化器与 MIPROv2

**MIPROv2（多阶段指令提案优化器，Multi-stage Instruction PRoposal Optimizer）** 是 DSPy 的旗舰优化器。
1。**指令提案**：一个“助手模型”为该任务提出 10-20 种不同的系统提示写法。
2。**贝叶斯优化**：DSPy 将这些候选提示在一个小型训练集上运行，并使用某个度量进行评分。
3。**选择**：它选出能最大化你的度量（例如，事实性分数）的提示。

---

## 断言与约束

DSPy 支持 **硬断言和软断言**。
- `dspy.Suggest(...)`：如果模型未通过某个检查（例如，“答案必须少于 50 个词”），DSPy 会**自动重新提示**模型，并附上失败原因以便其自我纠正。
- `dspy.Assert(...)`：如果某个硬约束被破坏（例如，“不得包含 PII（个人可识别信息）”），执行会停止并进入恢复状态。

---

## 管理模型漂移

当 OpenAI 或 Anthropic 发布权重更新时，手工编写的提示通常会失效。
- **2025 方案**：使用 DSPy 时，你只需**重新编译**。优化器会为更新后的模型架构寻找新的“最优” token，在无需人工劳动的情况下保持一致性。

---

## 面试题

### Q：为什么说 DSPy 是“反提示工程”？

**强回答：**
因为它用 **优化循环** 替代了 **手工试错循环**。在提示工程中，人类是优化器；在 DSPy 中，人类是 **教师**。你定义 *目标*（签名）和 *评估*（度量），并提供少量 *示例*。随后框架使用数学优化（如贝叶斯搜索）来找到在统计上表现最佳的 token。这使系统比一组硬编码字符串更 **可移植**、更 **可扩展**。

### Q：在生产环境中使用 DSPy 的最大缺点是什么？

**强回答：**
**编译延迟和成本**。要编译一个复杂的 DSPy 流水线，你可能需要运行 100-500 次 LLM 调用来测试不同的提示变体。这是一项显著的前期成本。不过，对于 Staff 级工程师来说，这是一个 **权衡**：你在开发/编译时间上付出更多，以换取 **有保证的可靠性** 和更低的 **运行时失败率**。另一个挑战是学习曲线；它要求你像机器学习研究员而不是传统开发者那样思考。

---

## 参考资料
- Khattab 等人. “DSPy: Compiling Declarative Language Model Calls” (2024/2025)
- 斯坦福 NLP. “The MIPROv2 Technical Report” (2025)
- Databricks. “Productionizing Programmed Prompts” (2025)

---

*下一篇：[Semantic Kernel：企业级 AI](06-semantic-kernel.md)*
