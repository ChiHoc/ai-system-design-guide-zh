# 嵌入模型（Embedding Models）

Embedding（嵌入）模型将文本转换为高维向量。前沿已经从静态的单向量表示（single-vector representation）推进到**多分辨率（multi-resolution）、晚交互（late-interaction）和多模态（multimodal）**嵌入；2026 年又出现了**共享嵌入空间**，使索引和查询可以使用不同模型。

## 目录（Table of Contents）

- [嵌入前沿：Matryoshka 嵌入](#嵌入前沿-matryoshka-嵌入-the-embedding-frontier-matryoshka-embeddings)
- [晚交互：ColBERT v2](#晚交互-late-interaction-colbert-v2)
- [二进制与 Int8 量化](#二进制与-int8-量化-binary-and-int8-quantization)
- [模型选择标准](#模型选择标准-model-selection-criteria)
- [共享与非对称嵌入空间](#共享与非对称嵌入空间)
- [多模态嵌入](#多模态嵌入-multimodal-embeddings)
- [面试题](#面试题-interview-questions)
- [参考资料](#参考资料-references)

---

## 嵌入前沿：Matryoshka 嵌入（The Embedding Frontier: Matryoshka Embeddings）

传统上，如果你将文本嵌入到 1,536 维，就必须在搜索中使用全部 1,536 维。

**Matryoshka Representation Learning（MRL，套娃表征学习）**
- 模型被训练为将最重要的信息“存储”在前几个维度中。
- **优势（The Win）**：你可以用 1,536 维进行嵌入，但在“快速检索”阶段只索引较短的维度前缀（64 至 256 维），然后用完整的 1,536 维对 top 结果进行精排。
- **效率（Efficiency）**：首轮索引可缩小一个数量级。召回率损失取决于模型和截断位置（OpenAI 报告称，将 text-embedding-3-large 截至 256 维仍胜过 1,536 维的 ada-002），因此选定前缀长度前须用自己的查询测量。

目前多数 API 模型都经过 Matryoshka 训练：Cohere Embed 5（256 至 2,048 维）、voyage-code-4（256 至 2,048 维）、gemini-embedding-2（128 至 3,072 维），以及通过 `dimensions` 参数控制的 OpenAI text-embedding-3。

---

## 晚交互（Late Interaction）：ColBERT v2

标准嵌入是“Bi-Encoders（双编码器）”（每个 chunk 一个向量）。**ColBERT（Contextualized Late Interaction over BERT，基于 BERT 的上下文晚交互）**采用“token-level（token 级）”方法。

- **方式**：ColBERT 不再为每个 chunk 只存 1 个向量，而是为每个 token 存 1 个向量。
- **交互**：在查询时，模型会比较查询中的每个 token 与文档中的每个 token（即 “MaxSim” 操作）。
- **现状**：ColBERT v2（以及 ColPali、ColQwen2.5、ColNomic 等用于文档和 page-as-images（页面即图像）的后继模型）已通过 PLAID 索引实现大幅压缩，使其可用于生产环境。它在“needle in a haystack（大海捞针）”式技术查询中能取得更高精度。
- **2026 年的服务路径**：通用引擎如今可直接索引多向量数据，通常借助固定维度的 MUVERA 编码：Milvus 3.0（EmbList 加 DiskANN，2026 年 7 月），以及 Weaviate（面向多向量集合的 MUVERA，并在 1.40 候选版扩展至磁盘支持的 HFresh 索引，尚未正式发布）。尝试晚交互已无需专用 ColBERT 服务端。参见[晚交互与 ColBERT](11-late-interaction-colbert.md)。

---

## 二进制与 Int8 量化（Binary and Int8 Quantization）

存储 `float32` 向量成本很高。生产级索引大量依赖**量化**，既可以由模型输出，也可以由数据库执行。

- **Binary Embeddings（二进制嵌入）**：将向量转换为 1 和 0。 
  - **Memory（内存）**：减少 32 倍。
  - **Speed（速度）**：在现代 CPU 上，Hamming distance（汉明距离）的 XOR 运算比 Cosine similarity（余弦相似度）快 10 倍。
- **模型直接输出 Int8 和二进制向量**：Cohere Embed 5（float、int8、binary）、voyage-code-4（float32、int8、uint8、binary）和 Perplexity 的 pplx-embed-v2 预览版（原生 int8）直接返回面向量化用途设计的向量，而非事后四舍五入。OpenAI 的 text-embedding-3 模型只返回浮点数，须在数据库中量化。
- **数据库中的低位量化**：Qdrant TurboQuant 和 Turbo4，以及 Weaviate 4-bit Rotational Quantization，先做随机或 Hadamard 旋转，再做标量量化；两者均于 2026 年作为可选项或预览功能推出，并非默认设置。Elasticsearch 的 BBQ 系列是例外：每维约存储 1 bit；从 9.4 开始，在许可证包含该功能时，DiskBBQ（`bbq_disk`）成为浮点向量的默认索引类型。原理和 RAM 计算见[向量数据库](04-vector-databases.md#低位和基于旋转的量化)。

---

## 模型选择标准（Model Selection Criteria）

| Model | Provider | Features | Context |
|-------|----------|----------|---------|
| **gemini-embedding-2** | Google | 原生多模态：文本、最多 6 张图像、最长 120 s 视频、音频、最多 6 页的 PDF，以及交错输入；128 至 3,072 维。自 2026 年 4 月起为稳定版；取代纯文本 gemini-embedding-001（将于 2028 年 5 月 14 日关闭） | 8,192 文本 token |
| **Cohere Embed 5**（`embed-v5.0-pro` / `-fast`） | Cohere | 2026 年 9 月 30 日发布。支持文本、图像和融合的文本+图像；Pro 与 Fast 共享同一空间；float/int8/binary；每 1M 文本 token 为 $0.12 / $0.08 | 128K |
| **Voyage 4**（`voyage-4-large` / `voyage-4` / `voyage-4-lite`） | Voyage AI（MongoDB） | 2026 年 1 月 15 日发布。不同规模模型共享同一空间；每 1M 为 $0.12 / $0.06 / $0.02；另有开放权重的 `voyage-4-nano` | 32K |
| **voyage-code-4** | Voyage AI | 2026 年 8 月 13 日发布。用从拉取请求中挖掘的自然语言到代码配对训练，适用于从 bug 症状出发搜索的智能体；每 1M 为 $0.12 | 32K |
| **voyage-multimodal-3.5** | Voyage AI | 2026 年 1 月 15 日发布。支持交错的文本、图像和视频；256 至 2,048 维；可输出 float、int8 和 binary | 32K |
| **Nemotron 3 Embed 8B / 1B** | NVIDIA（开放权重，OpenMDW-1.1） | 2026 年 7 月 16 日发布。8B：可截取的 4,096 维，RTEB 多语言榜以 78.5 排名第 1（供应商自报）；1B：2,048 维，另有 NVFP4 变体 | 32,768（8B） |
| **Qwen3-Embedding-8B** | 开放权重 | 指令微调、擅长长文档；MTEB 多语言平均分 70.58，但榜首地位已有争议 | 32K |
| **Llama-Embed-Nemotron-8B** | NVIDIA | 2025 年 10 月发布。多语言表现强、4,096 维；权重仅许可非商业及研究用途 | 32K |
| **Cohere Embed v4** | Cohere | 多模态（文本 + 图像）、Matryoshka、二进制量化；仍可使用，尚未宣布弃用 | 128k |
| **OpenAI text-embedding-3-large** | OpenAI | 通过 `dimensions` 使用 Matryoshka，3,072 维，每 1M 为 $0.13，只输出浮点数。OpenAI 尚未发布更新的嵌入模型，也不存在“text-embedding-4” | 8,192 |
| **BGE-M3** | Open Source | Multilingual, multi-granularity（dense + sparse + late-interaction） | 8k |
| **Jina-Embeddings-v3** | Jina AI | 面向任务的 LoRA 适配器、Matryoshka；晚交互需搭配 Jina ColBERT 模型 | 8k |

开放权重模型（Nemotron 3 Embed、Qwen3、BGE）如今在公开基准上已与商业 API 持平甚至更高。若你更看重托管基础设施和 SLA，就选商业模型；若在高吞吐量下单次查询成本比延迟下限更重要，就选开放权重模型。

**如何解读排行榜：**
- **优先看 RTEB，而非只看 MTEB 排名。**RTEB（MTEB 团队，2025 年 10 月）混合公开数据集与由维护者评估的私有留出集，以防模型在测试集上训练。MTEB 多语言榜首多次易手（公开宣称的排名中先后有 Qwen3-Embedding-8B、llama-embed-nemotron-8b、KaLM-Embedding-Gemma3-12B），因此应查询实时榜单，而非引用固定的领先者。
- **不要用 LLM 取代嵌入模型。**《The Embedder's Dilemma》（arXiv 2608.12875，2026 年 8 月）在 37 项 MTEB 风格任务上比较了 10 个 LLM 和 26 个嵌入模型。总体成绩相近（最佳 LLM 为 77.6，最佳嵌入模型为 77.2），但每轮基准测试成本最高相差 1,431 倍；在同一 GPU 上，开放权重 LLM 的运行速度慢 2.5 至 736 倍。LLM 在推理密集型检索上领先，嵌入模型在分类上领先。这说明 LLM 更适合困难查询的后期重排序，而非首轮检索。
- **智能体代码搜索是独立类别。**智能体查询更像模糊的 bug 报告，而不是标识符。Voyage 报告称，在由留出仓库构成的 19 项智能体代码检索基准上，voyage-code-4 比 voyage-code-3 高 +27.54%（供应商自报；独立 RTEB 结果尚未公布）。

---

## 共享与非对称嵌入空间

以往的规则是“换嵌入模型就得重建整个索引”。2026 年出现了两种例外：

- **同一共享空间中的模型家族。**Voyage 4 家族和 Cohere Embed 5 Pro/Fast 经过训练，其向量可以互换。用大型模型为语料库建一次索引（获得更好的文档表示），再用小型模型处理查询（降低查询延迟和费用）；也可在不同大小模型间转移查询流量，无需改动索引。
- **可替换的查询编码器。**Qdrant 的 Constella 研究预览版（2026 年 9 月 29 日）固定使用 Stella（400M）文档索引，替换查询编码器。Constella Nano（34.5M 参数）在 CPU 延迟降低 12 倍（3.1 ms 对 39.0 ms）时，仍保留 Stella 在 BEIR-15 nDCG@10 上约 91% 的成绩（0.5081 对 0.5614）；不使用 Transformer、仅做 token 查表的 Constella Zero 在 0.081 ms 下得分 0.4572（供应商自报的研究预览结果）。

限制在于：共享空间由供应商定义。不能用 Voyage 索引搭配 Cohere 查询编码器；预览模型（pplx-embed-v2-context-9b-preview）还明确警告其向量与后续版本不兼容。

---

## 多模态嵌入（Multimodal Embeddings）

仅文本的 RAG 会悄悄丢弃图表、表格、示意图和版式信号，而这些往往正是答案所在。现代栈会把页面、截图和图像作为一等检索对象：

- **统一视觉-文本嵌入**：Cohere Embed 5、voyage-multimodal-3.5 和 gemini-embedding-2 各自将图像与文本映射到同一向量空间，因此可以针对示意图查询“紧急切断阀在哪里？”。Cohere 报告称，在 ViDoRe V3 上，Embed 5 Pro 得分 85.8、Fast 得分 84.5、voyage-4-large 为 83.7、Gemini Embedding 2 为 83.2、text-embedding-3-large 为 75.5（供应商自报）。voyage-multimodal-3.5 和 gemini-embedding-2 还可在同一空间处理视频，后者也支持音频。
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

### 问：你需要升级一个 5 亿向量索引背后的嵌入模型，如何实现无停机迁移？

**强答案：**
首先判断是否真的必须重新嵌入全部数据：
1. **同一共享空间家族**（Voyage 4 的不同规模、Cohere Embed 5 Pro 和 Fast）：无需重建索引。将查询流量切换到新规模并进行 A/B 测试。
2. **不同模型**：必须全部重新嵌入。按 5 亿个约 500 token 的文本块计算，共计 250B token；按每 1M 为 $0.12 计，批量折扣前约需 $30,000，此外还有索引写入负载。应将其当作迁移项目来预算，而非配置变更。

重新嵌入时，我会依次执行**双写、回填、影子读取、切换**：新写入同时进入两个向量字段；后台作业从最旧数据开始回填新字段；影子路径查询新字段，并用黄金测试集记录 recall@k；当新字段与旧字段持平或更好时，再逐租户切换流量。如今的引擎让这更容易：Milvus 3.0 可在线添加和回填列，因此新嵌入只需作为另一字段。回滚窗口关闭前保留旧字段。

如果由数据库负责嵌入（MongoDB Atlas Automated Embedding、turbopuffer 原生嵌入、Elasticsearch `semantic_text`），我虽可省去同步流水线，但模型版本转由供应商控制；采用前会先确认它们在模型变更时如何处理重新嵌入。

---

## 参考资料（References）
- Kusupati et al. "Matryoshka Representation Learning"（2022/2024 更新）
- Khattab 与 Zaharia. "ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction over BERT"（2020）；Santhanam 等人. "ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction"（2022）
- OpenAI. "New embedding models and API updates"（2024 年 1 月）
- [Google. Gemini Embedding 2 模型页面](https://ai.google.dev/gemini-api/docs/models/gemini-embedding-2)
- [Cohere. "Embed 5"（2026 年 9 月）](https://cohere.com/blog/embed-5)
- [Voyage AI. "voyage-4"（2026 年 1 月）](https://blog.voyageai.com/2026/01/15/voyage-4/) 与 ["voyage-code-4"（2026 年 8 月）](https://blog.voyageai.com/2026/08/13/voyage-code-4/)
- [NVIDIA. Nemotron 3 Embed 8B 模型卡](https://huggingface.co/nvidia/Nemotron-3-Embed-8B-BF16)
- ["The Embedder's Dilemma"（arXiv 2608.12875，2026 年 8 月）](https://arxiv.org/abs/2608.12875)

---

*上一篇：[分块策略](02-chunking-strategies.md) | 下一篇：[向量数据库](04-vector-databases.md)*
