# 重排序策略

Reranking（重排序）是检索的第二阶段，使用高精度模型对一小组候选结果（Top 50-100）重新打分。它是“高效搜索（efficient search）”与“完美 grounding（事实对齐）”之间的桥梁：第一阶段检索优化召回率（recall），重排序优化精确率（precision）。当前生产环境中占主导地位的三种 reranker（重排序器）是 BGE-Reranker-v2-m3、Cohere Rerank 3、Voyage rerank-2，选择主要取决于成本模型、延迟尾部（latency tail）、语言覆盖范围，以及是否需要可自托管权重（self-hostable weights）。

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
- 使用 **Attention Mechanism（注意力机制）** 来比较查询中的具体词语如何改变文档中词语的含义（late interaction，后期交互）

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

| 模型 | 规模 | 语言 | 质量 |
|-------|------|-----------|---------|
| ms-marco-MiniLM-L-6 | 22M | 英语 | 良好 |
| bge-reranker-base | 278M | 英语 | 很好 |
| **bge-reranker-v2-m3** | 568M | 多语言 | 优秀 |
| Cohere Rerank v3 | API | 多语言 | 优秀 |
| Jina Reranker v2 | 多种 | 多语言（8k+ tokens） | 很好 |

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

co = cohere.Client(api_key="...")

def cohere_rerank(
    query: str,
    documents: list[str],
    top_k: int = 5
) -> list[dict]:
    response = co.rerank(
        model="rerank-english-v3.0",
        query=query,
        documents=documents,
        top_n=top_k,
        return_documents=True
    )

    return [
        {
            "text": result.document.text,
            "score": result.relevance_score,
            "index": result.index
        }
        for result in response.results
    ]
```

### 模型选择指南

| 使用场景 | 推荐模型 | 说明 |
|----------|-------------------|-------|
| 英语，需自托管 | bge-reranker-base | 平衡性好 |
| 多语言 | bge-reranker-v2-m3 | 最佳开源方案 |
| 低延迟 | MiniLM-L-6 | 快 4 倍 |
| 最高质量 | Cohere Rerank v3 | API，规模化成本较高 |
| 大批量 | Jina Reranker | 吞吐量好 |
| 长查询（8k+） | Jina Reranker v2 | 可处理长上下文 |

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
    model: str = "gpt-4o-mini"
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

**Listwise 通常更好**，因为 LLM 可以直接比较文档。前沿模型（例如 o1-mini 或 Sonnet 3.7）在这方面非常强，但会额外增加 1-2s 延迟。通常只用于高风险企业搜索（法律、医疗）。

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

为了解决基于 LLM 的重排序延迟问题，我们现在使用 **Distilled Small Language Models（蒸馏小语言模型，SLM）**。

- **过程**：取一个大模型（例如 GPT-5.2），让它对 100 万个成对样本进行重排序，并使用这些标签把一个 0.1B 参数的小模型“蒸馏”出来。
- **结果**：你可以获得巨型模型 95% 的重排序质量，同时具备标准 CPU 查询的延迟（< 10ms）。
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
Bi-Encoder（双编码器）会在知道任何查询之前，就为文档创建一个单一、静态的向量表示。这会丢失文本不同部分之间的具体关系。Cross-Encoder（交叉编码器）会把查询和文档作为一个单独的输入对，并使用 **Attention Mechanism（注意力机制）** 来比较它们。它能够看到查询中的特定词语如何改变文档中词语的含义（late interaction，后期交互），因此比两个固定向量的简单数学相似度更能进行细致的相关性评分。

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
长查询会给 cross-encoders（交叉编码器）带来 "Token Budget（令牌预算）" 问题，因为它们通常只有 512 或 1024 token 的限制。常见的解决办法是 **Sliding Window Reranking（滑动窗口重排）** 或 **Query Summarization（查询摘要）**。另外，也可以使用像 **Jina-Reranker-v2** 这样的专用模型来处理 8k+ tokens。另一种常见做法是先用快速的短上下文模型进行 "First-Pass Rerank（第一轮重排）"，再对前 5 个候选项使用高上下文 LLM 进行 "Second-Pass Rerank（第二轮重排）"。

---

## 参考资料

- Nogueira and Cho. "Passage Re-ranking with BERT" (2019)
- Nogueira et al. "Multi-Stage Document Ranking with BERT" (2019/2025 update)
- BAAI BGE Reranker: https://huggingface.co/BAAI/bge-reranker-base
- Cohere Rerank: https://docs.cohere.com/docs/rerank
- Sun et al. "Is ChatGPT Good at Search? Investigating Large Language Models as Re-Ranking Agents" (2023)

---

*上一篇: [Hybrid Search](05-hybrid-search.md) | 下一篇: [GraphRAG](07-graph-rag.md)*
