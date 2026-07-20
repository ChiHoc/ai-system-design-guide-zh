# 嵌入模型（Embedding Models）

Embedding（嵌入）模型将文本转换为高维向量。前沿已经从静态的单向量表示（single-vector representation）推进到**多分辨率（multi-resolution）、晚交互（late-interaction）和多模态（multimodal）**嵌入。

## 目录（Table of Contents）

- [The Embedding Frontier (Matryoshka)]( #matryoshka)
- [Late Interaction (ColBERT v2)]( #late-interaction)
- [Binary and Int8 Quantization]( #quantization)
- [Model Selection Criteria]( #selection)
- [Multimodal Embeddings (Vision + Text)]( #multimodal)
- [Interview Questions]( #interview-questions)
- [References]( #references)

---

## 嵌入前沿：Matryoshka 嵌入（The Embedding Frontier: Matryoshka Embeddings）

传统上，如果你将文本嵌入到 1,536 维，就必须在搜索中使用全部 1,536 维。

**Matryoshka Representation Learning（MRL，套娃表征学习）**
- 模型被训练为将最重要的信息“存储”在前几个维度中。
- **优势（The Win）**：你可以用 1,536 维进行嵌入，但在“快速检索”阶段只索引前 **64 维**，然后用完整的 1,536 维对 top 结果进行精排。
- **效率（Efficiency）**：内存/索引大小减少 20 倍，准确率下降小于 2%。

---

## 晚交互（Late Interaction）：ColBERT v2

标准嵌入是“Bi-Encoders（双编码器）”（每个 chunk 一个向量）。**ColBERT（Contextualized Late Interaction over BERT，基于 BERT 的上下文晚交互）**采用“token-level（token 级）”方法。

- **方式**：ColBERT 不再为每个 chunk 只存 1 个向量，而是为每个 token 存 1 个向量。
- **交互**：在查询时，模型会比较查询中的每个 token 与文档中的每个 token（即 “MaxSim” 操作）。
- **现状**：ColBERT v2（以及 ColPali、ColQwen2.5、ColNomic 等用于文档和 page-as-images（页面即图像）的后继模型）已通过 PLAID 索引实现大幅压缩，使其可用于生产环境。它在“needle in a haystack（大海捞针）”式技术查询中能取得更高精度。

---

## 二进制与 Int8 量化（Binary and Int8 Quantization）

存储 `float32` 向量成本很高。生产级索引大量依赖**模型内量化（in-model quantization）**。

- **Binary Embeddings（二进制嵌入）**：将向量转换为 1 和 0。 
  - **Memory（内存）**：减少 32 倍。
  - **Speed（速度）**：在现代 CPU 上，Hamming distance（汉明距离）的 XOR 运算比 Cosine similarity（余弦相似度）快 10 倍。
- **Int8/Int4**：`text-embedding-3-small` 等模型原生支持。

---

## 模型选择标准（Model Selection Criteria）

| Model | Provider | Features | Context |
|-------|----------|----------|---------|
| **Gemini Embedding 001** | Google | Multimodal（text, image, video, audio, PDF）, shared 3072-dim space, MTEB-English leader | 8k |
| **Qwen3-Embedding-8B** | Open Source | MTEB-Multilingual leader, instruction-tuned, long-doc strength | 32k |
| **Llama-Embed-Nemotron-8B** | NVIDIA | Top multilingual scores, open weights | 8k |
| **Cohere Embed v4** | Cohere | Multimodal（text + image）, Matryoshka, binary quantization | 128k |
| **Voyage-Multimodal-3.5** | Voyage AI | Unified text/image, retrieval-tuned | 32k |
| **OpenAI text-embedding-3-large** | OpenAI | Matryoshka, Native Int8, broad support | 8k |
| **BGE-M3** | Open Source | Multilingual, multi-granularity（dense + sparse + late-interaction） | 8k |
| **Jina-Embeddings-v3** | Jina AI | Late-interaction support, long context | 128k |

开源模型（Qwen3、Llama-Embed-Nemotron、BGE）如今在纯 MTEB 分数上已与商业 API 持平甚至更高。若你更看重托管基础设施和 SLA，就选商业模型；若在高吞吐量下单次查询成本比延迟下限更重要，就选开源权重模型。

---

## 多模态嵌入（Multimodal Embeddings）

仅文本的 RAG 会悄悄丢弃图表、表格、示意图和版式信号，而这些往往正是答案所在。现代栈会把页面、截图和图像作为一等检索对象：

- **统一视觉-文本嵌入**：Cohere Embed v4、Voyage-Multimodal-3.5、Gemini Embedding 001 都共享同一个向量空间，因此你可以针对示意图查询“紧急切断阀在哪里？”。
- **Page-as-image with late interaction（页面即图像 + 晚交互）**：ColPali、ColQwen2.5 和 ColNomic 直接对每一页的渲染结果进行嵌入，跳过脆弱的 OCR，并保留视觉层级。
- **CLIP-family models（CLIP 系列模型）**：对于图像占比高的目录类场景（电商、媒体）仍然有用，因为文本-图像对齐（text-image alignment）是核心信号。

---

## 面试题（Interview Questions）

### 问：嵌入中的“Vocabulary Mismatch（词汇不匹配）”问题是什么？

**强答案：**
Embedding 依赖训练时学到的语义空间。如果用户查询使用了一个更新的术语（例如某个在嵌入模型训练截止时间之后发布的模型名），而它不在嵌入模型的训练集里，模型可能会把它映射成一个泛化的“AI”向量，从而遗漏具体细微差别。标准修复方式是**Hybrid Search（混合检索）**（用 BM25 捕获具体关键词）加上**Cross-Encoder Reranking（交叉编码器重排序）**，后者通过同时查看 query 和 document tokens 更好地处理分布外词汇（out-of-distribution vocabulary）。

### 问：为什么在 10 亿向量索引中会选择 Matryoshka 模型？

**强答案：**
将标准 `float32` 1536 维嵌入扩展到 10 亿向量时，HNSW（Hierarchical Navigable Small World）索引大约需要 6TB 高速 RAM，这种成本高得不切实际。使用 Matryoshka 模型时，我可以在初始召回阶段只用前 128 维（进行二值量化）。这会让内存占用降低 90% 以上，使得“Top 1,000”候选可以在更便宜的硬件上被找到。然后我只需为这 1,000 个候选取回完整分辨率的向量，执行最终重排。

---

## 参考资料（References）
- Kusupati et al. "Matryoshka Representation Learning"（2022/2024 更新）
- Khattab et al. "ColBERT v1 & v2: Efficient Late Interaction"（2021/2023）
- OpenAI. "Introducing New Embedding Models with Matryoshka Support"（2024）

---

*Next: [Vector Databases](04-vector-databases.md)*
