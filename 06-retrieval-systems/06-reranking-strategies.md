# 重排序策略

Reranking（重排序）是检索的第二阶段，使用高精度模型对一小组候选结果（Top 50-100）重新打分。它是“高效搜索（efficient search）”与“完美 grounding（事实对齐）”之间的桥梁：第一阶段检索优化召回率（recall），重排序优化精确率（precision）。截至 2026 年 10 月，生产中常见的托管方案有 Cohere Rerank 4（Fast 和 Pro）、Voyage rerank-3 / rerank-3-lite；开放权重方案有 Qwen3-Reranker 和 bge-reranker-v2-m3。选择取决于成本模式、尾部延迟、上下文长度、语言覆盖、许可证，以及是否需要自行托管权重。

## 目录

- [为什么需要重排序](#为什么需要重排序)
- [重排序架构](#重排序架构)
- [重排序模型](#重排序模型)
- [实现模式](#实现模式)
- [何时进行重排序](#何时进行重排序)
- [基于 LLM 的重排序](#基于-llm-的重排序)
- [SLM 蒸馏](#slm-蒸馏)
- [生产环境注意事项](#生产环境注意事项)
- [面试问题](#面试问题)
- [参考资料](#参考资料)

---

## 为什么需要重排序

### 质量差距

| 阶段 | 模型 | 速度 | 质量 |
|-------|-------|-------|---------|
| 向量检索（Embedding retrieval） | Bi-encoder（双编码器） | 快（ms） | 良好 |
| 重排序 | Cross-encoder（交叉编码器） | 慢（10-100ms） | 更好 |

**差距存在的原因：**
- Bi-encoder 分别独立编码查询和文档
- Cross-encoder 联合处理查询和文档
- 联合处理能捕获 bi-encoder 无法看到的交互信息

### 示例

```
Query: "How to configure CUDA memory"

Document 1: "Configure GPU memory using CUDA_VISIBLE_DEVICES..."
Document 2: "Memory management in CUDA applications..."
Document 3: "Configure RAM allocation for machine learning..."

Bi-encoder scores (cosine similarity):
- Doc 1: 0.72
- Doc 2: 0.75  <-- Ranked first (wrong)
- Doc 3: 0.71

Cross-encoder scores (relevance):
- Doc 1: 0.91  <-- Ranked first (correct)
- Doc 2: 0.67
- Doc 3: 0.42
```

Cross-encoder（交叉编码器）能够看出查询中的 “CUDA memory” 与文档 1 中的 “GPU memory...CUDA” 存在关联。

---

## 重排序架构

### Bi-encoder 与 Cross-encoder

**Bi-encoder（第一阶段）：**
```
Query --> Encoder --> Query Embedding -+
                                      +-> Similarity
Document --> Encoder --> Doc Embedding +
```
- 每篇文档的复杂度为 O(1)（向量已预先计算）
- 无法看到查询-文档交互

**Cross-encoder（重排序）：**
```
[Query, Document] --> Encoder --> Relevance Score
```
- 每个查询的复杂度为 O(n)（逐个处理候选）
- 可以看到完整的查询-文档上下文
- 使用 **Attention Mechanism（注意力机制）** 比较查询中的具体词语如何改变文档中词语的含义（这是完整的早期交互；ColBERT 的“后期交互”处于它与双编码器之间）

### 两阶段流水线

生产检索通常使用两阶段漏斗：

```
+----------------------------------------------------------------+
|  STAGE 1: Retrieval (Bi-Encoder)                                |
|                                                                 |
|  Query --> Embed --> Top-K candidates (K=100)                   |
|  Scale: Search 1 Billion docs. Cost: Low (ms).                 |
+----------------------------+-----------------------------------+
                             |
                             v
+----------------------------------------------------------------+
|  STAGE 2: Reranking (Cross-Encoder)                             |
|                                                                 |
|  For each candidate:                                            |
|    score = reranker([query, candidate])                         |
|  Scale: Search Top 100 docs. Cost: High (10-100ms).            |
|                                                                 |
|  Return Top-N by reranker score (N=5-10)                        |
+----------------------------------------------------------------+
```

### 多阶段流水线

对于非常大的语料库：

```
Stage 1: Sparse (BM25)      -> Top 1000
Stage 2: Dense (Bi-encoder) -> Top 100
Stage 3: Cross-encoder      -> Top 10
```

每个阶段都在速度和准确率之间进行权衡。

---

## 重排序模型

### Cross-encoder 模型

| 模型 | 规模 / 访问方式 | 上下文 | 许可证或价格 | 说明 |
|-------|---------------|---------|------------------|-------|
| ms-marco-MiniLM-L-6 | 22M，开放权重 | 512 | Apache 2.0 | 英语，适合 CPU 的基线 |
| bge-reranker-base | 278M，开放权重 | 512 | MIT | 英语 |
| **bge-reranker-v2-m3** | 568M，开放权重 | 模型卡示例中为 512（基础模型为 8K） | Apache 2.0 | 多语言常用模型 |
| **Cohere Rerank 4**（`rerank-v4.0-fast` / `-pro`） | API | 32K | 按用量付费的 API | 2025 年 12 月宣布；继任 Rerank 3.5（4,096 token 上下文） |
| **Voyage rerank-3 / rerank-3-lite** | API | 32K | 每 1M token $0.05 / $0.02 | 2026 年 9 月 30 日发布；价格和 API 与 rerank-2.5 相同，基于 2.5 调整的分数阈值仍可用 |
| **Qwen3-Reranker-8B** | 8B，开放权重 | 32K | Apache 2.0 | 表现强的开放权重文本重排序器（2025 年 6 月） |
| **Qwen3-VL-Reranker-2B / 8B** | 开放权重 | 32K | Apache 2.0 | 多模态（文本、图像、页面截图），2026 年 1 月 |
| jina-reranker-v3.5 | 0.6B，开放权重 | 长上下文 | CC BY-NC 4.0（非商业） | 基于 Qwen3-0.6B 的列表式重排序器；商业用途需通过 Jina API 或另行取得许可 |
| LightOn-rerank | 0.8B / 2B / 4B，开放权重 | 长上下文 | 查看模型卡 | 基于 Qwen3.5 的逐点式和列表式变体（2026 年 7 月） |

Voyage 报告称，rerank-3 相比 rerank-2.5 总体提升 0.96%、长文档提升 3.35%；相比 Cohere Rerank v4.0 Pro 总体提升 2.72%、长文档提升 13.84%（供应商自报，涵盖 95 个数据集及 MAIR）。这些数字更适合用来判断增益集中在哪些场景（长文档与遵循指令的相关性），不宜当作中立排名。

**“Lost in the Middle” 修复**：重排序器的训练目标是优先关注与位置无关的相关信息，确保“中间”位置的数据在送入最终 LLM 之前被正确评分。

### 使用 Cross-encoder

```python
from sentence_transformers import CrossEncoder

# Load model
reranker = CrossEncoder('BAAI/bge-reranker-base')

def rerank(query: str, documents: list[str], top_k: int = 5) -> list[tuple[str, float]]:
    # Create pairs
    pairs = [[query, doc] for doc in documents]

    # Score all pairs
    scores = reranker.predict(pairs)

    # Sort by score
    scored_docs = sorted(
        zip(documents, scores),
        key=lambda x: x[1],
        reverse=True
    )

    return scored_docs[:top_k]
```

### Cohere Rerank

```python
import cohere

co = cohere.ClientV2()  # reads CO_API_KEY from the environment

def cohere_rerank(
    query: str,
    documents: list[str],
    top_k: int = 5
) -> list[dict]:
    response = co.rerank(
        model="rerank-v4.0-pro",  # or "rerank-v4.0-fast" for lower latency
        query=query,
        documents=documents,
        top_n=top_k,
    )

    # v2 results carry index and relevance_score; map back to the input list
    return [
        {
            "text": documents[result.index],
            "score": result.relevance_score,
            "index": result.index
        }
        for result in response.results
    ]
```

### 模型选择指南

| 使用场景 | 推荐模型 | 说明 |
|----------|-------------------|-------|
| 英语、自托管、CPU | bge-reranker-base 或 MiniLM-L-6 | MiniLM 快约 4 倍，但质量较低 |
| 多语言、自托管 | bge-reranker-v2-m3 或 Qwen3-Reranker | 若有 GPU，长输入可选 Qwen3 |
| 最高质量、托管服务 | Cohere Rerank 4 Pro 或 Voyage rerank-3 | 用自己的数据比较两者；供应商数字不一致 |
| 成本敏感的托管服务 | Voyage rerank-3-lite 或 Cohere Rerank 4 Fast | rerank-3-lite 每 1M token 为 $0.02 |
| 长文档或工具输出（8K+） | 任一 32K 重排序器（Cohere Rerank 4、Voyage rerank-3、Qwen3） | 截断已非主要限制；每个文本对的 token 数才是成本 |
| 页面截图、图表 | Qwen3-VL-Reranker | Apache 2.0，多模态 |

**成本估算：**对 50 个各约 500 token 的候选重排序，每次查询约处理 25K token。按 Voyage rerank-3 每 1M token $0.05 计算，每次查询约 $0.00125；每日 1M 次查询约 $1,250。按 token 计费意味着长文本块和更深的候选列表会线性增加费用，因此候选深度和文本块长度既影响延迟，也影响成本。

---

## 实现模式

### 模式 1：基础重排序

```python
class RerankedRetriever:
    def __init__(
        self,
        vector_db,
        embedding_model,
        reranker,
        retrieval_k: int = 50,
        rerank_k: int = 5
    ):
        self.vector_db = vector_db
        self.embedding_model = embedding_model
        self.reranker = reranker
        self.retrieval_k = retrieval_k
        self.rerank_k = rerank_k

    def search(self, query: str) -> list[Document]:
        # Stage 1: Retrieve candidates
        query_embedding = self.embedding_model.encode(query)
        candidates = self.vector_db.search(
            query_embedding,
            top_k=self.retrieval_k
        )

        # Stage 2: Rerank
        pairs = [[query, c.text] for c in candidates]
        scores = self.reranker.predict(pairs)

        # Combine and sort
        for candidate, score in zip(candidates, scores):
            candidate.rerank_score = score

        reranked = sorted(candidates, key=lambda x: x.rerank_score, reverse=True)
        return reranked[:self.rerank_k]
```

### 模式 2：批量重排序

```python
def batch_rerank(
    queries: list[str],
    candidates_per_query: list[list[str]],
    reranker,
    batch_size: int = 32
) -> list[list[tuple[str, float]]]:
    # Flatten all pairs
    all_pairs = []
    pair_mapping = []  # (query_idx, doc_idx)

    for q_idx, (query, candidates) in enumerate(zip(queries, candidates_per_query)):
        for d_idx, doc in enumerate(candidates):
            all_pairs.append([query, doc])
            pair_mapping.append((q_idx, d_idx))

    # Batch score
    all_scores = []
    for i in range(0, len(all_pairs), batch_size):
        batch = all_pairs[i:i + batch_size]
        scores = reranker.predict(batch)
        all_scores.extend(scores)

    # Reconstruct per-query results
    results = [[] for _ in queries]
    for (q_idx, d_idx), score in zip(pair_mapping, all_scores):
        results[q_idx].append((candidates_per_query[q_idx][d_idx], score))

    # Sort each query's results
    for i in range(len(results)):
        results[i].sort(key=lambda x: x[1], reverse=True)

    return results
```

### 模式 3：异步重排序

```python
import asyncio

class AsyncReranker:
    def __init__(self, reranker, max_concurrent: int = 5):
        self.reranker = reranker
        self.semaphore = asyncio.Semaphore(max_concurrent)

    async def rerank_async(
        self,
        query: str,
        documents: list[str]
    ) -> list[tuple[str, float]]:
        async with self.semaphore:
            # Run reranking in thread pool
            loop = asyncio.get_event_loop()
            scores = await loop.run_in_executor(
                None,
                lambda: self.reranker.predict([[query, doc] for doc in documents])
            )
            return sorted(zip(documents, scores), key=lambda x: x[1], reverse=True)
```

---

## 何时进行重排序

### 成本-收益分析

| 因素 | 不进行重排序 | 进行重排序 |
|--------|-------------------|----------------|
| 延迟 | 50-100ms | 150-300ms |
| 质量（NDCG） | 0.65 | 0.78 |
| 复杂度 | 简单 | 中等 |
| 成本 | 基线 | +API 成本 或 +算力成本 |

### 决策框架

**始终进行重排序的情况：**
- 质量至关重要（面向客户、高风险场景）
- 检索到的候选结果分数接近
- 查询复杂或由多个部分组成
- 预算允许增加延迟

**跳过重排序的情况：**
- 延迟预算非常紧（总计 <100ms）
- 检索到的候选结果已经明显排序清晰
- 简单查询（单词检索）
- 大规模场景下成本受限

### 推理时间权衡

| 阶段 | 检索（K） | 重排序（N） | 延迟 | 质量 |
|-------|---------------|------------|---------|---------|
| **朴素方案** | 5 | 0 | 50ms | 低 |
| **标准方案** | 50 | 5 | 150ms | 高 |
| **企业方案**| 200 | 20 | 500ms | 最高 |

**关键规则**：如果你有 200ms 的预算，就把 50ms 用于检索、150ms 用于重排序。对 Top 50 结果进行重排序，通常比从向量数据库中再多检索一些 chunk（片段）带来更高的 ROI（投资回报率）。

### 最优候选数量

在重排序之前应该检索多少候选：

```python
def optimize_candidate_count(test_set, retriever, reranker):
    """Find optimal retrieval_k for reranking."""
    results = {}

    for retrieval_k in [10, 20, 50, 100, 200]:
        ndcg_scores = []
        latencies = []

        for query, relevant_docs in test_set:
            start = time.time()

            # Retrieve
            candidates = retriever.search(query, top_k=retrieval_k)

            # Rerank to top 5
            reranked = reranker.rerank(query, candidates, top_k=5)

            latency = time.time() - start
            latencies.append(latency)

            ndcg = compute_ndcg(reranked, relevant_docs)
            ndcg_scores.append(ndcg)

        results[retrieval_k] = {
            "ndcg": mean(ndcg_scores),
            "latency_p99": percentile(latencies, 99)
        }

    return results

# Typical findings:
# K=20:  NDCG 0.72, latency 120ms
# K=50:  NDCG 0.76, latency 180ms  <-- Often sweet spot
# K=100: NDCG 0.77, latency 280ms  <-- Diminishing returns
```

---

## 基于 LLM 的重排序

### 使用 LLM 作为重排序器

LLM 可以对相关性打分，但成本较高：

```python
def llm_rerank(
    query: str,
    documents: list[str],
    model: str = "gpt-6-luna"
) -> list[tuple[str, float]]:
    prompt = f"""Rate the relevance of each document to the query.
Query: {query}

Documents:
{format_documents(documents)}

For each document, output a relevance score from 0-10.
Format: DOC_NUM: SCORE
"""

    response = llm.generate(prompt)
    scores = parse_scores(response)

    return sorted(zip(documents, scores), key=lambda x: x[1], reverse=True)
```

**优点：**
- 能处理复杂的相关性判断
- 能理解细微语义和上下文
- 不需要单独维护模型

**缺点：**
- 规模化成本高（比 cross-encoder 高 10-100 倍）
- 更慢（1-3s vs 100ms）
- 非确定性

**数据说明：**《The Embedder's Dilemma》（arXiv 2608.12875，2026 年 8 月）在 37 项 MTEB 风格任务上比较了 10 个 LLM 与 26 个嵌入模型。最佳 LLM 与最佳嵌入模型的总体成绩接近（77.6 对 77.2），但成本最高相差 1,431 倍；LLM 在推理密集型检索中领先，嵌入模型在分类任务中领先。推理 token 占 LLM 成本的 28% 至 81%，较低的推理预算通常仍能保持检索质量。因此，只有在查询需要推理时，才对最后少量候选使用 LLM，并在评测集上选择能维持质量的最低推理档位。

### Listwise 与 Pointwise LLM 重排序

**Pointwise**：独立对每个文档打分  
```
For document: [doc text]
Query: [query]
Rate relevance 0-10: _
```

**Listwise**：把所有文档放在一起排序  
```
Query: [query]
Rank these documents by relevance:
A: [doc1]
B: [doc2]
C: [doc3]
Output order: _
```

**Listwise 通常更好**，因为 LLM 可以直接比较文档。当前的小型模型（GPT-6 Luna、Claude Haiku 4.5）让低推理档位的列表式排序值得尝试，但须在评测集上检查质量，而且它仍会增加 1–2s 延迟，因此宜留给法律、医疗等高风险企业搜索。专用列表式重排序器（jina-reranker-v3.5、LightOn-rerank 的列表式变体）则能以交叉编码器级延迟进行跨文档比较。

### 多文档滑动窗口

```python
def sliding_window_rerank(
    query: str,
    documents: list[str],
    window_size: int = 10,
    step: int = 5
) -> list[str]:
    """Rerank many documents with LLM using sliding window."""
    ranked = list(range(len(documents)))

    for start in range(0, len(documents), step):
        window = ranked[start:start + window_size]

        # LLM ranks this window
        window_docs = [documents[i] for i in window]
        window_order = llm_listwise_rank(query, window_docs)

        # Update rankings
        for new_pos, old_idx in enumerate(window_order):
            ranked[start + new_pos] = window[old_idx]

    return [documents[i] for i in ranked]
```

---

## SLM 蒸馏

为降低基于 LLM 的重排序延迟，可以将 LLM 的判断蒸馏到**小型交叉编码器（SLM）**中。

- **过程**：使用前沿模型对 100 万个成对样本进行重排序，再用这些标签“蒸馏”一个 0.1B 参数的小模型。若使用商业 API 的输出训练模型，应先核对提供商条款。
- **结果**：学生模型以交叉编码器的延迟运行（本章预算中，50 个候选约需 100–200ms，而 LLM 一轮为 1–3s），并在领域内查询上保留教师模型的大部分排序质量。具体保留程度取决于语料库，领域外差距会扩大，因此停用 LLM 路径前应在黄金测试集上与教师模型比较 NDCG@10。
- **生产模式**：平时使用 cross-encoder，在重排序分数置信度较低时用 LLM 兜底。

---

## 生产环境注意事项

### 延迟优化

```python
class OptimizedReranker:
    def __init__(self, model_name: str, device: str = "cuda"):
        self.model = CrossEncoder(model_name, device=device)
        # Enable optimizations
        self.model.model.half()  # FP16

    def rerank(self, query: str, documents: list[str]) -> list[tuple[str, float]]:
        with torch.inference_mode():
            pairs = [[query, doc] for doc in documents]
            scores = self.model.predict(
                pairs,
                batch_size=32,
                show_progress_bar=False
            )
        return sorted(zip(documents, scores), key=lambda x: x[1], reverse=True)
```

**优化技术：**
- FP16 推理：2x 加速
- 批处理：摊销开销
- ONNX 导出：1.5-2x 加速
- TensorRT：2-3x 加速（NVIDIA）
- 模型蒸馏：在质量折衷下实现 4x 加速

### 重排序之后：多样性与业务规则

重排序器独立评估每个候选，因此同一来源的三个近乎相同的文本块可能占据前三名。应在相关性评分**之后**应用多样性（MMR）与业务规则（新鲜度衰减、“优先官方文档”），否则重排序器会抵消这些规则。一些引擎现已在数据库内提供这类能力：Weaviate 1.39 正式发布 MMR 和 Boost API（可按过滤条件、属性、时间或数值衰减提升或降低排序）；Milvus 3.0 的 Function Chain 可在服务端组合重新评分与重排序阶段。

### 缓存重排序结果

```python
class CachedReranker:
    def __init__(self, reranker, cache_ttl: int = 3600):
        self.reranker = reranker
        self.cache = TTLCache(maxsize=10000, ttl=cache_ttl)

    def rerank(self, query: str, documents: list[str]) -> list[tuple[str, float]]:
        # Cache key includes query and doc hashes
        key = self._make_key(query, documents)

        if key in self.cache:
            return self.cache[key]

        result = self.reranker.rerank(query, documents)
        self.cache[key] = result
        return result

    def _make_key(self, query: str, documents: list[str]) -> str:
        doc_hash = hashlib.sha256(
            "".join(sorted(documents)).encode()
        ).hexdigest()[:16]
        query_hash = hashlib.sha256(query.encode()).hexdigest()[:16]
        return f"{query_hash}:{doc_hash}"
```

### 兜底策略

```python
def rerank_with_fallback(
    query: str,
    candidates: list[Document],
    primary_reranker,
    timeout: float = 2.0
) -> list[Document]:
    try:
        # Try reranking with timeout
        result = timeout_call(
            primary_reranker.rerank,
            args=(query, candidates),
            timeout=timeout
        )
        return result
    except TimeoutError:
        # Fallback: return original order
        logger.warning("Reranker timeout, using original order")
        return candidates
    except Exception as e:
        logger.error(f"Reranker error: {e}")
        return candidates
```

---

## 面试问题

### Q: 为什么 Cross-Encoder（交叉编码器）从根本上比 Bi-Encoder（双编码器）更准确？

**标准答案：**
Bi-Encoder（双编码器）会在知道任何查询之前，就为文档创建一个单一、静态的向量表示。这会丢失文本不同部分之间的具体关系。Cross-Encoder（交叉编码器）会把查询和文档作为一个单独的输入对，并使用 **Attention Mechanism（注意力机制）** 来比较它们。它能够在每一层看到查询中的特定词语如何改变文档中词语的含义（完整的交叉注意力，而非 ColBERT 式后期交互），因此比两个固定向量的简单数学相似度更能进行细致的相关性评分。

**在实践中：** 第一阶段检索（速度）使用 bi-encoder（双编码器），重排（质量）使用 cross-encoder（交叉编码器）。这样可以兼顾两者的优点。

### Q: 你如何决定要重排多少个候选项？

**标准答案：**
这是质量和延迟之间的权衡：

**因素：**
- 重排器（reranker）每篇文档的延迟
- 总延迟预算
- 质量提升曲线（通常是边际收益递减）
- 第一阶段检索质量

**流程：**
1. 对重排器每篇文档的延迟进行基准测试
2. 根据延迟预算计算最大候选数
3. 在不同 K 值下测试质量
4. 找到拐点（质量 vs 延迟）

**典型发现：**
- K=20-50 往往是最优区间
- 超过 K=100 后，质量提升很小
- 根据第一阶段检索质量进行调整

对于一个 200ms 的重排预算、每篇文档 4ms 的情况，我会重排大约 50 个候选项。

### Q: 什么时候会使用基于 LLM 的重排？

**标准答案：**
在以下情况下，基于 LLM 的重排是合理的：

1. **复杂相关性判断：** 查询需要理解细微差别、上下文或多跳推理
2. **低流量：** 无法证明训练/部署一个 cross-encoder（交叉编码器）的成本合理
3. **需要最高质量：** 法律、医疗、安全关键
4. **流水线中已在使用 LLM：** 边际成本更低

**注意事项：**
- 规模化时成本高（比 cross-encoder 高 10-100 倍）
- 更慢（1-3s vs 100ms）
- 非确定性
- 可能需要谨慎的 prompt engineering（提示词工程）

**生产模式：** 平时使用 cross-encoder（交叉编码器），在重排得分置信度较低时用 LLM 作为回退方案。

### Q: 如何处理极长查询的重排（例如一整段文本）？

**标准答案：**
经典的 BERT 规模交叉编码器（MiniLM、bge-reranker-base）上限为 512 token，因此长查询和长文本块会被截断。过去的解决方法是 **Sliding Window Reranking（滑动窗口重排）**或 **Query Summarization（查询摘要）**。当前重排序器改变了限制：Cohere Rerank 4、Voyage rerank-3 和 Qwen3 重排序器支持 32K token，因此问题转为每个文本对的成本与延迟，而非截断，因为按 token 计费和注意力计算成本都会随输入长度增加。我的做法是先用截短的文本块快速重排 50 个候选，再对前 5 至 10 个候选使用 32K 重排序器处理全文。这在智能体式 RAG 中尤为重要：此时“文档”是较长的工具输出，查询则是一段自然语言相关性标准，恰好也是 Voyage 自报 rerank-3 增益最大的场景（长文档和 MAIR 指令遵循测试集）。

---

## 参考资料

- Nogueira and Cho. "Passage Re-ranking with BERT" (2019)
- Nogueira et al. "Multi-Stage Document Ranking with BERT" (2019/2025 update)
- BAAI BGE Reranker: https://huggingface.co/BAAI/bge-reranker-base
- Cohere Rerank: https://docs.cohere.com/docs/rerank
- [Voyage AI. “rerank-3”（2026 年 9 月）](https://blog.voyageai.com/2026/09/30/rerank-3/)
- [“The Embedder's Dilemma”（arXiv 2608.12875，2026 年 8 月）](https://arxiv.org/abs/2608.12875)
- Sun et al. "Is ChatGPT Good at Search? Investigating Large Language Models as Re-Ranking Agents" (2023)

---

*上一篇: [Hybrid Search](05-hybrid-search.md) | 下一篇: [GraphRAG](07-graph-rag.md)*
