# 分块策略（Chunking）

Chunking（分块）是将文档拆分为离散片段以便检索的过程。生产级流水线已从盲目的固定大小切分，转向 **结构感知（structure-aware）和语义分块（semantic chunks）**，而 late chunking（后置分块）和 contextual prepending（上下文前置）等新技术如今也已成为主流工具集的一部分。

## 目录

- [检索-上下文张力（The Retrieval-Context Tension）](#检索-上下文张力-the-retrieval-context-tension)
- [递归结构切分（Recursive Structure Splitting）](#递归结构切分-recursive-structure-splitting)
- [语义分块（Semantic Chunking）](#语义分块-semantic-chunking)
- [分层（父子）分块（Hierarchical (Parent-Child) Chunking）](#分层-父子-分块-hierarchical-parent-child-chunking)
- [后置分块与上下文化文本块嵌入](#后置分块与上下文化文本块嵌入)
- [内容特定策略（Code, PDF, Tables）](#内容特定策略-content-specific-strategies)
- [面试题（Interview Questions）](#面试题-interview-questions)
- [参考资料（References）](#参考资料-references)

---

## 检索-上下文张力（The Retrieval-Context Tension）

| 维度 | 小分块（Small Chunks，100t） | 大分块（Large Chunks，1000t） |
|--------|---------------------|----------------------|
| **精度**（Precision） | 高（Exact match，精确匹配） | 低（Diluted，稀释） |
| **上下文**（Context） | 差（Broken sentences，句子被截断） | 丰富（Surrounding info，周边信息） |
| **存储**（Storage） | 高（更多向量） | 低（更少向量） |
| **延迟**（Latency） | 低（搜索更快） | 高（检索开销更大） |

**规则**：更小的分块更适合用于*查找*（finding），而更大的分块更适合用于*思考*（thinking）。使用**分层分块（Hierarchical Chunking）**可以兼得两者。

---

## 递归结构切分（Recursive Structure Splitting）

与其每 500 个字符就切一刀，不如在逻辑边界处分割：
`[Double Newline] > [Single Newline] > [Period] > [Space]`。

**最佳实践**：使用 **Markdown-Aware Splitting（Markdown 感知切分）**。如果文档有 `#` 标题，请确保将该标题预先前置到*每个*子分块中，以保留上下文（Contextual Chunking，上下文感知分块）。

---

## 语义分块（Semantic Chunking）

语义分块（Semantic Chunking）使用 embedding model（嵌入模型）来检测“主题转移”（topic shifts）。

1. 将文本拆分为单独句子。
2. 只要句子之间的 embedding similarity（向量相似度）高于阈值（例如 0.82），就将它们归为同一块。
3. 一旦相似度下降，就开始一个新的分块。

**细节**：有些流水线用**学习型分段器**替代阈值：小型模型扫描文本，预测每个语义断点的分隔位置。这样就不必针对每套语料库手工调整余弦相似度阈值，但已发表的分块基准对固定大小、递归和语义策略给出的结果差异很大，因此在承担额外模型成本前，应先在自己的文档上测量召回率。

---

## 分层（父子）分块（Hierarchical (Parent-Child) Chunking）

这是生产级 RAG 的行业标准。

- **流程**：
  1. 创建 1,500 tokens 的“Parent”（父分块）。
  2. 将每个父分块再细分为 5 个 300 tokens 的“Child”（子分块）。
  3. **仅索引子分块**。
  4. 检索时，如果某个子分块命中，则向 LLM 返回完整的父上下文。
- **为什么？**：子分块更小，更容易被向量数据库匹配；父分块则为 LLM 提供足够上下文，使其能够正确推理，而不会出现“Broken Context”（上下文碎片化）幻觉。

---

## 后置分块与上下文化文本块嵌入

分层分块在*读取*时补足上下文。另一种方案是在*嵌入*时补足，使每个文本块向量预先知道自己来自哪份文档。

- **后置分块**（Jina，2024）：先用长上下文嵌入模型处理整篇文档，再按文本块的跨度汇集 token 嵌入。每个块的向量都以完整文档为条件，无需额外的 LLM 调用。
- **上下文化文本块嵌入模型**将这一过程封装为 API。**voyage-context-4**（2026 年 6 月 29 日正式发布；每 1M token 为 $0.12，32K 窗口，内建自动分块）为每块返回一个感知整篇文档的向量；Voyage 报告称，相比 voyage-context-3，文本块级检索提升 +2.08%，文档级提升 +1.4%（供应商自报）。Perplexity 的 **pplx-embed-v2-context-9b-preview**（2026 年 9 月 25 日）会一起编码文档中的文本块，但它明确属于预览版，生成的向量不能与后续版本混用。

与 Anthropic 式上下文前缀相比，嵌入模型侧的上下文无需为每块调用 LLM，却只能改善稠密检索。BM25 仍只看到原始块文本，因此稀疏索引仍应给每块前置标题。完整的成本比较见[上下文检索](10-contextual-retrieval.md)。

---

## 内容特定策略（Content-Specific Strategies）

### 1. Code Chunking
- **策略**：使用 AST（Abstract Syntax Tree，抽象语法树）解析。
- **规则**：绝不要在函数体中间切分。将 imports 和 class declarations 与其方法保留在一起。

### 2. Table Chunking
- **策略**：使用 Markdown 格式化表格。
- **现代模式**：“Summarized Tables”（摘要表）。在向量数据库中存储表格的自然语言摘要，但向 LLM 返回完整的 Markdown 表格。

### 3. PDF/Layout Chunking
- **策略 A，解析后分块**：使用感知布局的解析器（Docling、MinerU、Cohere Parse 或开源解析 VLM），按阅读顺序输出块，将表格、图形和侧边栏作为不同类型的元素。在这些块的边界处分块，使图表和侧边栏不会混入正文。
- **策略 B，跳过文本分块**：使用后期交互模型（ColPali 系列）直接嵌入每页图像。页面*本身*就是单位，因此布局得以保留。参见[多模态 RAG](12-multimodal-rag.md)。
- **面向智能体的模式**：对于智能体式 RAG，可以考虑给智能体稳定的块定位符，而非预先切好的文本块。MinerU 4.0（2026 年 9 月 16 日）返回形如 `doc:{id}/tier:{tier}/page:{page}/block:{block}` 的定位符，并渐进式读取长文档（先读前 10 页，再继续），让智能体自行浏览文档，引用也能指向可核验的块。

---

## 面试题（Interview Questions）

### Q: 为什么带 overlap（重叠）的固定大小分块在生产系统中有问题？

**强答案：**
固定大小分块是“content-blind”（内容盲）的。它经常把句子切到一半，打断数学公式，并将标题与其说明文本分离。虽然“Overlap”（例如 10%）通过在分块之间复制 10% 的文本可以缓解这一点，但它没有解决核心问题：模型的 attention（注意力）仍被迫从碎片化字符串中重建语义。现代流水线更偏好 **Semantic 或 Logical Chunking（语义或逻辑分块）**，因为它能确保每个向量代表一个“Complete Semantic Unit”（完整语义单元），从而显著提高检索精度。

### Q: 什么是“Contextual Retrieval”（Anthropic 模式）？

**强答案：**
Contextual Retrieval（上下文检索）是在嵌入和 BM25 索引前，为每个文本块前置由 LLM 撰写的简短上下文。例如，如果某块讲的是“battery life”（电池续航），但来自“2025 Model X Drone”（2025 年 Model X 无人机）手册，可以在块前加入 `This chunk is from the Model X drone manual, battery section:`。这样“battery life”的向量就会受到“Drone”上下文影响，不易在查询“phone battery”（手机电池）时误命中。Anthropic 测得，仅使用上下文化嵌入，top-20 检索失败率降低 35%；再加入上下文化 BM25 后降低 49%；进一步重排序后降低 67%。

代价是在摄取时为每个文本块调用一次 LLM（可通过缓存源文档提示词降低费用）。2026 年的替代方案是 voyage-context-4 等上下文化文本块嵌入模型，无需 LLM 调用即可生成感知文档的向量，但不能改善 BM25。我的默认方案是：为两类索引都前置标题；稠密索引使用嵌入模型侧上下文；仅对黄金测试集上仍表现不佳的文档类型使用 LLM 上下文化。

---

## 参考资料（References）
- [Anthropic.《Introducing Contextual Retrieval》（2024 年 9 月）](https://www.anthropic.com/news/contextual-retrieval)
- [Günther 等人，《Late Chunking: Contextual Chunk Embeddings Using Long-Context Embedding Models》（2024）](https://arxiv.org/abs/2409.04701)
- [Voyage AI.《voyage-context-4》（2026 年 6 月）](https://blog.voyageai.com/2026/06/29/voyage-context-4/)
- [MinerU 4.0 发布说明（2026 年 9 月）](https://github.com/opendatalab/MinerU/releases/tag/mineru-4.0.0-released)
- [Smith 与 Troynikov，《Evaluating Chunking Strategies for Retrieval》（Chroma，2024 年 7 月）](https://www.trychroma.com/research/evaluating-chunking)
- [LangChain.《Text splitter integrations》（文档）](https://docs.langchain.com/oss/python/integrations/splitters)
- [LlamaIndex.《Node Parser Modules》（文档，语义与分层解析器）](https://developers.llamaindex.ai/python/framework/module_guides/loading/node_parsers/modules/)

---

*上一篇：[RAG 基础知识](01-rag-fundamentals.md) | 下一篇：[嵌入模型](03-embedding-models.md)*
