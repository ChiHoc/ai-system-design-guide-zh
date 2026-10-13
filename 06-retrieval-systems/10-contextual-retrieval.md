# 上下文检索

上下文检索（Contextual Retrieval）是一种在摄取时执行的技术，用于解决 RAG 失败的 #1 根本原因：**当分块（chunk）与其源文档分离后失去意义**。它由 Anthropic 于 2024 年底率先提出，如今已成为高精度检索的生产标准。Anthropic 自身的测量显示，上下文嵌入结合上下文 BM25 可使前 20 个结果中的检索失败减少 49%，加入重排序后可减少 67%。

## 目录

- [问题：上下文稀释](#问题-上下文稀释)
- [上下文检索如何工作](#上下文检索如何工作)
- [上下文嵌入](#上下文嵌入)
- [上下文 BM25](#上下文-bm25)
- [完整流水线：混合 + 重排序](#完整流水线-混合-重排序)
- [实现模式](#实现模式)
- [成本考量](#成本考量)
- [上下文检索 vs. 其他方法](#上下文检索与其他方法的比较)
- [生产架构](#生产架构)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 问题：上下文稀释

当我们为 RAG 对文档进行分块时，单个分块会失去赋予其意义的周围上下文。

**上下文稀释示例：**

```
Original Document: "Acme Corp Q3 2025 Financial Report"
  Section 4: Product Pricing

  "The Standard plan costs $200/month. The Enterprise
   plan includes SSO and audit logs for $800/month."

-------- After Chunking --------

Chunk 17: "It costs $200/month."
Chunk 18: "The Enterprise plan includes SSO and audit
           logs for $800/month."
```

**分块 17 的问题**：用户搜索“Acme Standard 套餐多少钱？”时，很可能会错过这个分块，因为其中没有提到“Acme”、“Standard”或“套餐”。“每月 $200”这段嵌入（embedding）在语义上与查询相距甚远。

**洞察**：Anthropic 的研究表明，传统分块在前 20 个检索结果上会造成 **5.7% 的检索失败率**。这意味着即使知识库中存在相关信息，大约每 18 个查询里就有 1 个无法检索到相关信息。

---

## 上下文检索如何工作

核心思路很简单：**在对分块做嵌入之前，先附加一段简短的上下文字符串，说明该分块在整篇文档中的含义**。

```
┌──────────────────────────────────────────────────┐
│              TRADITIONAL CHUNKING                │
│                                                  │
│  Document ──► Split ──► Chunks ──► Embed ──► DB  │
│                                                  │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│              CONTEXTUAL RETRIEVAL                            │
│                                                              │
│  Document ──► Split ──► Chunks ──┐                           │
│                                  ├──► Contextualize ──►      │
│  Document (full) ───────────────┘    (LLM call per chunk)    │
│                                                              │
│  ──► Contextual Chunks ──► Embed ──► DB                      │
│                            + BM25 Index                      │
└──────────────────────────────────────────────────────────────┘
```

**上下文化步骤** 会将完整文档 + 单个分块发送给 LLM，并使用以下提示词：

```
<document>
{{WHOLE_DOCUMENT}}
</document>

Here is the chunk we want to situate within the whole document:
<chunk>
{{CHUNK_CONTENT}}
</chunk>

Please give a short succinct context to situate this chunk
within the overall document for the purposes of improving
search retrieval of the chunk. Answer only with the succinct
context and nothing else.
```

**分块 17 的结果**：

```
Before: "It costs $200/month."

After:  "This chunk is from the Acme Corp Q3 2025 Financial
         Report, Section 4 on Product Pricing. It describes
         the cost of the Standard plan.
         It costs $200/month."
```

现在，这个分块的嵌入包含了“Acme”、“Standard 套餐”和“产品定价”——也就是用户自然会搜索到的所有术语。

---

## 上下文嵌入

上下文嵌入（Contextual Embeddings）是第一种子技术：对上下文化后的分块进行嵌入，而不是对原始分块进行嵌入。

### 它如何提升检索

| 场景 | 原始分块嵌入 | 上下文嵌入 |
|----------|--------------------|-----------------------|
| 用户询问 “Acme 定价” | 匹配不到 “每月 $200” | 匹配到 “Acme...Standard 套餐...费用为 $200” |
| 用户询问 “SSO 功能” | 匹配 “SSO 和审计日志” | 结合 “Enterprise 套餐” 的上下文进行匹配 |
| 用户询问 “Q3 财务数据” | 无匹配（未提到 Q3） | 通过前置的 “Q3 2025 财务报告” 进行匹配 |

**效果**：仅上下文嵌入就能将前 20 名检索失败从 **5.7% 降至 3.7%**，也就是检索失败减少 **35%**。

### 向量空间的偏移

```
                    ▲ Dimension 2
                    │
                    │    ● "Acme pricing" (query)
                    │         \
                    │          \  close (contextual)
                    │           \
                    │            ● Contextualized chunk
                    │
                    │                          ● Raw chunk "It costs $200"
                    │                            (far from query)
                    │
                    └─────────────────────────────► Dimension 1
```

---

## 上下文 BM25

第二种子技术是将相同的上下文化方法应用于构建一个针对增强后分块的 **BM25 关键词索引**（BM25 keyword index）。

### 为什么 BM25 仍然重要

稠密嵌入（dense embeddings）擅长语义相似度，但在以下方面表现不佳：
- **精确术语**：产品 ID、版本号、缩写
- **稀有 token**：嵌入模型表示不足的领域专有术语
- **专有名词**：公司名、人名、地名

**示例**：用户搜索“Widget-X pricing”时，原始分块“每月 $200”不会产生任何 BM25 匹配，因为其中从未出现“Widget-X”。使用上下文 BM25 后，前置的上下文会把“Widget-X”包含为关键词，从而使 BM25 能够匹配。

### 性能提升（累积）

| 配置 | 失败率 | 相对基线的降低 |
|---------------|-------------|----------------------|
| 传统嵌入（基线） | 5.7% | -- |
| 仅上下文嵌入 | 3.7% | 35% |
| 上下文嵌入 + 上下文 BM25 | 2.9% | **49%** |
| 上下文嵌入 + 上下文 BM25 + 重排序 | 1.9% | **67%** |

**要点**：上下文嵌入 + 上下文 BM25 的组合，是你在 RAG 流水线中能做出的单个最高杠杆改动。在此基础上再加一个重排序器，就能让失败减少 67%。

---

## 完整流水线：混合 + 重排序

生产级的上下文检索流水线包含四个阶段：

```
┌─────────────────────────────────────────────────────────────────┐
│                     INGESTION PIPELINE                          │
│                                                                 │
│  1. Chunk documents (recursive, 300-500 tokens)                 │
│  2. For each chunk:                                             │
│     a. Send (full_doc + chunk) to LLM                           │
│     b. Get context string (50-100 tokens)                       │
│     c. Prepend context to chunk                                 │
│  3. Embed contextualized chunks ──► Vector DB                   │
│  4. Index contextualized chunks ──► BM25 Index                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     QUERY PIPELINE                              │
│                                                                 │
│  User Query                                                     │
│      │                                                          │
│      ├──► Vector Search (Top 50) ──┐                            │
│      │                             ├──► RRF Fusion (Top 25)     │
│      └──► BM25 Search (Top 50)  ──┘         │                   │
│                                             ▼                   │
│                                      Reranker (Top 5)           │
│                                             │                   │
│                                             ▼                   │
│                                     LLM Generation              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 用于合并结果的互惠排名融合（RRF）

标准混合搜索中使用的同一种 RRF 技术也适用于这里：

```
RRF_Score(doc) = sum( 1 / (k + rank_in_list) )
                 for each list where doc appears

k = 60 (standard smoothing constant)
```

---

## 实现模式

### 模式 1：基础上下文检索（Python）

```python
import anthropic
from typing import List

client = anthropic.Anthropic()

CONTEXT_PROMPT = """<document>
{document}
</document>

Here is the chunk we want to situate within the whole document:
<chunk>
{chunk}
</chunk>

Please give a short succinct context to situate this chunk
within the overall document for the purposes of improving
search retrieval of the chunk. Answer only with the succinct
context and nothing else."""


def contextualize_chunk(
    full_document: str,
    chunk: str,
    model: str = "claude-haiku-4-5"  # small model: context strings are short and factual
) -> str:
    """Generate context for a single chunk."""
    response = client.messages.create(
        model=model,
        max_tokens=200,
        messages=[{
            "role": "user",
            "content": CONTEXT_PROMPT.format(
                document=full_document,
                chunk=chunk
            )
        }]
    )
    # Read the text block, not content[0]: on models with thinking on
    # (Sonnet 5.5, Opus 5.5), a thinking block comes first.
    context = next(b.text for b in response.content if b.type == "text")
    return f"{context}\n\n{chunk}"


def process_document(document: str, chunks: List[str]) -> List[str]:
    """Contextualize all chunks in a document."""
    contextualized = []
    for chunk in chunks:
        ctx_chunk = contextualize_chunk(document, chunk)
        contextualized.append(ctx_chunk)
    return contextualized
```

### 模式 2：使用提示缓存的成本优化

最大的成本驱动因素，是在每个分块里都发送完整文档。**提示缓存**（Prompt Caching）解决了这个问题：

```python
def contextualize_with_caching(
    full_document: str,
    chunks: List[str],
    model: str = "claude-haiku-4-5"
) -> List[str]:
    """
    Use prompt caching so the full document is only
    processed once across all chunks.
    """
    results = []

    for chunk in chunks:
        response = client.messages.create(
            model=model,
            max_tokens=200,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"<document>\n{full_document}\n</document>",
                        "cache_control": {"type": "ephemeral"}
                    },
                    {
                        "type": "text",
                        "text": (
                            f"<chunk>\n{chunk}\n</chunk>\n\n"
                            "Please give a short succinct context to "
                            "situate this chunk within the overall "
                            "document for the purposes of improving "
                            "search retrieval of the chunk. Answer "
                            "only with the succinct context and "
                            "nothing else."
                        )
                    }
                ]
            }]
        )
        context = next(b.text for b in response.content if b.type == "text")
        results.append(f"{context}\n\n{chunk}")

    return results
```

**提示缓存的成本影响**：对于一个拆分为 30 个分块的 10,000 token 文档，提示缓存可使文档输入成本降低约 **85%**：首次缓存写入按输入价格的 1.25 倍计费，随后 29 次读取按 0.1 倍计费，而不是 30 次均按原价计费。

以下三个运维陷阱会抹掉这部分节省：
- **交错处理与冷启动并发。** 默认缓存有效期为 5 分钟。同一文档的所有分块应在此窗口内处理；若队列把它们分散到数小时，每次调用都会成为缓存写入。先单独发出第一次调用，待其返回后再并发处理其余分块：并行的首次调用都会未命中缓存并支付写入费用。
- **短文档。** 可缓存前缀的最小长度因模型而异：Claude Haiku 4.5 为 4,096 token，Claude Opus 5.5 和 Fable 5.1 为 512 token。3,000 token 的文档在 Haiku 4.5 上根本不会缓存；应检查 `usage.cache_read_input_tokens`，而不是想当然。
- **退役的模型 ID。** 带日期的模型 ID 会退役：`claude-sonnet-4-20250514` 于 2026 年 6 月 15 日退出 Claude API，导致硬编码它的流水线失效。应把模型 ID 放在配置中，并随每条生成的上下文字符串一同保存。

### 3 模式：上下文块头（轻量替代方案）

如果基于 LLM 的上下文化过于昂贵，可以将 **上下文块头（Contextual Chunk Headers, CCH）** 作为确定性替代方案：

```python
def add_chunk_headers(
    document_title: str,
    section_hierarchy: List[str],
    chunk: str
) -> str:
    """
    Prepend document and section metadata to the chunk.
    No LLM call required: purely structural.
    """
    header_parts = [f"Document: {document_title}"]

    for i, section in enumerate(section_hierarchy):
        prefix = "  " * i
        header_parts.append(f"{prefix}Section: {section}")

    header = "\n".join(header_parts)
    return f"{header}\n\n{chunk}"


# Example usage:
contextualized = add_chunk_headers(
    document_title="Acme Corp Q3 2025 Financial Report",
    section_hierarchy=["Finance", "Product Pricing", "Standard Plan"],
    chunk="It costs $200/month."
)

# Result:
# Document: Acme Corp Q3 2025 Financial Report
#   Section: Finance
#     Section: Product Pricing
#       Section: Standard Plan
#
# It costs $200/month.
```

**何时使用 CCH 与 LLM 上下文化：**

| 因素 | 块头（CCH） | LLM 上下文化 |
|--------|--------------------|-----------------------|
| **成本** | 免费（无 LLM 调用） | 使用缓存时，每 100 万文档 token 约 $0.50（GPT-6 Luna）至 $5（Claude Haiku 4.5） |
| **质量** | 适合结构化文档 | 适用于所有文档，效果极佳 |
| **速度** | 即时 | 每次调用 0.5-2 秒；吞吐量来自并发 |
| **最适合** | Markdown、HTML、带清晰标题的 PDF | 非结构化文本、法律、医疗 |

---

## 成本考量

### 上下文化成本

对于一个包含 10,000 个分块（每块 400 token）、来自 500 份文档（每份 8,000 token）的知识库，假设文档已缓存、每次调用另有约 500 个未缓存的提示 token 和 75 个输出 token，按 2026 年 10 月 1 日的标价估算：

| 选项 | 每 100 万 token 价格（输入 / 缓存读取 / 输出） | 每块成本 | 总成本 | 备注 |
|--------|--------------------------------------|----------------|------------|-------|
| **GPT-6 Luna** | $0.10 / $0.01 / $0.50 | ~$0.0002 | ~$2 | OpenAI 自动缓存；缓存写入按 1.25 倍计费，固定有效期为 30 分钟 |
| **Claude Haiku 4.5** | $1 / $0.10 / $5 | ~$0.002 | ~$21 | 默认不启用思考；可缓存前缀至少需要 4,096 token |
| **Claude Sonnet 5.5** | $2 / $0.20 / $10 | ~$0.004 | ~$43 + 思考费用 | 默认启用思考；此任务可传入 `thinking: {type: "between_tools"}` 或使用低 effort |
| **Claude Opus 5.5** | $4 / $0.20 / $20 | ~$0.007 | ~$70 + 思考费用 | 无法关闭思考；对这项任务而言过于昂贵 |
| **voyage-context-4**（无需 LLM 调用） | 嵌入 $0.12 | ~$0.00005 | ~$0.50 | 替代嵌入步骤；只改善稠密检索（见下文） |

**最佳实践**：使用小模型做上下文化。上下文字符串简短且事实性强，前沿模型只会增加成本；在最新 Claude 模型上还会增加思考 token（默认启用，且 Opus 5.5 无法关闭），却没有可测量的质量提升。结合提示缓存；可以等待的回填任务则通过 Batch API 运行（Anthropic 和 OpenAI 均按标价的 50% 计费）。

Haiku 4.5 仍是唯一的 Haiku；截至 2026 年 10 月 1 日，虽已预告 Haiku 5.5 将在“未来几周”推出，但尚未发布。Haiku 4.5 将于 2026 年 11 月 15 日在 Microsoft Foundry 退役。在 Claude API 上，它尚无弃用通知，Anthropic 会至少提前 60 天通知。应把上下文化模型视为可替换依赖。

### 何时使用上下文检索

**在以下情况下使用：**
- 你的语料库中存在碎片化文档，单独的块会失去意义
- 你有嵌入模型难以处理的领域特定行话
- 你的检索失败率超过 3-5%
- 你能够承担一次性的摄取成本

**在以下情况下跳过：**
- 你的块本身已经自包含（例如 FAQ 问答对、产品描述）
- 你的语料库很小（< 100 个块）--直接使用长上下文即可
- 你需要实时摄取（每文档 < 1s）且无法批处理

---

## 上下文检索与其他方法的比较

| 方法 | 工作方式 | 检索提升 | 成本 | 复杂度 |
|----------|-------------|----------------------|------|------------|
| **朴素分块** | 固定大小切分，直接嵌入原始文本 | 基线 | 无 | 低 |
| **块头（CCH）** | 预置文档/章节标题 | 10-20% | 无 | 低 |
| **上下文检索** | 为每个块生成 LLM 上下文 | 35-49% | 每 1 万块约 $2-45（小到中型模型） | 中 |
| **上下文 + 重排序** | 上述方案 + 交叉编码器重排 | 67% | 在上述成本外另付每次查询的重排费用 | 中高 |
| **上下文分块嵌入** | 嵌入模型读取整篇文档，为每块生成一个向量 | 仅稠密检索；未在 Anthropic 的基准上测量 | 每 1 万块约 $0.50 | 低 |
| **HyDE** | 在查询时生成假设文档 | 20-40% | 按查询计费的 LLM 成本 | 中 |
| **父子分块** | 嵌入子块，检索父块 | 15-30% | 无 | 中 |

**关键区别**：上下文检索是**摄取时**技术（一次付费），而 HyDE 是**查询时**技术（按次付费）。对于高吞吐系统，上下文检索的摊销效果要好得多。

### 上下文检索与 Late Chunking

**Late Chunking**（Jina，2024）是一种相关但不同的方法：

```
Contextual Retrieval:
  Chunk ──► LLM adds context ──► Embed enriched chunk

Late Chunking:
  Full doc ──► Long-context embed model ──► Token embeddings
  ──► THEN chunk the token embeddings (preserving context)
```

Late Chunking 需要长上下文嵌入模型（例如 Jina v3），并且完全避免 LLM 调用。它通过嵌入模型的注意力机制来保留上下文，而不是显式地在文本前拼接内容。其权衡在于，Late Chunking 不能帮助 BM25 检索，只能改善稠密检索。

### 上下文分块嵌入模型

同样的思路如今也以托管嵌入 API 的形式提供。与使用 Claude 做上下文化相比，上表中的摄取成本可降低一到两个数量级：

- **voyage-context-4**（Voyage AI，2026 年 6 月 29 日正式发布）：为每个分块生成包含整篇文档上下文的向量，内置自动分块（`enable_auto_chunking=True`）、原生重叠分块，并能透明地处理超出其 32K token 窗口的文档。价格为每 100 万 token $0.12，低于 voyage-context-3 的 $0.18。Voyage 报告称，在 39 个数据集上，相比 context-3，分块级提升 2.08%，文档级提升 1.4%（厂商报告）。MongoDB Atlas 也提供此模型。
- **pplx-embed-v2-context-9b-preview**（Perplexity，Hugging Face，2026 年 9 月 25 日）：联合编码文档的各个分块，输出 2,048 维向量（通过 Matryoshka 可缩至 1,024 维），原生支持 int8，并分别提供 `encode_queries` 和 `encode` 路径。它明确处于预览阶段，生成的嵌入不可与后续版本混用，因此应把它当作评估候选，而非生产索引。

| | LLM 上下文化 | 上下文分块嵌入 |
|---|---|---|
| **摄取成本（1 万块）** | 约 $2-45，另加嵌入费用 | 约 $0.50，替代原有嵌入 |
| **是否帮助 BM25** | 是（上下文文本被索引） | 否 |
| **可调试性** | 是，可以读取上下文字符串 | 否，上下文只存在于向量中 |
| **厂商锁定** | 更换嵌入模型后，上下文字符串仍可使用 | 索引绑定一个厂商模型；切换时须重新嵌入 |
| **文档编辑** | 对改动的分块重新做上下文化 | 重新嵌入整篇文档 |

**2026 年的一种合理默认方案**：稠密检索侧使用上下文分块嵌入，BM25 侧使用确定性的分块头；只有在两者仍然遗漏的文档类别上使用 LLM 上下文化，并先在黄金测试集上衡量收益。

---

## 生产架构

### 参考架构：大规模上下文 RAG

```
┌─────────────────────────────────────────────────────────────────────┐
│                     INGESTION SERVICE                               │
│                                                                     │
│  Document Store ──► Chunker ──► Contextualization Queue             │
│                       │              │                              │
│                       │         ┌────┴────┐                         │
│                       │         │ Workers  │ (N parallel LLM calls) │
│                       │         │ + Cache  │                        │
│                       │         └────┬────┘                         │
│                       │              │                              │
│                       ▼              ▼                              │
│                  Raw Chunks    Contextualized Chunks                 │
│                       │              │                              │
│                       │         ┌────┴────┐                         │
│                       │         │ Embed + │                         │
│                       │         │ BM25    │                         │
│                       │         └────┬────┘                         │
│                       │              │                              │
│                       ▼              ▼                              │
│                  Metadata DB    Vector DB + BM25 Index               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     QUERY SERVICE                                   │
│                                                                     │
│  Query ──► [Vector Search] + [BM25 Search]                          │
│                    │               │                                │
│                    └───── RRF ─────┘                                │
│                           │                                         │
│                      Top 25 chunks                                  │
│                           │                                         │
│                      Reranker (Cohere Rerank 4, Voyage rerank-3,    │
│                      or a self-hosted cross-encoder)                │
│                           │                                         │
│                      Top 5 chunks                                   │
│                           │                                         │
│                      LLM Generation                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 扩展性考量

| 关注点 | 解决方案 |
|---------|----------|
| **摄取吞吐量** | 使用异步 worker 并行化 LLM 调用（并发 50-100） |
| **文档更新** | 仅重新上下文化变更的块；将原始文本与上下文分开存储 |
| **规模成本** | 小模型 + 提示缓存，同一文档的分块集中调度；回填用 Batch API；或使用上下文嵌入模型 |
| **质量监控** | 抽样 1% 的块并进行人工评估上下文质量 |
| **索引一致性** | 对每个文档原子更新向量数据库 + BM25 索引 |
| **模型更迭** | 随每条上下文字符串保存上下文化模型 ID 和提示版本。模型退役后，已有字符串仍有效；在同一索引中混用不同风格前，先抽样检查继任模型的输出 |

---

## 面试题

### 问：解释 Anthropic 的上下文检索。你会在什么时候使用它，什么时候会跳过它？

**强答案：**
上下文检索解决的是 RAG 中的“上下文稀释”问题。当文档被切块时，单个块会失去赋予其意义的周边上下文 -- 一个写着“它的费用是 $200”的块，如果不知道**什么**东西的费用是 $200，就毫无用处。该技术在摄取时使用 LLM，为每个块生成一个简短的上下文字符串（50-100 个 token），解释该块在整篇文档中的含义。然后在嵌入和 BM25 索引之前，将这个上下文前置到块内容中。

关键结果是：仅使用上下文化嵌入可将检索失败减少 35%。加入上下文化 BM25 可实现 49% 的降低。再加入重排序器可达到 67% 的降低。

当块在单独存在时经常失去意义时，我会使用它，比如法律合同、财务报告、技术手册。我会在块本身已经自包含时（FAQ、产品卡片），或者语料库规模小到适合长上下文 RAG 时跳过它。

### 问：一个包含 50,000 份文档的知识库需要上下文检索。你如何管理摄取成本？

**强答案：**
四种策略：
1. **模型选择**：使用小型、快速模型（如 Claude Haiku 4.5 或 GPT-6 Luna）进行上下文化。输出是简短的事实性文本，不是创意写作。前沿模型只会增加成本而不会带来质量提升；最新 Claude Opus 和 Sonnet 模型还会产生无法完全关闭的思考 token。
2. **提示缓存**：在所有块的上下文化调用之间缓存完整文档文本，并集中调度同一文档的分块，使调用落在缓存有效期内。对于一个 10,000 token 的文档、30 个分块，这可将文档输入成本降低约 85%。
3. **分层策略**：不是每份文档都需要 LLM 上下文化。对于结构良好的文档（如 Markdown、带标题的 HTML），使用确定性的上下文块头（前置文档标题 + 章节层级），这是免费的。将 LLM 上下文化留给非结构化或含糊的文档。
4. **把上下文交给嵌入模型**：voyage-context-4 等上下文分块嵌入模型（每 100 万 token $0.12）无需逐块调用 LLM，即可生成感知文档上下文的分块向量。对于约 50,000 篇、每篇 8,000 token 的文档（共 4 亿 token），成本约 $50，而使用 Haiku 4.5 和缓存约需 $2,000。但它只帮助稠密检索，因此我会为 BM25 配上分块头，并在黄金测试集中仍有遗漏的文档上保留 LLM 上下文化。

### 问：上下文检索与 HyDE 在提升检索质量方面有何不同？

**强答案：**
它们解决的是同一问题的不同侧面。上下文检索在摄取时丰富**文档**（一次付费），而 HyDE 在搜索时丰富**查询**（按次付费）。对于一个每天处理 10,000 次查询、语料库规模为 50,000 个块的系统来说，上下文检索要便宜得多，因为摄取成本可以摊销。HyDE 也有幻觉风险 -- 假设文档可能引入错误数据。实践中，最强的系统会同时使用两者：用上下文检索做摄取增强，用 HyDE（或多查询扩展）处理需要查询侧帮助的复杂查询。

---

## 参考资料
- Anthropic. “Contextual Retrieval”（2024 年 9 月）
- Jina AI. “Late Chunking: Contextual Chunk Embeddings Using Long-Context Embedding Models”（2024）
- Voyage AI. “voyage-context-3: Contextualized Chunk Embeddings”（2025）
- Voyage AI. “voyage-context-4”（2026 年 6 月）
- Perplexity. “pplx-embed-v2-context-9b-preview”模型卡（Hugging Face，2026 年 9 月）
- NirDiamant. “RAG Techniques: Contextual Chunk Headers”（GitHub，2024）

---

*上一篇：[高级检索模式](09-advanced-retrieval-patterns.md) | 下一篇：[晚期交互与 ColBERT](11-late-interaction-colbert.md)*
