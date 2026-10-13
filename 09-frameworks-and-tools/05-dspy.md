# DSPy：编程式语言模型

**DSPy** 已成为将提示视为可优化参数的行业参考。它代表了从“提示工程”（试错）到 **提示编译**（自动化优化）的范式转变。已发表的结果显示，它在某些任务上相较手工调优提示有显著提升，但提升幅度完全取决于度量和数据；在承诺具体数字前，应先用自己的评估集测量。

2026 年的第二次转变，是从优化 **提示** 走向优化 **程序结构**：GEPA（反思式提示演化，DSPy 3.0）使优化由执行轨迹驱动；Flex（DSPy 3.3.0，2026 年 8 月 3 日）借此搜索模块如何组合，而不仅是指令文本。当前版本为 DSPy 3.4.0（2026 年 9 月 25 日）。

## 目录

- [编程范式](#编程范式)
- [签名：描述任务](#签名-描述任务)
- [优化器：MIPROv2、GEPA 与 Flex](#优化器-miprov2、gepa-与-flex)
- [输出约束：Refine 与 BestOfN](#输出约束-refine-与-bestofn)
- [管理模型漂移](#管理模型漂移)
- [DSPy 3.3 与 3.4 的变化](#dspy-3-3-与-3-4-的变化)
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
**关键优势**：签名是 **模型无关** 的。你可以在不更改一行程序代码的情况下，将它们编译到 Claude Opus 5.5、Claude Sonnet 5.5、GPT-6.1 Sol、Gemini 3.8 Flash，或 Qwen3.8-27B 等开放权重模型上。每个模型对应的编译产物（指令和示例）会变化，因此每个模型档位都需要单独编译。

---

## 优化器：MIPROv2、GEPA 与 Flex

**MIPROv2（多阶段指令提案优化器，Multi-stage Instruction PRoposal Optimizer）** 是长期使用的主力优化器。
1。**指令提案**：一个“助手模型”为该任务提出 10-20 种不同的系统提示写法。
2。**贝叶斯优化**：DSPy 将这些候选提示在一个小型训练集上运行，并使用某个度量进行评分。
3。**选择**：它选出能最大化你的度量（例如，事实性分数）的提示。

**GEPA**（反思式提示演化，`dspy.GEPA`，加入于 DSPy 3.0）用反思取代仅看分数的搜索：LLM 阅读执行轨迹和度量反馈，提出有针对性的指令修改，并保留在不同示例上表现占优的候选组成的帕累托前沿。它既能使用文本反馈，也能使用标量分数。作者报告，在其任务上，它以远少于强化学习所需的 rollout 次数，超越了 RL 微调（GRPO）和 MIPROv2。

**Flex**（DSPy 3.3.0，2026 年 8 月 3 日）使用 GEPA 优化 **程序结构**：有哪些模块、模块如何连接，而不只是每个提示的措辞。**ReAnchor**（3.4.0，2026 年 9 月 25 日）则依据程序度量校准决策阈值、分数截断值与选项权重。

| 优化器 | 搜索对象 | 适用场景 |
|---|---|---|
| MIPROv2 | 指令与少样本示例 | 固定流水线需要更好的提示，且有数百个带标签示例 |
| GEPA | 以轨迹反思和文本反馈引导的指令 | rollout 成本高，或度量能解释输出为何失败 |
| Flex | 借助 GEPA 搜索程序结构 | 怀疑任务分解本身有误，例如缺少验证步骤或模块边界不合理 |

---

## 输出约束：Refine 与 BestOfN

旧教程会介绍 `dspy.Assert` 和 `dspy.Suggest`。它们在 DSPy 2.6 中被弃用，并已从 3.x 移除；使用它们的代码在当前版本安装环境中会失败。替代方案接收 **奖励函数**，而非布尔断言：

```python
import dspy

def under_50_words(args, pred) -> float:
    return 1.0 if len(pred.answer.split()) <= 50 else 0.0

qa = dspy.ChainOfThought("question -> answer")

# Retry up to 3 times with feedback until the reward clears the threshold
refined = dspy.Refine(module=qa, N=3, reward_fn=under_50_words, threshold=1.0)

# Or sample 3 independently and keep the best
best = dspy.BestOfN(module=qa, N=3, reward_fn=under_50_words, threshold=1.0)
```

- `dspy.Refine` 将失败的尝试作为提示反馈给模型，适合长度、格式等软约束。
- `dspy.BestOfN` 独立采样并保留奖励最高的结果，适合有噪声的任务。
- **硬约束**（如“不得包含 PII”）不应依赖重试。应在模块后放置确定性验证器，验证失败时拒绝输出；奖励函数只能提高合规概率，不能提供保证。

---

## 管理模型漂移

当 OpenAI 或 Anthropic 发布新模型时，手工编写的提示通常会失效。仅在 2026 年 9 月，Anthropic 就推出了 Fable 5.1、Opus 5.5 和 Sonnet 5.5，OpenAI 推出了 GPT-6 Astra、GPT-6 Sol、Luna 和 GPT-6.1 Sol。
- **DSPy 的应对方式**：**重新编译**。优化器针对同一度量，为新模型寻找新的指令和示例，使模型迁移成为可衡量的工作，而非重新编写程序。
- **前提**：重新编译的效果取决于评估集和度量，而且会消耗真实的模型调用。应为每次模型切换预留预算，并以编译后的程序胜过旧版本作为切换门槛。

---

## DSPy 3.3 与 3.4 的变化

DSPy 和其他框架一样变化迅速，因此要锁定版本：

| 版本 | 日期 | 变化 |
|---|---|---|
| 3.3.0 | 2026 年 8 月 3 日 | Flex 结构优化；支持原生工具调用的 **ReActV2**；开始引入有类型、与提供方无关的 LM 边界；NumPy 变为可选依赖 |
| 3.3.1 | 2026 年 8 月 21 日 | GEPA 0.1.4；强化 `PythonInterpreter`；兼容 MCP Python SDK v2 |
| 3.4.0 | 2026 年 9 月 25 日 | 支持自定义 HTTP 提供方的原生 LM 引擎。**破坏性变更**：移除了 3.3 中的实验性有类型 LM API。另有异步 ReActV2、`LocalInterpreter`（供可信代码使用的持久化 CPython，与 RLM 和 Flex 配合）、ReAnchor，以及可与 TypeSafe 的 Jev 决策模型集成的实验性有类型决策输出（`Noul`、`Choice`、`Score`） |

另有两项弃用需要规划：OpenAI 风格的 `messages=` 调用现在会产生警告，计划在 3.5 移除；自定义 `BaseLM.forward` 集成在 3.5 之前也会持续产生弃用警告。

---

## 面试题

### Q：为什么说 DSPy 是“反提示工程”？

**强回答：**
因为它用 **优化循环** 替代了 **手工试错循环**。在提示工程中，人类是优化器；在 DSPy 中，人类是 **教师**。你定义 *目标*（签名）和 *评估*（度量），并提供少量 *示例*。随后框架使用数学优化（如贝叶斯搜索）来找到在统计上表现最佳的 token。这使系统比一组硬编码字符串更 **可移植**、更 **可扩展**。

### Q：在生产环境中使用 DSPy 的最大缺点是什么？

**强回答：**
**编译延迟和成本**。要编译一个复杂的 DSPy 流水线，你可能需要运行 100-500 次 LLM 调用来测试不同的提示变体，而且要为每个目标模型重复这一过程。这是一项显著的前期成本。不过，对于 Staff 级工程师来说，这是一个 **权衡**：你在开发/编译时间上付出更多，以换取针对受控度量 **经过测量的可靠性** 和更低的 **运行时失败率**。这并无保证：编译后的程序好坏取决于评估集。另一个挑战是学习曲线；它要求你像机器学习研究员而不是传统开发者那样思考。第三个挑战是框架更迭：3.4 移除了不到八周前 3.3 才引入的实验性 API，因此要锁定版本，并在升级时重新运行评估套件。

### Q：什么时候会使用 GEPA 或 Flex，而不是 MIPROv2？

**强回答：**
MIPROv2 针对固定流水线搜索指令和示例，需要足够多的 rollout 才能发挥贝叶斯搜索的作用。GEPA 会反思执行轨迹和文本反馈，因此适合每次 rollout 成本高（如长时间运行的智能体）或度量能解释输出为何失败的场景。Flex 更进一步，通过 GEPA 改变程序结构；如果错误分析表明任务分解有问题，例如缺少验证步骤，而非措辞问题，我会尝试它。无论采用哪种优化器，决定性因素都是度量：弱度量会让任何优化器过拟合，所以我会保留一组优化器从未见过的留出测试集。

---

## 参考资料
- Khattab 等人. “DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines”（arXiv 2310.03714，2023 年 10 月）：https://arxiv.org/abs/2310.03714
- Opsahl-Ong 等人. “Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs”（arXiv 2406.11695，2024 年 6 月；MIPRO 论文）：https://arxiv.org/abs/2406.11695
- Agrawal 等人. “GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning”（arXiv 2507.19457，2025 年 7 月）：https://arxiv.org/abs/2507.19457
- DSPy 3.4.0 发布说明（2026 年 9 月 25 日）：https://github.com/stanfordnlp/dspy/releases
- DSPy.“Output Refinement: BestOfN and Refine”：https://dspy.ai/tutorials/output_refinement/best-of-n-and-refine/

---

*下一篇：[Semantic Kernel：企业级 AI](06-semantic-kernel.md)*
