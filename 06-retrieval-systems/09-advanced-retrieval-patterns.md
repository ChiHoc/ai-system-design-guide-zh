# 高级检索模式

除了基础能力之外，生产级 RAG（检索增强生成，Retrieval-Augmented Generation）系统会使用专门的模式来处理复杂的查询-文档差距。这些模式是高精度搜索的“秘诀”，并且正越来越多地被集成到托管式 RAG 方案中。

## 目录

- [查询分解（多查询）](#查询分解-multi-query)
- [假设文档嵌入（HyDE）](#假设文档嵌入-hypothetical-document-embeddings-hyde)
- [上下文检索（Anthropic 模式）](#上下文检索-the-anthropic-pattern)
- [迭代式文档增强](#迭代式文档增强)
- [上下文内重排序](#上下文内重排序)
- [面试题](#面试题)
- [参考文献](#参考文献)

---

## 查询分解（Multi-Query）

复杂的用户查询通常是“复合查询（Compound Queries）”。
- **用户**: "Compare our Q3 vs Q4 revenue and explain the drop."
- **分解**：
  1. "Q3 Revenue"
  2. "Q4 Revenue"
  3. "Reasons for Q4 revenue variance"
- **实现**：使用 LLM（大语言模型，Large Language Model）生成这 3 个子查询，检索数据库中所有子查询的结果，并聚合上下文。

---

## 假设文档嵌入（Hypothetical Document Embeddings, HyDE）

查询通常很短，而文档通常很长。这种“非对称性（Asymmetry）”会导致检索失败。
- **模式**：
  1. 取用户查询。
  2. 让 LLM 生成：“Write a 1-paragraph hypothetical answer to this.”（为此写一段一段落的假设性回答。）
  3. **对假设性回答做 Embedding（向量化）**，而不是对查询本身做 Embedding。
- **为什么？**：假设性回答与真实文档位于相同的“向量邻域（Vector neighborhood）”中，从而显著提高召回率。

---

## 上下文检索（The Anthropic Pattern）

由 Anthropic 于 2024 年末标准化的这一模式解决了 **Context Dilution（上下文稀释）** 问题。

- **问题**：某个 chunk 可能写着 “It costs $200,”，但没有标题时，我们不知道 “It” 指的是 “Widget-X”。
- **模式**：在摄取（Ingestion）阶段，对每个 300-token 的 chunk，让 LLM 写一个 50-token 的上下文字符串（例如：“This chunk is about the pricing for Widget-X in the North American market”）。
- **收益**：对于碎片化数据，检索精度可提高 30-50%。

---

## 迭代式文档增强

我们不只是存储原始文档，还会存储“增强后的”元数据（meta-data）。
- **摘要**：存储文档的一段摘要。
- **问答生成**：生成这份文档能回答的 5 个问题，并将这些问题与文档一起做 Embedding。
- **状态**：目前大多数高端 RAG 系统现在嵌入的是**“Questions（问题）”**而不是**“Answers（答案）”**，以匹配用户的查询意图。

---

## 上下文内重排序

随着 1M-2M 上下文窗口现在已成标准（Claude Sonnet 4.6，Gemini 3.1 Pro），**按上下文排序（Rank-by-Context）**是一种可行模式。
1. 检索前 100 篇文档。
2. 将这 100 篇全部放入上下文窗口。
3. 让模型：“Read these 100 docs and identify the 5 most relevant. Then, use those 5 to answer.”（阅读这 100 篇文档并找出最相关的 5 篇。然后用这 5 篇回答。）
- **优势**：这利用了模型的**长上下文推理（Long Context Reasoning）**能力，无需单独的 Cross-Encoder（交叉编码器）模型即可执行重排序。

---

## 面试题

### Q: 为什么 HyDE（假设文档嵌入，Hypothetical Document Embeddings）在某些应用中有风险？

**标准答案：**
HyDE 依赖于先“幻觉”出一个基线答案来查找真实数据。如果用户查询描述的是不存在或逻辑上不可能的内容，LLM 仍然会生成一个假设答案。这可能会把数据库中“错误但语义相近”的数据拉进来，从而强化模型的初始幻觉。标准缓解方案是 **混合方法（Hybrid approach）**：用真实查询（Keyword）检索一次，再用 HyDE 查询检索一次，然后使用 **RRF（Reciprocal Rank Fusion，倒数排名融合）** 将它们合并。

### Q: 什么是 “Asymmetric Retrieval”（非对称检索）问题？

**标准答案：**
非对称检索指的是，用户查询通常很短（3-10 个词），而文档块通常很长（300-500 个词）。它们在向量空间中处于不同的统计分布，导致“距离偏差（Distance Bias）”。高性能系统通过 **Asymmetric Encoders（非对称编码器）**（一个模型用于查询，一个模型用于文档）或 **Query Expansion（查询扩展）**（HyDE）来把查询“扩展”成更接近文档的分布。

---

## 参考文献
- Gao et al. "Precise Zero-Shot Dense Retrieval without Relevance Labels" (HyDE, 2023/2024)
- Anthropic. "The Contextual Retrieval Playbook" (2024)
- LlamaIndex. "Query Transformation Cookbook" (2025)

---

*下一篇: [Agentic Systems](../07-agentic-systems/01-agent-fundamentals.md)*
