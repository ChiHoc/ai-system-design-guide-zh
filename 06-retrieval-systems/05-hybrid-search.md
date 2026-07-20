# 混合检索（Hybrid Search）

混合检索（Hybrid Search）将密集检索（dense / semantic retrieval）和稀疏检索（sparse / keyword retrieval）结合，以兼顾两者优势。它是生产环境 RAG 的基线：Elasticsearch 的 `rrf` 检索器、OpenSearch hybrid search、Weaviate、Qdrant 和 Azure AI Search 都默认提供原生混合检索流程。

## 目录

- [为何使用混合检索](#为何使用混合检索)
- [密集检索 vs 稀疏检索](#密集检索-vs-稀疏检索)
- [混合检索架构](#混合检索架构)
- [融合方法](#融合方法)
- [学习式稀疏嵌入（SPLADE）](#学习式稀疏嵌入-splade)
- [实现模式](#实现模式)
- [调优与优化](#调优与优化)
- [生产环境考虑](#生产环境考虑)
- [面试问题](#面试问题)
- [参考资料](#参考文献)

---

## 为何使用混合检索

无论是密集检索还是稀疏检索都不存在普适性优势。不同检索类型各擅长不同查询场景。

### 查询类型分析

| 查询类型 | 示例 | 更适合的检索 |
|------------|---------|------------------|
| 概念型 | "How do transformers learn?" | 密集检索 |
| 关键词特定 | "GPT-4 API rate limits" | 稀疏检索 |
| 命名实体 | "John Smith's research on BERT" | 稀疏检索 |
| 缩写/代码 | "What does HTTP 429 mean?" | 稀疏检索 |
| 释义改写 | "How to make AI faster" vs "LLM optimization" | 密集检索 |
| 混合型 | "What is the cost of GPT-4o API?" | 混合检索 |

**细微差异**：仅用密集检索在技术文档上会失效，因为具体版本号与函数名常常承载约 90% 的信息价值。

### 缺口问题

密集检索可能遗漏精确匹配：

```
Query: "Configure NVIDIA_VISIBLE_DEVICES"
Document: "Set the NVIDIA_VISIBLE_DEVICES environment variable..."

Dense search may miss this because:
- "NVIDIA_VISIBLE_DEVICES" might tokenize poorly
- Semantic embedding does not capture exact string matching
- Training data may not have this specific term
```

稀疏检索（BM25）能基于精确词元匹配立刻找到该结果。

---

## 密集检索 vs 稀疏检索

### 密集检索（语义检索）

使用神经网络嵌入进行语义匹配。

```python
def dense_search(query: str, top_k: int = 10) -> list[Result]:
    query_embedding = embedding_model.encode(query)
    results = vector_db.search(query_embedding, top_k=top_k)
    return results
```

**优势：**
- 理解释义改写与同义词
- 捕捉概念相似性
- 多语言下可用（借助多语言模型）

**劣势：**
- 可能遗漏精确关键词匹配
- 难以处理实体、代码、缩写
- 需要嵌入模型

### 稀疏检索（关键词检索）

使用词项频率与统计特征（BM25、TF-IDF）。

```python
def sparse_search(query: str, top_k: int = 10) -> list[Result]:
    tokens = tokenize(query)
    results = bm25_index.search(tokens, top_k=top_k)
    return results
```

**优势：**
- 擅长精确匹配
- 处理稀有词项、代码、实体更稳健
- 快速且可解释
- 无需训练

**劣势：**
- 难以捕捉语义相似度
- 不理解同义词
- 对词汇不匹配较敏感

### 逐项对比

| 维度 | 密集 | 稀疏 | 混合 |
|--------|-------|--------|--------|
| 语义匹配 | 最佳 | 较差 | 最佳 |
| 精确匹配 | 较差 | 最佳 | 最佳 |
| 稀有词项 | 较差 | 最佳 | 非常好 |
| 零样本领域 | 非常好 | 最佳 | 最佳 |
| 延迟 | 中等 | 快速 | 中等 |
| 实现难度 | 中等 | 简单 | 复杂 |

---

## 混合检索架构

### 架构 1：并行检索 + 融合

```
                    +------------------+
                    |      Query       |
                    +--------+---------+
                             |
              +--------------+--------------+
              v                             v
    +-------------------+         +-------------------+
    |  Dense Retrieval  |         |  Sparse Retrieval |
    |   (Vector DB)     |         |    (BM25/ES)      |
    +---------+---------+         +---------+---------+
              |                             |
              +--------------+--------------+
                             v
                    +-------------------+
                    |      Fusion       |
                    |  (RRF, weighted)  |
                    +---------+---------+
                              |
                              v
                    +-------------------+
                    |  Final Results    |
                    +-------------------+
```

**优点：** 职责清晰，可对每一端使用最佳组件（如 Pinecone + Algolia），并可独立调优  
**缺点：** 需要维护两个独立系统，延迟更高（需等待较慢引擎完成）

### 架构 2：原生混合（单一系统）

部分向量数据库原生支持混合检索：

```python
# Weaviate
results = client.query.get("Document", ["text"]).with_hybrid(
    query="Configure NVIDIA_VISIBLE_DEVICES",
    alpha=0.5  # 0 = sparse only, 1 = dense only
).do()

# Qdrant (with sparse vectors)
results = client.search(
    collection_name="docs",
    query_vector=NamedVector(name="dense", vector=dense_embedding),
    query_sparse_vector=NamedSparseVector(name="sparse", vector=sparse_vector),
)
```

**优点：** 单一系统、运维更简单、延迟更低  
**缺点：** 融合定制能力受限，对关键词与向量基础设施的扩展弹性较低

### 架构 3：分阶段检索

```
Query --> Sparse (fast, broad) --> Top 1000
                    |
                    v
          Dense reranking --> Top 100
                    |
                    v
           Cross-encoder --> Top 10
```

**优点：** 高效，每个阶段逐步优化  
**缺点：** 更复杂，早期阶段错误可能被放大

---

## 融合方法

### 倒数秩融合（Reciprocal Rank Fusion, RRF）

RRF 是结合两个检索引擎结果的黄金标准。它不看各引擎不可比的 *score*，而是看 **rank**。

```python
def reciprocal_rank_fusion(
    rankings: list[list[str]],  # List of doc_id lists
    k: int = 60
) -> list[tuple[str, float]]:
    scores = defaultdict(float)

    for ranking in rankings:
        for rank, doc_id in enumerate(ranking):
            scores[doc_id] += 1 / (k + rank + 1)

    sorted_docs = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return sorted_docs
```

**特性：**
- 基于位置，忽略原始分值
- 对分值尺度差异鲁棒，避免某个引擎因分值偏高而“支配”结果
- `k` 参数控制秩敏感性（更大的 `k` 表示对位置不那么敏感）
- 实现简单，除 `k` 外几乎无需调参

**典型 `k` 值：** 60（原始论文），实践中为 10-100

### 加权分值融合

将归一化后的分值进行组合：

```python
def weighted_fusion(
    dense_results: list[Result],
    sparse_results: list[Result],
    alpha: float = 0.5  # Weight for dense
) -> list[Result]:
    # Normalize scores to [0, 1]
    dense_normalized = normalize_scores(dense_results)
    sparse_normalized = normalize_scores(sparse_results)

    # Combine
    combined = {}
    for r in dense_normalized:
        combined[r.id] = alpha * r.score
    for r in sparse_normalized:
        combined[r.id] = combined.get(r.id, 0) + (1 - alpha) * r.score

    sorted_docs = sorted(combined.items(), key=lambda x: x[1], reverse=True)
    return sorted_docs

def normalize_scores(results: list[Result]) -> list[Result]:
    if not results:
        return []
    min_score = min(r.score for r in results)
    max_score = max(r.score for r in results)
    range_score = max_score - min_score + 1e-6

    return [
        Result(id=r.id, score=(r.score - min_score) / range_score)
        for r in results
    ]
```

**特性：**
- 使用实际分值（比秩信息更丰富）
- 需要分值归一化
- `alpha` 控制密集检索与稀疏检索的平衡

### 相对分值融合

考虑分值分布：

```python
def relative_score_fusion(
    dense_results: list[Result],
    sparse_results: list[Result]
) -> list[Result]:
    # Use z-score normalization
    dense_normalized = z_score_normalize(dense_results)
    sparse_normalized = z_score_normalize(sparse_results)

    # Combine
    combined = {}
    for r in dense_normalized:
        combined[r.id] = r.score
    for r in sparse_normalized:
        combined[r.id] = combined.get(r.id, 0) + r.score

    return sorted(combined.items(), key=lambda x: x[1], reverse=True)

def z_score_normalize(results: list[Result]) -> list[Result]:
    scores = [r.score for r in results]
    mean = sum(scores) / len(scores)
    std = (sum((s - mean) ** 2 for s in scores) / len(scores)) ** 0.5 + 1e-6

    return [Result(id=r.id, score=(r.score - mean) / std) for r in results]
```

### 融合方法对比

| 方法 | 使用分值 | 查询自适应 | 复杂度 |
|--------|-------------|----------------|------------|
| RRF | 否（仅排序） | 否 | 低 |
| 加权 | 是 | 否 | 低 |
| 相对分值 | 是 | 部分 | 中等 |
| 学习式 | 是 | 是 | 高 |

---

## 学习式稀疏嵌入（SPLADE）

生产体系已经从 BM25（简单词频统计）演进到混合检索中稀疏侧的 **学习式稀疏嵌入**。

**技术路径**：如 **SPLADE v3** 的模型会为词典中的每个词预测“重要性权重”。

**为什么这么做？**：SPLADE 能“扩展”查询。如果你搜索 “CPU”，它可能会自动给词 “processor” 加入一个小权重，即使该词不在原始查询中。它在单一存储格式下，将稀疏检索的精确匹配能力与密集检索的概念理解能力结合起来。

### SPLADE 实现

```python
from transformers import AutoModelForMaskedLM, AutoTokenizer

class SpladeEncoder:
    def __init__(self, model_name="naver/splade-cocondenser-ensembledistil"):
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForMaskedLM.from_pretrained(model_name)

    def encode(self, text: str) -> dict[str, float]:
        inputs = self.tokenizer(text, return_tensors="pt", truncation=True)
        outputs = self.model(**inputs)

        # Get sparse weights
        weights = torch.max(
            torch.log(1 + torch.relu(outputs.logits)) * inputs["attention_mask"].unsqueeze(-1),
            dim=1
        ).values.squeeze()

        # Convert to sparse dict
        non_zero = weights.nonzero().squeeze().tolist()
        sparse_vec = {
            self.tokenizer.decode([idx]): weights[idx].item()
            for idx in non_zero
            if weights[idx] > 0
        }

        return sparse_vec
```

**何时使用 SPLADE 而非 BM25 + 密集检索混合：** SPLADE 能生成可与稠密向量并列存储在现代向量数据库（如 Milvus 或 Qdrant）中的稀疏向量，从而在单次检索中完成混合检索，无需单独的 Elasticsearch 或 BM25 索引。如果你的数据集中存在极其稀有、非语言学型的词元（如独特序列号），且这些词可能在训练期间未出现过，则应坚持使用 BM25。

---

## 实现模式

### 模式 1：Elasticsearch + 向量数据库

```python
class HybridSearcher:
    def __init__(self, es_client, vector_db, embedding_model):
        self.es = es_client
        self.vector_db = vector_db
        self.embedding_model = embedding_model

    def search(self, query: str, top_k: int = 10, alpha: float = 0.5) -> list[Result]:
        # Parallel retrieval
        dense_future = self.dense_search(query, top_k * 3)
        sparse_future = self.sparse_search(query, top_k * 3)

        dense_results = dense_future.result()
        sparse_results = sparse_future.result()

        # Fusion
        combined = reciprocal_rank_fusion([
            [r.id for r in dense_results],
            [r.id for r in sparse_results]
        ])

        return combined[:top_k]

    async def dense_search(self, query: str, top_k: int) -> list[Result]:
        embedding = self.embedding_model.encode(query)
        return self.vector_db.search(embedding, top_k=top_k)

    async def sparse_search(self, query: str, top_k: int) -> list[Result]:
        response = self.es.search(
            index="documents",
            body={
                "query": {"match": {"content": query}},
                "size": top_k
            }
        )
        return [
            Result(id=hit["_id"], score=hit["_score"])
            for hit in response["hits"]["hits"]
        ]
```

### 模式 2：Weaviate 原生混合

```python
import weaviate

def hybrid_search_weaviate(
    client: weaviate.Client,
    query: str,
    alpha: float = 0.5,
    top_k: int = 10
) -> list[dict]:
    result = client.query.get(
        "Document",
        ["text", "title", "source"]
    ).with_hybrid(
        query=query,
        alpha=alpha,  # 0 = BM25 only, 1 = vector only
        fusion_type=weaviate.HybridFusion.RELATIVE_SCORE
    ).with_limit(top_k).do()

    return result["data"]["Get"]["Document"]
```

---

## 调优与优化

### Alpha 调优

`alpha` 参数用于平衡密集检索与稀疏检索：

```python
def find_optimal_alpha(
    test_queries: list[tuple[str, list[str]]],  # (query, relevant_doc_ids)
    alpha_range: list[float] = [0.0, 0.3, 0.5, 0.7, 1.0]
) -> float:
    best_alpha = 0.5
    best_ndcg = 0

    for alpha in alpha_range:
        ndcg_scores = []
        for query, relevant in test_queries:
            results = hybrid_search(query, alpha=alpha)
            ndcg = compute_ndcg(results, relevant)
            ndcg_scores.append(ndcg)

        avg_ndcg = sum(ndcg_scores) / len(ndcg_scores)
        if avg_ndcg > best_ndcg:
            best_ndcg = avg_ndcg
            best_alpha = alpha

    return best_alpha
```

**最佳实践 / 典型发现：**
- 技术文档和代码：`alpha` 0.3-0.4（偏关键词）
- 通用文本：`alpha` 0.5（平衡）
- 对话和创意探索：`alpha` 0.7-0.9（偏语义）

### 查询自适应 Alpha

为每个查询预测最优 `alpha`：

```python
def predict_alpha(query: str) -> float:
    # Heuristics-based
    has_quotes = '"' in query
    has_code = any(c in query for c in ['_', '()', '{}', '[]'])
    has_numbers = any(c.isdigit() for c in query)

    # More sparse for exact match queries
    if has_quotes or has_code:
        return 0.3
    if has_numbers:
        return 0.4

    # More semantic for natural language
    if len(query.split()) > 5:
        return 0.7

    return 0.5  # Default balanced
```

### 检索深度

融合前应抓取多少结果：

```python
# Rule of thumb: fetch 3-5x more from each source
def hybrid_search(query: str, final_k: int = 10):
    fetch_k = final_k * 4

    dense_results = dense_search(query, top_k=fetch_k)
    sparse_results = sparse_search(query, top_k=fetch_k)

    fused = rrf([dense_results, sparse_results])
    return fused[:final_k]
```

---

## 生产环境考虑

### 延迟预算

```
Typical hybrid search latency breakdown:

Dense embedding:           30-50ms
Dense retrieval:          30-50ms
Sparse retrieval:         20-40ms  (parallel with dense)
Fusion:                    1-5ms
Total:                   60-100ms
```

**优化建议：**
- 并行执行密集与稀疏检索
- 为常见查询预计算嵌入
- 两端都使用近似检索
- 对重复查询缓存融合结果

### 缓存策略

```python
class HybridSearchCache:
    def __init__(self, ttl_seconds: int = 300):
        self.cache = TTLCache(ttl=ttl_seconds)

    def search(self, query: str, **kwargs) -> list[Result]:
        cache_key = self._make_key(query, kwargs)

        if cache_key in self.cache:
            return self.cache[cache_key]

        results = self._do_search(query, **kwargs)
        self.cache[cache_key] = results
        return results

    def _make_key(self, query: str, kwargs: dict) -> str:
        return hashlib.sha256(
            f"{query}:{sorted(kwargs.items())}".encode()
        ).hexdigest()
```

### 回退策略

```python
def hybrid_search_with_fallback(query: str, top_k: int = 10) -> list[Result]:
    try:
        return hybrid_search(query, top_k=top_k)
    except DenseSearchError:
        # Fallback to sparse only
        return sparse_search(query, top_k=top_k)
    except SparseSearchError:
        # Fallback to dense only
        return dense_search(query, top_k=top_k)
```

---

## 面试问题

### Q: 什么时候会使用 **hybrid search（混合检索）** 而不是纯 **dense search（稠密检索）**？

**Strong answer（标准答案）:**
我会在以下情况下使用 hybrid search：

1. **查询包含特定术语（specific terms）时：** 产品代码、API 名称、错误码。纯 dense search 可能会漏掉精确匹配。

2. **领域具有专业词汇时：** 技术文档、法律、医疗。Sparse（稀疏检索）更能捕获具体术语。

3. **Zero-shot retrieval（零样本检索）时：** 新领域缺少经过微调的 embedding 模型。Sparse（稀疏检索）能提供更稳健的基线。

4. **质量要求很高时：** Hybrid search 通常不会比单一方案更差，但会增加系统复杂度。

**我会坚持使用纯 dense search 的情况：**
- 查询几乎完全是概念性/语义性表达
- 延迟预算非常紧张
- 更看重架构简洁性
- Embedding model（嵌入模型）已针对该领域充分调优

该决策是经验驱动的。我会在实际查询分布上对 hybrid 与 dense 做 **A/B test（A/B 测试）** 对比评估。

### Q: 为什么 Reciprocal Rank Fusion（RRF）比“Simple Score Addition（简单分数相加）”更安全？

**Strong answer（标准答案）:**
Simple score addition（简单分数相加）不安全，因为向量分数（例如 Cosine Similarity（余弦相似度）：0.0 到 1.0）与关键词分数（例如 BM25：0 到无穷大）使用了完全不同的尺度。一次幸运的关键词高匹配可能产生极高 BM25 分数，把 10 个高相关的语义匹配结果“淹没”。RRF 会忽略绝对分数，只关注相对顺序（rank）。这使其在不同检索引擎中的异常值和“score-drift（分数漂移）”方面更具数学鲁棒性。

### Q: 什么时候会选择 SPLADE 而不是标准的 BM25 + Dense Hybrid（BM25+稠密混合）方案？

**Strong answer（标准答案）:**
我会在需要简化基础设施时选择 SPLADE。SPLADE 会生成一个 sparse vector（稀疏向量），可以与 dense vector（稠密向量）一起存储在许多现代 vector databases（向量数据库，如 Milvus 或 Qdrant）中。这使数据库能够在单次检索中执行“Hybrid search（混合检索）”，无需单独的 Elasticsearch 或 BM25 索引。然而，如果我的数据集包含极其罕见、非语言型 token（如唯一序列号），这些 token 可能在神经网络训练中未出现过，我会坚持使用 BM25。

### Q: 在 hybrid search 中如何平衡 dense 与 sparse？

**Strong answer（标准答案）:**
alpha 参数控制这种平衡（通常 alpha 表示 dense 的权重）：

**调参方法:**
1. 从 alpha=0.5 开始（等权）
2. 使用带查询和相关性标注的评估集
3. 在 `[0.1, 0.3, 0.5, 0.7, 0.9]` 上做网格搜索
4. 在每个取值下测量 NDCG 或 MRR
5. 选择使评估指标最大的 alpha

**查询自适应调参（Query-adaptive tuning）:**
- 检测查询类型（keyword-heavy（偏关键词）、conceptual（偏语义）、mixed（混合））
- 按查询动态调整 alpha
- 可以使用简单规则或学习型分类器

**经验法则（Rule of thumb）:**
- 技术/代码类查询：alpha 0.3-0.4
- 一般文本：alpha 0.5
- 对话式查询：alpha 0.7-0.8

---

## 参考文献

- Cormack et al. "Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods"（2009）
- Formal et al. "SPLADE: Sparse Lexical and Expansion Model for First Stage Ranking"（2021/2025）
- Weaviate Hybrid Search: https://weaviate.io/developers/weaviate/search/hybrid
- Qdrant Hybrid Search: https://qdrant.tech/documentation/concepts/hybrid-queries/

---

*上一页: [向量数据库](04-vector-databases.md) | 下一页: [重排序策略](06-reranking-strategies.md)*
