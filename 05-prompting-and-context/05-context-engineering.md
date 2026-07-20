# 上下文工程

上下文工程（Context Engineering）是用最有价值的 token 填满 LLM 有限“工作记忆”的科学。随着上下文窗口如今已达到 1M+ token（Claude Sonnet 4.6、Gemini 3.1 Pro、GPT-5.5），以及模型获得了扩展思考（Extended Thinking），重点已从“容纳数据”转向“排序相关性”和“管理计算预算”。

## 目录

- [长上下文范式（1M+ token）](#长上下文范式-1m-token)
- [智能体式上下文工程](#智能体式上下文工程)
- [扩展思考与预算 token](#扩展思考与预算-token)
- [中间遗失效应](#中间遗失效应)
- [上下文预算与 token 感知](#上下文预算与-token-感知)
- [提示缓存经济学](#提示缓存经济学)
- [上下文压缩（RAD-L）](#上下文压缩-rad-l)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 长上下文范式（1M+ token）

Gemini 3.1 Pro（1M）、Claude Sonnet 4.6（1M）、Claude Opus 4.7（1M）和 GPT-5.5（1M）等模型拥有巨大的上下文窗口。

**洞见**：“上下文就是新的 RAG（检索增强生成）。”
对于少于 100,000 篇文档的数据集，把整个数据集直接放进上下文窗口，往往比使用外部向量数据库更准确也更快。这称为 **“上下文内 RAG（In-Context RAG）”**。

---

## 智能体式上下文工程

提示工程（Prompt Engineering）只写一条好的指令。**上下文工程（Context Engineering）**则为智能体循环中的**每一次推理轮次**策划模型所见的完整 token 集合：系统提示、工具、检索到的数据、先前的工具结果，以及持续累积的消息历史。二者的区别很重要，因为智能体会在一轮又一轮中累积上下文，所以策划问题是持续性的，而不是一次性的。这正是 Anthropic、OpenAI 和 Google 现在构建其智能体框架的基础。

### 上下文腐化：为什么上下文是一种有限资源

一个 1M token 的窗口并不意味着你应该把它填满。模型会受到**上下文腐化（context rot）**的影响：随着 token 数增长，准确率会下降，因为注意力计算会按 n 平方的成对关系扩展，而训练数据又偏向较短序列。应把上下文视为一个边际收益递减的预算，而不是免费的空间。工作目标是保留**最小的一组高信号 token**，只要它仍能让模型正确行动即可。

### 五种核心技术

| 技术 | 它的作用 | 何时使用 |
|-----------|--------------|----------|
| **压缩（Compaction）** | 总结消息历史，并用压缩后的摘要加上最近的少量产物重新初始化循环 | 长时间来回对话，接近窗口上限时 |
| **即时加载（Just-in-time loading）** | 在上下文中只保留轻量级标识符（文件路径、URL、行 ID），并在需要时通过工具加载完整内容 | 体量过大无法全部放入的语料库或数据库，探索性任务 |
| **结构化记笔记（Structured note-taking）** | 智能体把进展笔记写到窗口外的文件或记忆存储中，之后再读回 | 跨越几十次工具调用的长周期任务 |
| **子智能体隔离（Sub-agent isolation）** | 为子任务启动一个拥有干净窗口的专注子智能体；它只返回 1k-2k token 的摘要 | 并行研究、深度搜索、任何会把中间细节淹没主窗口的任务 |
| **系统提示校准（System prompt calibration）** | 追求“金发姑娘区间（Goldilocks zone）”：足够具体以确保可靠，又足够通用以避免脆弱；使用清晰的 XML 或 Markdown 分节 | 始终如此，作为另外四种技术的基础 |

### 压缩

当历史变得很长时，把它交回模型进行总结，保留承重细节（架构决策、未解决的 bug、关键约束），丢弃重复的工具输出。Claude Code 采用了这种模式：它会在压缩后的摘要基础上继续，并带上最近访问过的文件。**先优化召回率**（保留所有重要内容），再提升精确率（削减冗余）。

### 即时加载

智能体不会预先加载每一份文档，而是持有引用，并且只在某一步需要时才抓取内容。这与人类从文件树工作的方式很像：你会打开需要的文件，而不是整个仓库。这样可以保持窗口更小，也让智能体通过探索来发现结构。代价是延迟，所以混合方式（预加载显而易见的内容，其余按需获取）通常最好。

### 结构化记笔记（智能体记忆）

智能体把笔记持久化到上下文窗口之外，并在相关时把它们拉回来。这正是智能体能够在远长于自身窗口的任务中保持连贯的原因。关于存储底座（文件系统、向量、图），参见 [智能体记忆与状态](../07-agentic-systems/05-agent-memory-and-state.md) 和 [记忆架构](../08-memory-and-state/01-memory-architectures.md)。

### 子智能体隔离

协调器把一个聚焦的子任务委派给一个在自己干净窗口中工作的子智能体，并由其返回浓缩摘要。详细的搜索或分析上下文不会污染协调器的窗口。这是多智能体系统之所以有效的上下文管理原因，和任何并行性收益无关。参见 [多智能体编排](../07-agentic-systems/04-multi-agent-orchestration.md)。

---

## 扩展思考与预算 token

若干前沿模型现在在生成响应之前提供**可控的内部推理**：

### Claude（Sonnet 4.6、Opus 4.7）：扩展思考

```python
response = client.messages.create(
    model="claude-3-7-sonnet-20250219",
    max_tokens=16000,
    thinking={
        "type": "enabled",
        "budget_tokens": 10000  # max internal reasoning tokens
    },
    messages=[{"role": "user", "content": "Refactor this codebase to be async..."}]
)

# Response has two blocks:
# 1. thinking block (visible for debug, not shown to user)
# 2. text block (the actual answer)
for block in response.content:
    if block.type == "thinking":
        print("[THINKING]", block.thinking)
    elif block.type == "text":
        print("[ANSWER]", block.text)
```

**关键参数：**
- `budget_tokens`：1,024 → 100,000。越高 = 准确率越好，成本越高。
- 思考 token 按标准费率计费。10K 的思考预算 = 每次请求 +$0.15。
- 支持流式输出 - 思考块会先于文本流出。

### o3（OpenAI）—— 推理力度

```python
response = client.chat.completions.create(
    model="o3",
    reasoning_effort="medium",  # "low" | "medium" | "high"
    messages=[{"role": "user", "content": "Prove P=NP or disprove it."}]
)
# Reasoning tokens are invisible — o3 never exposes its internal chain
```

**力度等级与成本（约）：**
| 力度 | 速度 | 成本倍率 | 最适合 |
|--------|-------|-----------------|----------|
| low | 快 | 1x | 简单逻辑、快速查询 |
| medium | 中 | 3-5x | 编码、分析 |
| high | 慢 | 8-20x | 博士级问题、ARC-AGI |

### 何时启用思考 / 推理

| 条件 | 建议 |
|-----------|----------------|
| 复杂的多步骤代码重构 | ✅ 启用（预算：8K-20K） |
| 简单问答 / 抽取 | ❌ 禁用 - 会增加成本和延迟 |
| STEM / 数学问题 | ✅ 启用（o3-mini medium） |
| 高吞吐聊天机器人 | ❌ 禁用 - 使用标准模式 |
| 安全关键决策 | ✅ 启用 - 额外推理可捕捉边缘情况 |

**生产模式**：使用复杂度分类器来门控扩展思考。如果查询复杂度得分 < 0.5，就完全跳过思考模式（在推理密集型工作负载上可节省 60-80%）。

```python
def smart_generate(query: str) -> str:
    complexity = classifier.predict(query)  # 0-1 score
    
    if complexity > 0.7:
        # Enable Extended Thinking for hard problems
        return claude_with_thinking(query, budget_tokens=8000)
    else:
        # Standard fast mode for simple tasks
        return claude_standard(query)
```

---

## 中间遗失效应

在 2023 中，模型对提示中间位置的信息准确率会下降。
**状态**：前沿模型（Claude Sonnet 4.6、Claude Opus 4.7、Gemini 3.1 Pro、GPT-5.5）表现显著更好，但**注意力梯度（Attention Gradient）**仍然存在。
- **最佳实践**：把关键指令和黄金标准示例放在提示的**最开始**和**最后**。中间 = 原始数据 / 知识块。
- **使用块排序**：对检索到的文档重新排序，让最相关的排在最前和最后。

---

## 上下文预算与 token 感知

每个 token 都要花钱，并且会增加 TTFT（首 token 时间，Time to First Token）。

| 组成部分 | 预算（Token） | 为什么？ |
|-----------|-----------------|------|
| **系统提示** | 500 - 1,000 | 核心逻辑和人格。 |
| **历史记录** | 2,000 - 5,000 | 对话“状态”。 |
| **数据 / 搜索** | 10k - 1M | 取决于任务深度。 |
| **输出预留**| 1,000 - 4,000 | 必须为推理预留空间。 |

---

## 提示缓存经济学

几乎所有主要提供商（OpenAI、DeepSeek、Anthropic、Google）都支持**前缀缓存（Prefix Caching）**。

- **交叉点**：如果你将一个 100k token 的上下文（例如代码库）重复用于超过 2 次请求，缓存折扣实际上会让它比 RAG 更便宜。
- **缓存命中**：$0.05 / 1M token。
- **缓存未命中**：$5.00 / 1M token。

**架构选择**：让你的系统保持“系统提示 + 基础知识”静态，以维持 100% 的缓存命中率。

---

## 上下文压缩（RAD-L）

对于极长的上下文（10M+），我们使用**推理感知删除（Reasoning-Aware Deletion，RAD-L）**。
- **方式**：一个小型辅助模型（0.1B）扫描文本，在提示发送给巨大的前沿模型之前，删除“填充词”、常见语言模式和无关章节。
- **收益**：在准确率下降小于 1% 的情况下，将提示大小减少 20-50%。

---

## 面试题

### 问：你会在什么情况下选择长上下文而不是 RAG？

**强答案：**
当高保真检索和跨文档推理至关重要时，我会选择长上下文。RAG 受制于“检索缺口（Retrieval Gap）”——如果向量搜索错过了相关片段，模型就永远看不到它。长上下文（最高 2M token）提供 100% 级召回率。具体来说，我会把它用于代码库分析、法律文档审阅和多文件财务审计。对于动态的 Web 规模数据或超出任何上下文窗口的十亿文档级数据集，我仍会坚持使用 RAG。

### 问：你如何处理百万 token 提示带来的高 TTFT？

**强答案：**
主要方案是**上下文缓存（Context Caching）**。通过把重文档缓存到 GPU 集群上，模型就不必在每一轮都“重新读取”（预填充，prefill）完整的 1M token。缓存提示的 TTFT 几乎和 1k token 提示一样。除此之外，对于未缓存请求，我会使用**流式预填充（Streaming Prefill）**，即模型在处理巨大上下文后半段时，先生成初步摘要或“思考”。

### 问：一个智能体在短任务上表现正常，但在长时间运行的任务上会退化。你怎么修？

**强答案：**
这是**上下文腐化**：窗口被过时的工具输出填满，模型丢失了主线。我会采用智能体式上下文工程。第一，**压缩**：在达到阈值时总结历史，并基于摘要加上最近的产物继续。第二，**即时加载**：保留文件路径和 ID，而不是完整内容，并按需获取。第三，**结构化记笔记**：让智能体把进展写到一个可重读的临时文件里，这样工作记忆就能保持很小。对于会产生大量中间细节的子任务（深度搜索、多文件分析），我会使用**子智能体隔离**，让细节以短摘要返回，而不是淹没主窗口。目标是每一轮保留最小的高信号 token 集合，而不是最大的集合。

---

## 参考资料
- Liu 等人，“Lost in the Middle”（2023/2024 更新）
- [Anthropic. “面向 AI 智能体的有效上下文工程” (2025)](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Anthropic. “面向长时运行智能体的有效框架” (2026)](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Anthropic. “扩展思考：技术指南”：https://docs.anthropic.com/
- OpenAI. “o3 和 o3-mini 系统卡” (2025)

---

*下一篇：[结构化生成](06-structured-generation.md)*
