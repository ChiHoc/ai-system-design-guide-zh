# 分块策略（Chunking）

Chunking（分块）是将文档拆分为离散片段以便检索的过程。生产级流水线已从盲目的固定大小切分，转向 **结构感知（structure-aware）和语义分块（semantic chunks）**，而 late chunking（后置分块）和 contextual prepending（上下文前置）等新技术如今也已成为主流工具集的一部分。

## 目录

- [检索-上下文张力（The Retrieval-Context Tension）](#检索-上下文张力-the-retrieval-context-tension)
- [递归结构切分（Recursive Structure Splitting）](#递归结构切分-recursive-structure-splitting)
- [语义分块（Semantic Chunking）](#语义分块-semantic-chunking)
- [分层（父子）分块（Hierarchical (Parent-Child) Chunking）](#分层-父子-分块-hierarchical-parent-child-chunking)
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

**细节**：生产流水线越来越多地使用 **Cross-Encoder Segmenters（交叉编码器分段器）**。一个小型模型扫描文本，并在每个语义断点处预测一个“Separator token”（分隔符标记）。这比基于余弦相似度阈值的切分（cosine-similarity thresholding）准确 10 倍。

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

## 内容特定策略（Content-Specific Strategies）

### 1. Code Chunking
- **策略**：使用 AST（Abstract Syntax Tree，抽象语法树）解析。
- **规则**：绝不要在函数体中间切分。将 imports 和 class declarations 与其方法保留在一起。

### 2. Table Chunking
- **策略**：使用 Markdown 格式化表格。
- **现代模式**：“Summarized Tables”（摘要表）。在向量数据库中存储表格的自然语言摘要，但向 LLM 返回完整的 Markdown 表格。

### 3. PDF/Layout Chunking
- **策略**：使用 **Vision-Language Model (VLM，视觉-语言模型)** 进行预处理（例如 ColPali）。
- **细节**：与其只存文本，不如存储表示页面 *positional layout*（位置布局）的 embedding，确保图表和侧边栏不会被混入正文。

---

## 面试题（Interview Questions）

### Q: 为什么带 overlap（重叠）的固定大小分块在生产系统中有问题？

**强答案：**
固定大小分块是“content-blind”（内容盲）的。它经常把句子切到一半，打断数学公式，并将标题与其说明文本分离。虽然“Overlap”（例如 10%）通过在分块之间复制 10% 的文本可以缓解这一点，但它没有解决核心问题：模型的 attention（注意力）仍被迫从碎片化字符串中重建语义。现代流水线更偏好 **Semantic 或 Logical Chunking（语义或逻辑分块）**，因为它能确保每个向量代表一个“Complete Semantic Unit”（完整语义单元），从而显著提高检索精度。

### Q: 什么是“Contextual Retrieval”（Anthropic 模式）？

**强答案：**
Contextual Retrieval（上下文检索）是在 embedding 之前，为每个分块前置一个 1 句的全局上下文。例如，如果某个分块讲的是“battery life”（电池续航），但它来自一本“2025 Model X Drone”（2025 年 Model X 无人机）手册，那么会向该分块添加文本 `[Drone_Model_X_Manual]:`。这可以确保“battery life”的向量受到“Drone”上下文的影响，避免它被错误检索到“phone battery”（手机电池）查询中。

---

## 参考资料（References）
- Anthropic. "Contextual Retrieval: Improving RAG Accuracy" (2024)
- LlamaIndex. "Advanced Chunking Strategies for RAG" (2025)
- LangChain. "RecursiveCharacterTextSplitter Benchmarks" (2024)

---

*Next: [Embedding Models](03-embedding-models.md)*
