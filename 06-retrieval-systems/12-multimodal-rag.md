# Multi-Modal RAG（多模态 RAG）

Multi-modal RAG 扩展了 retrieval-augmented generation（检索增强生成），使其不再局限于纯文本，而是能够处理图像、表格、图表、音频以及混合版式文档。生产系统现在经常摄入带有图示的 PDF、幻灯片、扫描发票和研究论文，在这些文档里，视觉布局本身就是意义的一部分。当前占主导地位的三种架构是：caption-and-index、统一视觉-文本嵌入（Cohere Embed v4、Voyage-Multimodal-3.5、Gemini Embedding 001）以及 page-as-image with late interaction（页图像化并进行后期交互，如 ColPali、ColQwen2.5、ColNomic）。

## 目录

- [为什么纯文本 RAG 会失效](#为什么纯文本-rag-会失效)
- [架构模式](#架构模式)
- [多模态嵌入策略](#多模态嵌入策略)
- [用于文档理解的视觉语言模型](#用于文档理解的视觉语言模型)
- [ColPali 与基于视觉的检索](#colpali-与基于视觉的检索)
- [表格抽取与结构化数据检索](#表格抽取与结构化数据检索)
- [图表与示意图理解](#图表与示意图理解)
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

- **做法**：使用类似 CLIP 或 SigLIP 的模型，将文本和图像投影到同一个向量空间。
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
| Voyage Multimodal 3 | 混合文档 | 1024 | 高 | 高 |

### 嵌入策略决策

```
Is your content mostly natural images (photos, products)?
  YES --> CLIP or SigLIP fine-tuned on your domain
  NO
    |
    v
Is your content document pages (PDFs, slides, reports)?
  YES --> ColPali / ColQwen (vision-first, no OCR needed)
  NO
    |
    v
Is it a mix of text, images, and structured data?
  YES --> Modality-specific encoders + fusion (Pattern 2)
```

---

## 用于文档理解的视觉语言模型

VLMs（视觉语言模型）在多模态 RAG 中承担两个角色：(1) 作为 **generator**（生成器），从检索到的多模态上下文中合成答案；(2) 作为 **indexing engine**（索引引擎），在摄入阶段提取结构化信息。

### VLM 能力对比

| 能力 | Claude Opus 4.7 / Sonnet 4.6 | GPT-5.5 | Gemini 3.1 Pro |
|-----------|------------------------------|---------|----------------|
| **图表读取** | 优秀 | 优秀 | 优秀 |
| **表格抽取** | 优秀 | 良好 | 优秀 |
| **示意图理解** | 优秀 | 良好 | 优秀 |
| **手写 OCR** | 良好 | 良好 | 良好 |
| **多页推理** | 优秀（Sonnet 4.6 支持 1M ctx） | 优秀（1M ctx） | 优秀（1M ctx） |
| **结构化输出** | 原生 JSON 模式 | 原生 JSON 模式 | 原生 JSON 模式 |

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
- **ColQwen 2.5**：Qwen2-VL 主干。多语言支持更好，在亚洲语言文档上表现更佳。
- **ColSmol**：更小的变体，适合边缘部署。约 1B 参数。

### ViDoRe 基准结果

ColPali 在 InfographicVQA、ArxivQA 和 TabFQuAD 等视觉复杂基准上表现出色，这些基准分别测试信息图、图形和表格。即使在以文本为中心的文档上，它也优于传统基于文本的流水线。

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
| **索引大小** | ColPali 每页存储约 1024 个向量。1M 页约等于 ~1B 个向量。使用量化（binary, PQ）。 |
| **摄入延迟** | VLM 抽取较慢（~2-5s/page）。使用带 GPU 加速的异步 worker。 |
| **查询延迟** | 多索引 fan-out 会增加延迟。使用并行检索 + 激进的 top-k 剪枝。 |
| **成本** | VLM 在摄入阶段的调用是一次性的。将其在查询量上摊销。抽取预算约为每页 $0.01-0.05。 |
| **存储** | 将页面图像存入对象存储（S3）。将嵌入存入向量数据库。将文本存入搜索索引。 |

---

## 实现示例

### 使用 ColPali + VLM 的端到端多模态 RAG

```python
# Pseudocode: Production multi-modal RAG pipeline

from colpali_engine import ColPali, ColPaliProcessor
from qdrant_client import QdrantClient
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
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
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

        structured = json.loads(extraction.content[0].text)

        # 3. Store in vector DB
        qdrant.upsert(collection, points=[
            # ColPali multi-vector for visual retrieval
            PointStruct(
                id=f"{pdf_path}:page:{page_num}:colpali",
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

    visual_results = qdrant.query(
        collection,
        query_vector=("colpali", query_embeddings[0].tolist()),
        limit=top_k,
        query_filter=Filter(must=[FieldCondition(key="type", match="page_image")])
    )

    # Text retrieval via dense embeddings
    text_embedding = text_encoder.encode(query)
    text_results = qdrant.search(
        collection,
        query_vector=("text", text_embedding.tolist()),
        limit=top_k
    )

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
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        messages=[{"role": "user", "content": content_blocks}]
    )
    return response.content[0].text
```

---

## 系统设计面试视角

### 问：为一个金融研究平台设计一个 RAG（Retrieval-Augmented Generation，检索增强生成）系统，该平台需要回答包含文本、表格和图表的财报问题。

**高质量回答：**

核心挑战在于，财报中超过 60% 的信息位于表格和图表中，而非纯正文。仅使用纯文本 RAG（text-only RAG）会遗漏收入分解、趋势线和对比数据。

**架构**：我会采用混合方案（模式 2 + 模式 3 的元素）：

1. **数据摄入（Ingestion）**：以 300 DPI 渲染每一页 PDF。执行一次 VLM（Vision-Language Model，视觉语言模型）提取，把表格转换为 Markdown，把图表转换为结构化描述。同时为每页图像生成 ColPali 多向量（multi-vector）嵌入。

2. **存储**：三类索引——(a) 带有稠密向量（dense embeddings）的文本分块（financial text，财务文本），(b) 带有表格类型（table type）元数据过滤器的表格 Markdown 及其稠密向量，(c) 用于页面级视觉检索的 ColPali 多向量索引。

3. **检索（Retrieval）**：查询分析器（query analyzer，查询分析器）对查询类型分类。“What was Q3 revenue?” 会触发文本 + 表格检索；“Show me the revenue trend” 会触发视觉（ColPali）检索。结果通过 RRF（Reciprocal Rank Fusion，倒数秩融合）进行融合，再由 cross-encoder（交叉编码器）重排。

4. **生成（Generation）**：VLM（Claude 或 Gemini）接收融合后的上下文——文本分块、表格 Markdown 和相关页面图像。它基于指向具体页面和表格的引用生成有依据的回答（grounded answer）。

**关键权衡**：ColPali 在视觉内容召回上表现出色，但每页会存储约 1024 个向量，因此在 100k 文档（500k 页）场景下约有 5 亿（~500M）个向量。我会使用二值量化（binary quantization）将存储减少 32 倍，接受少量召回损失。对于文本路径，BM25 + 稠密向量混合检索（hybrid search）能较好处理金融术语。

### 问：你会如何处理需要同时从不同页面的图表和表格中获取信息的查询？

**高质量回答：**

这是一个跨模态（cross-modal）、跨页检索问题。解决方案分为三部分：

1. **检索多样性（Retrieval diversity）**：确保检索器返回多模态结果。设置最低配额——每次检索集合中至少返回 2 条文本、2 条表格和 1 条视觉结果，无论哪种模态得分最高。

2. **上下文组装（Context assembly）**：在组装 VLM 提示词时，包含全部检索内容并附带明确来源标注，例如：“[Table from page 14: Q3 Revenue by Region]”（第 14 页表格：Q3 按地区收入）和 “[Chart from page 22: Revenue Trend 2024-2026]”（第 22 页图表：2024-2026 收入趋势）。VLM 就能在两者之间进行推理。

3. **Agentic 回退（Agentic fallback）**：若初始检索未检出足够的跨模态上下文，可通过 agentic layer（智能体层）发起后续检索：“表格有收入数字，但用户问的是趋势——我再搜索与收入相关的图表。”

核心洞察在于，跨模态问题本质上是 multi-hop（多跳）检索。系统需要先从一种模态检索，识别知识缺口，再从另一种模态补齐检索。

---

## 参考资料（References）

- Faysse 等. "ColPali: Efficient Document Retrieval with Vision Language Models" (ICLR 2025)
- Google. "SigLIP 2: Multilingual Vision-Language Encoders" (2025)
- NVIDIA. "An Easy Introduction to Multimodal Retrieval-Augmented Generation" (2025)
- HKUDS. "RAG-Anything: All-in-One Multimodal RAG Framework" (2025)
- Vespa Blog. "PDF Retrieval with Vision Language Models" (2024)

---

*上一篇：[高级检索模式](09-advanced-retrieval-patterns.md) | 下一篇：[RAG 评估模式](13-rag-evaluation-patterns.md)*
