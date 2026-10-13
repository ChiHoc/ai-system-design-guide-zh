# Multi-Modal RAG（多模态 RAG）

Multi-modal RAG 扩展了 retrieval-augmented generation（检索增强生成），使其不再局限于纯文本，而是能够处理图像、表格、图表、音频以及混合版式文档。生产系统现在经常摄入带有图示的 PDF、幻灯片、扫描发票和研究论文，在这些文档里，视觉布局本身就是意义的一部分。当前占主导地位的三种架构是：caption-and-index、统一视觉-文本嵌入（Cohere Embed 5、Voyage-Multimodal-3.5、Gemini Embedding 2）以及 page-as-image with late interaction（页图像化并进行后期交互，如 ColPali、ColQwen2.5、ColNomic）。随着模型能够自行选择观看哪些片段，而不必对每一帧都采样，视频成为最新拥有独立成本模型的模态。

## 目录

- [为什么纯文本 RAG 会失效](#为什么纯文本-rag-会失效)
- [架构模式](#架构模式)
- [多模态嵌入策略](#多模态嵌入策略)
- [用于文档理解的视觉语言模型](#用于文档理解的视觉语言模型)
- [ColPali 与基于视觉的检索](#colpali-与基于视觉的检索)
- [表格抽取与结构化数据检索](#表格抽取与结构化数据检索)
- [图表与示意图理解](#图表与示意图理解)
- [视频：固定采样与智能体处理](#视频-固定采样与智能体处理)
- [生产架构](#生产架构)
- [实现示例](#实现示例)
- [系统设计面试角度](#系统设计面试视角)
- [参考资料](#参考资料-references)

---

## 为什么纯文本 RAG 会失效

传统 RAG 流水线会把文档解析成文本块，生成嵌入，并据此对文本查询进行检索。这在真实世界文档上会失效：

| 文档元素 | 纯文本 RAG 行为 | 实际丢失的信息 |
|-----------------|----------------------|------------------------|
| **柱状图** | 只提取坐标轴标签 | 趋势、比较、量级 |
| **架构图** | 完全漏掉 | 组件关系、数据流 |
| **表格** | 将行扁平化，丢失结构 | 行列关联、表头 |
| **信息图** | 只捕获零散的文本片段 | 视觉层级、空间分组 |
| **带说明的照片** | 得到说明文字，丢失图片 | 视觉证据、空间上下文 |

**现实情况**：企业文档中有 40-60% 的内容是非文本内容。财务报告的价值在于其中的图表。医学论文的关键信息在于其图示。忽略视觉内容，就等于忽略了大部分知识。

---

## 架构模式

多模态 RAG 有三种主流模式，每种都有不同的权衡：

### 模式 1：统一嵌入空间

```
                     Shared Vector Space
                    +-------------------+
  Text  --> Encoder |  [0.2, 0.8, ...] |
  Image --> Encoder |  [0.3, 0.7, ...] |  --> Single Index --> Retrieve
  Table --> Encoder |  [0.1, 0.9, ...] |
                    +-------------------+

  Query "show revenue trends" --> encode --> nearest neighbors across ALL modalities
```

- **做法**：自然图像使用 CLIP 或 SigLIP；文档页面、幻灯片和截图则使用文档级多模态嵌入模型（Cohere Embed 5、Gemini Embedding 2、Voyage Multimodal），将文本和图像投影到同一个向量空间。
- **优点**：单一索引、单次查询、检索逻辑简单。
- **缺点**：不同模态之间的嵌入质量会波动；表格需要序列化。

### 模式 2：按模态检索并融合

```
  Query --> +----> Text Index    --> Top-K text chunks
            |
            +----> Image Index   --> Top-K images
            |
            +----> Table Index   --> Top-K tables
            |
            v
        Fusion / Reranking Layer --> Combined Top-K --> VLM Generator
```

- **做法**：为每种模态分别建立嵌入和索引。使用 reranker（重排序器）或 reciprocal rank fusion（RRF，倒数排名融合）合并结果。
- **优点**：每种模态都能使用同类最优嵌入；可独立调优每个检索器。
- **缺点**：基础设施更复杂；融合逻辑不简单。

### 模式 3：以视觉为先（Page-as-Image）

```
  Document Page --> Screenshot/Render --> Vision Encoder --> Multi-vector Index
                                              |
  Query ---------> Text Encoder --------------+---> Late Interaction Score
                                                    --> Retrieve top pages
```

- **做法**：把每一页文档都视作一张图像。使用 vision-language model（视觉语言模型，例如 ColPali）生成 patch-level embeddings（补丁级嵌入）。通过 late interaction（后期交互，MaxSim）进行打分。
- **优点**：不需要 OCR，不需要版式解析，也不需要表格抽取流水线。可端到端训练。
- **缺点**：索引阶段计算成本更高；损失细粒度文本搜索能力。

**建议**：模式 3（vision-first，先视觉）在文档密集型场景中增长很快。模式 2 在需要精确文本检索并同时保留视觉检索能力时，仍然是生产环境的主力方案。

---

## 多模态嵌入策略

### CLIP（Contrastive Language-Image Pretraining，对比式语言-图像预训练）

最初的 dual-encoder（双编码器），将文本和图像映射到共享的 512/768 维空间。

- **优势**：生态庞大、机制成熟、微调变体众多。
- **劣势**：在文档类图像（图表、表格）上的表现弱于自然照片。对比学习损失（contrastive loss）需要较大的 batch size。

### SigLIP / SigLIP 2

将 CLIP 的 softmax 交叉熵（cross-entropy）替换为 sigmoid loss（sigmoid 损失），使每个图文对都可以独立评估。

- **SigLIP 2 (2025)**：新增 captioning decoders（标题生成解码器）、self-distillation（自蒸馏）和 masked prediction（掩码预测）。在 109 种语言、10B+ 张图像上训练。
- **关键提升**：在小 batch size（4-8k）下优于 CLIP，并提供更稠密、更稳健的特征。
- **生产使用**：挪威国家图书馆（National Library of Norway）、电商视觉搜索、AI 艺术策展。

### RAG 对比

| 模型 | 最适合 | 嵌入维度 | 文档质量 | 自然图像质量 |
|-------|----------|--------------|-----------------|----------------------|
| CLIP ViT-L/14 | 通用场景 | 768 | 中 | 高 |
| SigLIP 2 So400m | 多语言文档 | 1152 | 高 | 高 |
| Nomic Embed Vision | 文本密集型文档 | 768 | 高 | 中 |
| Voyage Multimodal 3.5 | 混合文档；文本、图像和视频 | 256-2048（默认 1024） | 高 | 高 |
| Cohere embed-v5.0-pro / -fast | 视觉信息丰富的企业文档；文本、图像或文本与图像融合输入 | 256-2048（Matryoshka） | 高：ViDoRe V3 85.8 / 84.5（供应商报告） | 未报告 |
| Gemini Embedding 2 | 文本、图像、视频、音频和 PDF 共用一个空间 | 128-3072（推荐 768/1536/3072） | 高：ViDoRe V3 83.2（Cohere 的供应商评测表） | 未报告 |

**2026 年的变化**：如今有两款托管多模态嵌入模型，不再需要单独的图像模型就能实现“统一空间”模式。
- **Gemini Embedding 2**（`gemini-embedding-2`，3 月 10 日发布，2026 年 4 月起稳定）：每次输入支持最多 8,192 个文本 token、6 张图像、120 秒视频、原生音频和最多 6 页 PDF，也支持交错输入。`gemini-embedding-001` 仅支持文本，将于 2028 年 5 月 14 日停止服务；Google 指定 Gemini Embedding 2 为其替代模型。
- **Cohere Embed 5**（2026 年 9 月 30 日）：`embed-v5.0-pro` 每百万文本 token 收费 $0.12，`embed-v5.0-fast` 为 $0.08；图像每百万 token 收费 $0.40；上下文长度为 128K。Pro 与 Fast 共用嵌入空间，因此可用 Pro 建索引、用 Fast 查询，无需重新索引。

Cohere 自己的 ViDoRe V3 评测表给 Embed 5 Pro、Fast、voyage-4-large、Gemini Embedding 2 和 OpenAI text-embedding-3-large 的分数分别为 85.8、84.5、83.7、83.2 和 75.5。前四名相差不到三分，且结果来自供应商评测，不能据此直接选型；应以自己的页面级评估集为准。

### 嵌入策略决策

```
Is your content mostly natural images (photos, products)?
  YES --> CLIP or SigLIP fine-tuned on your domain
  NO
    |
    v
Is your content document pages (PDFs, slides, reports)?
  YES --> Baseline: single-vector multimodal embedder (Embed 5,
          Gemini Embedding 2) + reranker. Move to ColPali / ColQwen
          (multi-vector, no OCR) if page-level recall falls short
  NO
    |
    v
Is it a mix of text, images, and structured data?
  YES --> Modality-specific encoders + fusion (Pattern 2)
          or one hosted multimodal embedder (Embed 5, Gemini Embedding 2)
          if a single index matters more than per-modality tuning

Does it include audio or video clips?
  YES --> Gemini Embedding 2 for retrieval (clips up to 120 s per input),
          plus transcripts in the text index for exact-term search
```

---

## 用于文档理解的视觉语言模型

VLMs（视觉语言模型）在多模态 RAG 中承担两个角色：(1) 作为 **generator**（生成器），从检索到的多模态上下文中合成答案；(2) 作为 **indexing engine**（索引引擎），在摄入阶段提取结构化信息。

### 文档理解的 VLM 选项

前沿模型在图表读取、表格抽取和示意图理解上的能力已经足够接近，针对*你的*文档，排名取决于页面内容构成。真正影响设计选择的是价格、长上下文计费方式和 API 行为：

| | Claude Opus 5.5 / Sonnet 5.5 | GPT-6 Astra / GPT-6 Sol | Gemini 3.8 Flash |
|---|---|---|---|
| **每百万 token 价格（输入 / 输出）** | $4 / $20；$2 / $10 | $10 / $50；$2 / $10 | 推广期 $0.75 / $3.75，2027 年 1 月 1 日起 $1.50 / $7.50 |
| **上下文** | 1M，直至 1M 均按统一价格 | 1.05M；输入超过 272K 时整次请求按长上下文费率计费 | 输入 1,048,576 / 输出 65,536 |
| **结构化输出** | 原生支持（`output_config.format`） | 原生支持 | 原生支持 |
| **注意事项** | 思考模式始终开启（Opus 5.5）或默认开启（Sonnet 5.5）；应读取文本块，而不是 `content[0]` | OpenAI 于 2026 年 9 月 25 日在模型 ID 不变的情况下修复了影响 GPT-6 Sol 和 Luna 图像理解的编码缺陷：修复前的图像评估需重跑 | 推广价于 12 月 31 日结束；预算应按 2027 年标价计算 |

专用文档解析器（Cohere Parse、MinerU、jina-ocr-v1、Nemotron Parse 2.0）如今能以远低于前沿 VLM 的每页成本，输出包含表格、边界框和阅读顺序的 Markdown。大规模抽取时应优先比较这些工具；参见 [OCR 与版式分析](../10-document-processing/01-ocr-and-layout.md)。

### VLM 增强摄入流水线

```
  Raw PDF
    |
    v
  Page Renderer (pdf2image, 300 DPI)
    |
    v
  VLM Extraction Pass:
    +-- "Extract all tables as markdown"
    +-- "Describe this chart: axes, trends, key data points"
    +-- "Summarize the diagram: components and relationships"
    |
    v
  Structured Output (JSON)
    |
    +---> Text chunks     --> Text embedding index
    +---> Table markdown  --> Text embedding index (with metadata: "type=table")
    +---> Chart summaries --> Text embedding index (with metadata: "type=chart")
    +---> Page images     --> Image embedding index (CLIP/SigLIP)
```

这种 “describe-then-embed”（先描述再嵌入）方法会把视觉内容转换为可搜索文本，同时在生成阶段保留原始图像。

---

## ColPali 与基于视觉的检索

ColPali 代表了一种范式转变：不再构建复杂的 OCR + 版式 + 表格抽取流水线，而是将每一页文档当作一张图像，让视觉语言模型处理一切。

### ColPali 的工作方式

```
  Document Page Image
        |
        v
  SigLIP Vision Encoder (So400m)
        |
  Splits image into patches (e.g., 32x32 grid = 1024 patches)
        |
        v
  Gemma 2B Language Model (contextualizes patch embeddings)
        |
        v
  Linear Projection --> 128-dim patch embeddings
        |
  Result: 1024 vectors of dim 128 per page
        |
        v
  Stored in Multi-Vector Index

  At query time:
  Query --> Tokenize --> Embed --> 128-dim token embeddings
        |
        v
  Late Interaction (MaxSim):
    Score = Sum over query tokens of Max similarity to any patch
```

### ColPali 与传统流水线对比

| 方面 | 传统流水线 | ColPali |
|--------|---------------------|---------|
| **OCR** | 需要（如 Tesseract、Azure OCR） | 不需要 |
| **版式检测** | 需要（如 Detectron2、LayoutLM） | 不需要 |
| **表格解析器** | 需要（如 Camelot、Tabula） | 不需要 |
| **图表抽取器** | 需要（如 ChartOCR） | 不需要 |
| **索引速度** | 慢（多阶段） | 快（单次前向传播） |
| **检索质量** | 文本上高、视觉上差 | 各模态都高 |
| **存储** | 文本索引（较小） | 多向量索引（较大） |

### ColPali 家族

- **ColPali (v1)**：PaliGemma-3B 主干，原始版本。
- **ColQwen2 / ColQwen2.5**：分别采用 Qwen2-VL 和 Qwen2.5-VL 主干。多语言支持更好，在亚洲语言文档上表现更佳。
- **ColSmol**：适合边缘部署的小型变体，参数量低于 1B。

### ViDoRe 基准结果

ColPali 在 InfographicVQA、ArxivQA 和 TabFQuAD 等视觉复杂基准上表现出色，这些基准分别测试信息图、图形和表格。即使在以文本为中心的文档上，它也优于传统基于文本的流水线。

此后 ViDoRe 已发展到 V3，供应商目前用它报告单向量多模态嵌入模型的表现（见上表）。这会影响架构选择：ViDoRe V3 得分达到 80 多分中段的单向量页面嵌入（供应商报告），服务成本远低于每页存储 1,024 个 patch 向量。因此，在决定采用多向量索引前，先评估单向量多模态嵌入模型加重排序器。

---

## 表格抽取与结构化数据检索

表格是传统 RAG 中最难处理的模态。按行将表格扁平化，会破坏列与表头之间赋予每个单元格意义的关系。

### 策略 1：基于 VLM 的抽取

```python
# Pseudocode: Extract tables using a VLM
def extract_tables_from_page(page_image: bytes) -> list[dict]:
    prompt = """
    Extract ALL tables from this document page.
    For each table, return:
    {
      "title": "table title or caption",
      "headers": ["col1", "col2", ...],
      "rows": [["val1", "val2", ...], ...],
      "markdown": "| col1 | col2 |\\n|---|---|\\n| val1 | val2 |"
    }
    Return JSON array. If no tables, return [].
    """
    response = vlm.generate(image=page_image, prompt=prompt)
    return json.loads(response)
```

### 策略 2：专用表格解析器

- **Tabula / Camelot**：基于规则的 PDF 表格抽取。速度快，但在复杂版式下较脆弱。
- **Table Transformer（基于 DETR）**：从图像中检测表格边界和单元格结构。
- **Unstructured.io**：结合启发式方法和 ML 模型进行版式感知解析。
- **文档解析 VLM**（Cohere Parse、MinerU 4.0、支持可插拔 VLM 后端的 Docling）：将表格以 HTML 或 Markdown 内联输出，并保留边界框与阅读顺序，从而保持表格与页面引用的关联。参见 [OCR 与版式分析](../10-document-processing/01-ocr-and-layout.md)。

### 策略 3：表格感知分块

```
  Original Table (20 rows x 8 columns)
        |
        v
  Chunk as complete unit (do NOT split tables across chunks)
        |
        v
  Embed the full markdown table as a single chunk
        |
        v
  Add metadata: {"type": "table", "page": 14, "caption": "Q3 Revenue by Region"}
        |
        v
  At generation time: pass the FULL table to the LLM, not a fragment
```

**关键原则**：表格必须是原子级检索单元。绝不能把一个表格切到 chunk 边界之外。

---

## 图表与示意图理解

### 图表类型与抽取方法

| 图表类型 | 需要抽取什么 | 最佳方法 |
|-----------|----------------|---------------|
| **柱状图/折线图/饼图** | 数据值、趋势、比较 | VLM 描述 + 数据表抽取 |
| **流程图** | 步骤、决策、连接关系 | VLM 结构化抽取（节点 + 边） |
| **架构图** | 组件、关系、数据流 | VLM 描述 + 实体抽取 |
| **散点图** | 相关性、离群点、聚类 | VLM 趋势描述 + 原始数据（如有） |
| **甘特图** | 时间线、依赖、里程碑 | VLM 结构化抽取 |

### 双表征策略

对每个图表或示意图，存储两种表示：

```
  Chart Image
    |
    +---> (1) Text Description (for text-based retrieval)
    |         "This bar chart shows Q3 revenue by region.
    |          North America: $4.2M, Europe: $3.1M, APAC: $2.8M.
    |          NA grew 15% QoQ while APAC declined 3%."
    |
    +---> (2) Original Image (for visual retrieval + generation context)
              Stored with CLIP/SigLIP embedding for image-based queries
```

这确保图表既可以通过文本查询（“亚太地区收入是多少？”）检索，也可以通过视觉查询（“给我看那张收入图表”）检索。

---

## 视频：固定采样与智能体处理

过去，视频 RAG 的成本模型只是时长 × 帧率 × 每帧 token 数的简单计算。Gemini 默认的静态处理以 1 FPS 采样，在默认的低媒体分辨率下每秒视频大约使用 100 个 token。因此，一小时约为 36 万 token；按 Gemini 3.8 Flash 的推广期输入价格约需 $0.27，按 2027 年标价则约需 $0.54。1M 上下文模型在低分辨率下最多容纳约 3 小时视频，高分辨率下约 1 小时。

2026 年 9 月 1 日，Google 为 Gemini 3.7 Flash、3.6 Flash 和 3.5 Flash-Lite 加入了**智能体视频处理**，文档现也列出了 Gemini 3.8 Flash：在视频输入中设置 `"processing": "agentic"`，模型便会使用内部视频工具，自行选择检查哪些片段、播放速度以及帧、音频或转录文本等模态。这是选择开启的功能（默认仍为静态 1 FPS），适用于上传视频和 YouTube URL，按标准 token 价格计费，不另收功能费。Google 报告，在标准视频基准上，token 最多减少 88%、成本最多降低 66%、准确率最多提高 7%；长视频的收益最大（供应商报告）。

```
STATIC (default):   video ──► every frame at 1 FPS + audio ──► context ──► answer
                    cost scales with duration

AGENTIC (opt-in):   video + question ──► model picks segments, speed, modality
                                         (frames / audio / transcript) ──► answer
                    cost scales with how much of the video the question needs
```

设计启示：
- **按问题类型预算，而非按视频小时数预算。**“结尾发生了什么？”涉及的视频远少于“列出每一次安全违规”。设置配额前，应按查询类别计量实际 token；最多节省 88% 的情况主要出现在长视频。
- **单视频问答的检索移入了模型内部。** 当问题针对单个视频时，智能体处理可以替代自行实现的场景检测、关键帧采样和转录文本分块。搜索视频库仍需索引：将转录文本和场景说明放入文本索引，用 Gemini Embedding 2 嵌入短片段（每次输入最多 120 秒），再将排名靠前的视频交给模型。
- **评估覆盖率，不只看准确率。** 模型会自行决定观看内容，因此应要求带时间戳的引用，并抽样与原视频核对；根据错误片段给出看似自信的答案，是视频场景下的检索遗漏。

---

## 生产架构

### 完整多模态 RAG 流水线

```
  INGESTION:
  Raw Docs --> Doc Classifier --+--> Text-Heavy  --> chunking + text embeddings
                                +--> Visual-Heavy --> page render + ColPali
                                +--> Mixed        --> VLM extraction + hybrid
                                         |
                                         v
                          [Text Index] [Image Index] [Table Index]

  RETRIEVAL:
  Query --> Query Analyzer --+--> Text:  BM25 + dense search
                             +--> Image: CLIP/ColPali search
                             +--> Table: metadata-filtered dense
                                    |
                                    v
                             Cross-Modal Reranker --> Context Assembly --> VLM --> Response
```

### 扩展性考虑

| 关注点 | 解决方案 |
|---------|----------|
| **索引大小** | ColPali 每页存储约 1024 个向量，1M 页约有 1B 个向量。可使用量化（binary、PQ）、用于候选生成的 MUVERA 式单向量编码（Milvus 3.0；Weaviate 1.31+，1.40 候选版本提供磁盘支持的 HFresh 路径），或减少每页向量数（参见 [后期交互与 ColBERT](11-late-interaction-colbert.md#压缩向量本身)）。 |
| **摄入延迟** | 前沿 VLM 抽取较慢（约每页 2-5 秒）。专用解析器更快：在并发度 32、单张 A100 上，jina-ocr-v1 每秒处理 2.57 页；Cohere 报告 Parse 每张 GPU 每秒处理 4.5 页（均为供应商报告）。使用异步 worker。 |
| **查询延迟** | 多索引 fan-out 会增加延迟。使用并行检索 + 激进的 top-k 剪枝。 |
| **成本** | 摄入为一次性成本，可由查询量摊销。按 2026 年 10 月标价、每页约 1.7K 输入和 800 输出 token 估算：Gemini 3.8 Flash 推广价约 $0.004/页，Claude Sonnet 5.5 或 GPT-6 Sol 约 $0.011/页，均未计入推理 token；批处理 API 可将两者减半。Cohere Parse 标价为每 1,000 页 $1.50。 |
| **存储** | 将页面图像存入对象存储（S3）。将嵌入存入向量数据库。将文本存入搜索索引。 |

---

## 实现示例

### 使用 ColPali + VLM 的端到端多模态 RAG

```python
# Pseudocode: Production multi-modal RAG pipeline

import uuid
from colpali_engine import ColPali, ColPaliProcessor
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, Filter, FieldCondition, MatchValue
import anthropic

# --- INDEXING ---

def index_document(pdf_path: str, collection: str):
    """Index a PDF document using ColPali for visual retrieval
    and VLM extraction for text-based retrieval."""

    pages = render_pdf_to_images(pdf_path, dpi=300)

    colpali_model = ColPali.from_pretrained("vidore/colpali-v1.3")
    processor = ColPaliProcessor.from_pretrained("vidore/colpali-v1.3")
    vlm_client = anthropic.Anthropic()

    for page_num, page_image in enumerate(pages):
        # 1. Generate ColPali multi-vector embeddings
        inputs = processor(images=[page_image])
        patch_embeddings = colpali_model(**inputs)  # shape: [1, 1024, 128]

        # 2. Extract structured content via VLM
        extraction = vlm_client.messages.create(
            model="claude-sonnet-5-5",
            max_tokens=16000,                  # thinking is on by default; leave headroom
            output_config={"effort": "low"},   # transcription, not reasoning
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": encode_image(page_image)},
                    {"type": "text", "text": """Extract from this page:
                    1. All text content (preserve structure)
                    2. Tables as markdown
                    3. Chart descriptions with data points
                    Return as JSON with keys: text, tables, charts"""}
                ]
            }]
        )

        # Current Claude models return thinking blocks before the text block,
        # so content[0] is not the answer. Read the text block explicitly.
        text = next(b.text for b in extraction.content if b.type == "text")
        structured = json.loads(text)

        # 3. Store in vector DB
        qdrant.upsert(collection, points=[
            # ColPali multi-vector for visual retrieval
            PointStruct(
                id=str(uuid.uuid5(uuid.NAMESPACE_URL, f"{pdf_path}#page={page_num}")),
                vector={"colpali": patch_embeddings[0].tolist()},
                payload={
                    "source": pdf_path,
                    "page": page_num,
                    "type": "page_image",
                    "text_preview": structured["text"][:500]
                }
            ),
            # Text embeddings for each extracted element
            *create_text_chunks(structured, pdf_path, page_num)
        ])


# --- RETRIEVAL ---

def retrieve(query: str, collection: str, top_k: int = 5):
    """Hybrid retrieval: ColPali visual + text semantic search."""

    # Visual retrieval via ColPali
    query_inputs = processor(text=[query])
    query_embeddings = colpali_model(**query_inputs)

    # query_points (Query API) replaces the legacy search endpoints,
    # which Qdrant 1.19 removed from its OpenAPI schema
    visual_results = qdrant.query_points(
        collection,
        query=query_embeddings[0].tolist(),  # multi-vector query, MaxSim scoring
        using="colpali",
        query_filter=Filter(must=[
            FieldCondition(key="type", match=MatchValue(value="page_image"))
        ]),
        limit=top_k,
    ).points

    # Text retrieval via dense embeddings
    text_embedding = text_encoder.encode(query)
    text_results = qdrant.query_points(
        collection,
        query=text_embedding.tolist(),
        using="text",
        limit=top_k,
    ).points

    # Fuse results using reciprocal rank fusion
    fused = reciprocal_rank_fusion(visual_results, text_results, k=60)
    return fused[:top_k]


# --- GENERATION ---

def generate_answer(query: str, retrieved_context: list) -> str:
    """Generate answer using VLM with multi-modal context."""

    content_blocks = [{"type": "text", "text": f"Question: {query}\n\nContext:"}]

    for ctx in retrieved_context:
        if ctx.payload["type"] == "page_image":
            # Include the actual page image
            content_blocks.append({
                "type": "image",
                "source": load_page_image(ctx.payload["source"], ctx.payload["page"])
            })
        else:
            # Include text/table content
            content_blocks.append({
                "type": "text",
                "text": f"[{ctx.payload['type']}] {ctx.payload['content']}"
            })

    content_blocks.append({
        "type": "text",
        "text": "Answer the question using ONLY the provided context. Cite sources."
    })

    response = vlm_client.messages.create(
        model="claude-sonnet-5-5",
        max_tokens=16000,
        output_config={"effort": "medium"},
        messages=[{"role": "user", "content": content_blocks}]
    )
    return next(b.text for b in response.content if b.type == "text")
```

---

## 系统设计面试视角

### 问：为一个金融研究平台设计一个 RAG（Retrieval-Augmented Generation，检索增强生成）系统，该平台需要回答包含文本、表格和图表的财报问题。

**高质量回答：**

核心挑战在于，财报中超过 60% 的信息位于表格和图表中，而非纯正文。仅使用纯文本 RAG（text-only RAG）会遗漏收入分解、趋势线和对比数据。

**架构**：我会采用混合方案（模式 2 + 模式 3 的元素）：

1. **数据摄入（Ingestion）**：以 300 DPI 渲染每一页 PDF。执行一次 VLM（Vision-Language Model，视觉语言模型）提取，把表格转换为 Markdown，把图表转换为结构化描述。同时为每页图像生成 ColPali 多向量（multi-vector）嵌入。

2. **存储**：三类索引——(a) 带有稠密向量（dense embeddings）的文本分块（financial text，财务文本），(b) 带有表格类型（table type）元数据过滤器的表格 Markdown 及其稠密向量，(c) 用于页面级视觉检索的 ColPali 多向量索引。

3. **检索（Retrieval）**：查询分析器（query analyzer，查询分析器）对查询类型分类。“What was Q3 revenue?” 会触发文本 + 表格检索；“Show me the revenue trend” 会触发视觉（ColPali）检索。结果通过 RRF（Reciprocal Rank Fusion，倒数秩融合）进行融合，再由多模态重排序器重排，使页面图像和表格文本在同一尺度上竞争。开放权重选项是 Qwen3-VL-Reranker-2B/8B，采用 Apache 2.0 许可，支持 32K 上下文。

4. **生成（Generation）**：VLM（Claude 或 Gemini）接收融合后的上下文——文本分块、表格 Markdown 和相关页面图像。它基于指向具体页面和表格的引用生成有依据的回答（grounded answer）。

**关键权衡**：ColPali 在视觉内容召回上表现出色，但每页会存储约 1024 个向量，因此在 100k 文档（500k 页）场景下约有 5 亿（~500M）个向量。我会使用二值量化（binary quantization）将存储减少 32 倍，接受少量召回损失；如果向量数据库支持，也可以采用 MUVERA 式候选生成。但在确定使用多向量方案前，我会先在自己的评估集上对比单向量多模态嵌入模型（Cohere Embed 5 或 Gemini Embedding 2）加重排序器：向量数是 50 万，而不是 5 亿。对于文本路径，BM25 + 稠密向量混合检索（hybrid search）能较好处理金融术语。

**摄入成本**（2026 年 10 月标价，每页约 1.7K 输入和 800 输出 token）：处理 50 万页，Gemini 3.8 Flash 按推广价约需 $2,000；Claude Sonnet 5.5 或 GPT-6 Sol 约需 $5,700，未计入推理 token；Cohere Parse 按每千页 $1.50 计算则为 $750。批处理 API 可将 VLM 成本减半。我会按页面类型分流：文本与表格页面使用专用解析器，仅在图表较多、确需生成描述的页面使用前沿 VLM。

### 问：你会如何处理需要同时从不同页面的图表和表格中获取信息的查询？

**高质量回答：**

这是一个跨模态（cross-modal）、跨页检索问题。解决方案分为三部分：

1. **检索多样性（Retrieval diversity）**：确保检索器返回多模态结果。设置最低配额——每次检索集合中至少返回 2 条文本、2 条表格和 1 条视觉结果，无论哪种模态得分最高。

2. **上下文组装（Context assembly）**：在组装 VLM 提示词时，包含全部检索内容并附带明确来源标注，例如：“[Table from page 14: Q3 Revenue by Region]”（第 14 页表格：Q3 按地区收入）和 “[Chart from page 22: Revenue Trend 2024-2026]”（第 22 页图表：2024-2026 收入趋势）。VLM 就能在两者之间进行推理。

3. **Agentic 回退（Agentic fallback）**：若初始检索未检出足够的跨模态上下文，可通过 agentic layer（智能体层）发起后续检索：“表格有收入数字，但用户问的是趋势——我再搜索与收入相关的图表。”

核心洞察在于，跨模态问题本质上是 multi-hop（多跳）检索。系统需要先从一种模态检索，识别知识缺口，再从另一种模态补齐检索。

### 问：用户希望在一个拥有 10,000 小时培训视频的视频库中提问。你会如何设计系统并估算成本？

**高质量回答：**

将视频库搜索与单视频理解分开，因为只有后者能使用模型内部的视频工具。

1. **一次建好索引。** 不能每次提问都处理整个视频库：按每秒约 100 个 token，完整扫描一次约需 36 亿 token。应只转录一次（60 万分钟按 `gpt-transcribe` 每分钟 $0.0045 计，约 $2,700），把转录文本和场景说明放进 BM25 + 稠密向量混合索引，并用 Gemini Embedding 2 嵌入短片段（每次输入最多 120 秒），支持视觉查询。
2. **先检索，再观看。** 检索返回带时间戳的排名靠前视频，只将这些视频交给 Gemini 3.8 Flash。静态 1 FPS 处理一小时视频约需 36 万 token（按推广价，输入成本约 $0.27）；设置 `"processing": "agentic"` 后，模型自行选择检查哪些片段。Google 报告，长视频最多能减少 88% 的 token（供应商报告）。
3. **按查询类别估算成本。** 智能体处理的 token 用量取决于问题，应在试点中按查询类型计量，并按实测分布设置配额，而不是按视频时长推算。
4. **评估依据。** 要求答案带时间戳引用并抽样核对，因为常见失败方式是根据错误片段给出流畅答案。

---

## 参考资料（References）

- Faysse 等. "ColPali: Efficient Document Retrieval with Vision Language Models" (ICLR 2025)
- Google. "SigLIP 2: Multilingual Vision-Language Encoders" (2025)
- NVIDIA. "An Easy Introduction to Multimodal Retrieval-Augmented Generation" (2025)
- HKUDS. "RAG-Anything: All-in-One Multimodal RAG Framework" (2025)
- Vespa Blog. "PDF Retrieval with Vision Language Models" (2024)
- Google. "Gemini Embedding 2" (March 2026) and "Introducing agentic video in Gemini" (September 2026)
- Google. Gemini API video understanding documentation (accessed October 2026)
- Cohere. "Embed 5" (September 2026)

---

*上一篇：[后期交互与 ColBERT](11-late-interaction-colbert.md) | 下一篇：[RAG 评估模式](13-rag-evaluation-patterns.md)*
