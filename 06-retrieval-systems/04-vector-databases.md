# 向量数据库

向量数据库是专为存储、索引和搜索高维嵌入而设计的系统。市场已经分化为 **托管无服务器** 和 **专用高性能** 两类引擎。我们不再问“它支持向量搜索吗？”（Postgres、Redis 和 Mongo 都支持）。我们问的是 **“它能否扩展到 100M+ 个向量，并且在 P99 低于 100ms 的情况下支持完整元数据过滤？”**

## 目录

- [什么是向量数据库](#什么是向量数据库)
- [向量搜索基础](#向量搜索基础)
- [索引算法](#索引算法)
- [竞争格局](#竞争格局)
- [数据库详细对比](#数据库详细对比)
- [元数据过滤](#元数据过滤)
- [查询模式](#查询模式)
- [生产运维](#生产运维)
- [托管版与自托管版（TCO 分析）](#托管-vs-自托管-tco-分析)
- [选型框架](#选型框架)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 什么是向量数据库

向量数据库用于存储嵌入（稠密向量）并支持对其进行快速相似度搜索。

```
Traditional DB:      SELECT * FROM docs WHERE category = 'tech'
Vector DB:           SELECT * FROM docs ORDER BY similarity(embedding, query_embedding) LIMIT 10
```

### 核心能力

| 能力 | 目的 |
|------------|---------|
| 向量存储 | 持久化高维嵌入 |
| 相似度搜索 | 快速找到最近邻 |
| 元数据过滤 | 将向量搜索与属性过滤结合 |
| CRUD 操作 | 随数据变化更新嵌入 |
| 扩展性 | 处理百万到数十亿级向量 |

### 为什么不用通用数据库？

传统数据库可以存向量，但缺少优化过的搜索能力：

| 方法 | 搜索复杂度 | 在大规模场景下是否实用 |
|----------|-------------------|-------------------|
| 暴力搜索（PostgreSQL pgvector） | O(n * d) | 约可支撑到 1M 个向量 |
| ANN 索引（专用向量数据库） | O(log n) 或 O(1) | 可以，支持十亿级 |

---

## 向量搜索基础

### 精确搜索与近似搜索

**精确搜索（暴力搜索）：**
- 将查询向量与每个已存向量逐一比较
- 每次查询为 O(n * d)
- 精度完美

**近似最近邻（ANN，Approximate Nearest Neighbor）：**
- 使用索引结构裁剪搜索空间
- 亚线性复杂度
- 召回率略低（通常为 95-99%）

### 距离度量

| 度量 | 公式 | 范围 | 最适合 |
|--------|---------|-------|----------|
| 余弦 | 1 - (a . b) / (norm(a) * norm(b)) | [0, 2] | 文本嵌入 |
| 欧氏距离（L2） | sqrt(sum((a - b)^2)) | [0, inf) | 图像嵌入 |
| 点积 | a . b | (-inf, inf) | 已归一化的向量 |

**对于文本嵌入：** 使用余弦相似度（如果预先归一化，也可以用点积）。

### 召回率与延迟的权衡

```
                    ^ Recall
                    |
               100% | ------------------ Brute force
                    |         *          Well-tuned ANN
                    |      *
                    |   *
                95% |*                   Fast ANN
                    |
                    +-----+-------+------> Latency
                       1ms      10ms
```

ANN 索引会用一定精度换取速度。请根据你的需求进行调优。

---

## 索引算法

### HNSW（分层可导航小世界）

这是生产环境中最流行的**内存型**向量搜索算法。

**工作原理：**
1. 构建一个以向量为节点的图
2. 连接到附近邻居
3. 使用多层抽象（分层）
4. 搜索时：从顶层向下逐层导航，采用贪心最近邻

```
Layer 2:   *--------*--------*
           |        |        |
Layer 1:   *--*--*--*--*--*--*
           |  |  |  |  |  |  |
Layer 0:   ********************  (all vectors)
```

**优点：**
- 召回率与延迟权衡优秀
- 不需要训练
- 原生支持更新

**缺点：**
- 内存占用高（图结构）
- 索引大小约为向量数据的 ~1.5-2x
- 10M 个 1536 维向量需要约 80GB 内存

**关键参数：**
- `M`：每个节点的最大连接数（16-64）
- `ef_construction`：构建时探索范围（100-500）
- `ef_search`：查询时探索范围（50-200）

### DiskANN（基于 SSD）

这是**PB 级**搜索的行业标准。

**工作原理：**
- 将图存放在 SSD（NVMe）上，仅在内存中保留一个很小的索引
- 使用 Vamana 算法实现高效的基于磁盘图遍历

**优点：**
- 对于十亿级数据集，成本比 HNSW 低 10 倍，且延迟只增加不到 5ms
- 相比 HNSW，RAM 需求减少 90-95%

**缺点：**
- 相比纯内存 HNSW，延迟略高
- 更适合非实时搜索应用

**示例：** 一个 100 百万向量、1536 维的索引，使用 HNSW 时几乎需要 1TB 内存。使用 DiskANN 时，RAM 需求可减少 90-95%，同时仍能保持低于 10ms 的查询时间。

### IVF（倒排文件索引）

将向量划分为多个簇，只搜索相关簇。

**工作原理：**
1. 使用 k-means 创建中心点
2. 将每个向量分配到最近的中心点
3. 查询时：找到最近中心点，搜索这些簇

**优点：**
- 比 HNSW 更省内存
- 可以使用量化（IVF-PQ）

**缺点：**
- 需要训练
- 更新需要重新聚类或采用混合方案

**关键参数：**
- `nlist`：簇数量（经验法则：sqrt(n)）
- `nprobe`：查询时搜索的簇数

### 产品量化（PQ，Product Quantization）

通过压缩向量减少内存并加快比较速度。

**工作原理：**
1. 将向量拆分为多个子向量
2. 将每个子向量量化到一个码本
3. 存储代码而不是完整向量

**内存减少：** 通常为 4-32x

**权衡：** 因量化损失导致精度降低

### 平面索引（暴力搜索）

没有近似，使用精确搜索。

**适用场景：**
- 少于 100K 个向量
- 精度至关重要
- 延迟预算充足

### 算法对比

| 算法 | 内存 | 构建时间 | 查询速度 | 召回率 | 更新 |
|-----------|--------|------------|-------------|--------|---------|
| HNSW | 高 | 中 | 非常快 | 95-99% | 良好 |
| DiskANN | 低（SSD） | 中 | 快 | 95-99% | 一般 |
| IVF | 中 | 快 | 快 | 90-98% | 一般 |
| IVF-PQ | 低 | 快 | 快 | 85-95% | 一般 |
| Flat | 低 | 无 | 慢 | 100% | 立即 |

---

## 竞争格局

### 原生向量数据库（专用）

| 数据库 | 类型 | 最适合 | 定价模式 |
|----------|------|----------|---------------|
| **Pinecone** | 托管云端（无服务器标准） | 易于起步、可扩展、托管 SLA | 按每个向量小时计费 |
| **Qdrant** | 开源 / 云端（Rust，高性能） | 自托管可控，在常见负载下是最快的开源方案（在 10M 个向量时 p99 约 12ms） | 按 GB 计费（云端）或免费 |
| **Weaviate** | 开源 / 云端 | 单次查询中原生混合检索（BM25 + 稠密向量 + 元数据），支持多模态 | 按每维每小时计费 |
| **Milvus** | 开源 / 云端（Zilliz） | 分布式扩展（50M+ 个向量）、异构节点类型、分层存储 | 免费（自托管）或 Zilliz Cloud |
| **Chroma** | 开源 | 原型开发、本地开发、嵌入式使用 | 免费 |

### 通用型（插件/扩展）

| 数据库 | 类型 | 最适合 | 定价模式 |
|----------|------|----------|---------------|
| **pgvector（v0.8+）** | PostgreSQL 扩展 | 小规模、已有 PG 环境（现支持 HNSW + IVFFlat） | 仅计算资源 |
| **Elasticsearch（v9.0）** | 搜索引擎 | 使用交叉熵融合的混合搜索 | 按许可证计费 |

---

## 数据库详细对比

### 功能矩阵

| 功能 | Pinecone | Qdrant | Weaviate | Milvus | pgvector |
|---------|----------|--------|----------|--------|----------|
| **语言** | 专有 | Rust | Go | Go/C++ | C |
| 托管选项 | 是 | 是 | 是 | 是（Zilliz） | 通过云端 PG |
| 自托管 | 否 | 是 | 是 | 是 | 是 |
| **无服务器** | 是（最佳） | 是 | 是 | 是（Zilliz） | 否 |
| **云原生** | 任意 | 任意 | 任意 | 仅 K8s | 任意 |
| 元数据过滤 | 良好 | 优秀 | 良好 | 良好 | 通过 SQL |
| **混合搜索** | 原生 | 原生 | 原生 | 原生 | 多阶段（有限） |
| 最大向量数 | 十亿级 | 十亿级 | 十亿级 | 十亿级 | ~10M |
| HNSW 索引 | 是 | 是 | 是 | 是 | 是 |

---

## 元数据过滤

对多租户和过滤场景至关重要。

```python
# Pinecone
results = index.query(
    vector=query_embedding,
    top_k=10,
    filter={"tenant_id": "123", "category": {"$in": ["tech", "science"]}}
)

# Qdrant
results = client.search(
    collection_name="documents",
    query_vector=query_embedding,
    limit=10,
    query_filter=Filter(
        must=[
            FieldCondition(key="tenant_id", match=MatchValue(value="123")),
            FieldCondition(key="category", match=MatchAny(any=["tech", "science"]))
        ]
    )
)
```

**性能影响：** 过滤发生在搜索过程中，而不是之后。预过滤索引更快，但灵活性更差。

**为什么元数据过滤常常是瓶颈：** 在朴素的向量搜索中，我们先找到“Top K”最近邻，然后再按元数据过滤。如果过滤条件非常严格，过滤后可能只剩下 0 个结果。专用数据库现在使用 **带 HNSW 的预过滤**，遍历图时只考虑满足布尔元数据约束的节点。这需要专门的位掩码或硬件加速（SIMD）来保持低延迟。

**磁盘原生元数据：** 像 **Qdrant** 这样的现代数据库会把元数据卸载到磁盘映射分段中，从而在不耗尽 RAM 的情况下支持复杂过滤（例如全文 + 地理位置 + 向量）。

---

## 查询模式

### 模式 1：简单语义搜索

```python
def semantic_search(query: str, top_k: int = 5) -> list[Document]:
    query_embedding = embed(query)
    results = vector_db.search(query_embedding, top_k=top_k)
    return [Document(id=r.id, text=r.payload["text"], score=r.score) for r in results]
```

### 模式 2：带过滤的搜索

```python
def filtered_search(query: str, filters: dict, top_k: int = 5) -> list[Document]:
    query_embedding = embed(query)
    results = vector_db.search(
        query_embedding,
        top_k=top_k,
        filter=filters  # {"tenant_id": "abc", "created_after": "2025-01-01"}
    )
    return results
```

### 模式 3：混合搜索（稠密 + 稀疏）

```python
def hybrid_search(query: str, alpha: float = 0.5, top_k: int = 5) -> list[Document]:
    # Dense (semantic)
    dense_embedding = embed(query)
    dense_results = vector_db.search(dense_embedding, top_k=top_k * 2)

    # Sparse (keyword)
    sparse_results = bm25_search(query, top_k=top_k * 2)

    # Combine with reciprocal rank fusion
    combined = reciprocal_rank_fusion(
        [dense_results, sparse_results],
        weights=[alpha, 1 - alpha]
    )

    return combined[:top_k]
```

一些数据库（Weaviate、Qdrant、Pinecone）原生支持混合搜索：

```python
# Weaviate native hybrid
results = client.query.get("Document", ["text"]).with_hybrid(
    query=query,
    alpha=0.5  # 0 = BM25 only, 1 = vector only
).with_limit(5).do()
```

### 模式 4：多向量查询

适用于父子关系或多方面检索：

```python
def multi_vector_search(queries: list[str], top_k: int = 5) -> list[Document]:
    all_results = []

    for query in queries:
        embedding = embed(query)
        results = vector_db.search(embedding, top_k=top_k)
        all_results.extend(results)

    # Dedupe and rerank
    unique = dedupe_by_id(all_results)
    reranked = rerank(queries[0], unique)  # Use primary query for reranking

    return reranked[:top_k]
```

---

## 生产运维

### 容量规划

```python
def estimate_resources(
    num_vectors: int,
    dimensions: int,
    metadata_size_bytes: int = 500
) -> dict:
    # Vector storage
    vector_size = dimensions * 4  # float32
    total_vector_storage = num_vectors * vector_size

    # Index overhead (HNSW ~1.5x)
    index_overhead = total_vector_storage * 1.5

    # Metadata
    metadata_storage = num_vectors * metadata_size_bytes

    # Total
    total_gb = (total_vector_storage + index_overhead + metadata_storage) / 1e9

    # QPS estimate (rough)
    qps_per_gb = 50  # depends heavily on config
    estimated_qps = total_gb * qps_per_gb

    return {
        "storage_gb": total_gb,
        "estimated_qps": estimated_qps,
        "recommended_replicas": max(1, int(total_gb / 50))  # ~50GB per replica
    }
```

### 索引维护

```python
class VectorDBMaintenance:
    def __init__(self, client):
        self.client = client

    def add_documents(self, documents: list[Document]):
        """Upsert documents with batching."""
        batch_size = 100
        for i in range(0, len(documents), batch_size):
            batch = documents[i:i + batch_size]
            embeddings = embed_batch([d.text for d in batch])

            self.client.upsert([
                {
                    "id": doc.id,
                    "vector": embedding,
                    "payload": doc.metadata
                }
                for doc, embedding in zip(batch, embeddings)
            ])

    def delete_documents(self, doc_ids: list[str]):
        """Delete by document ID."""
        self.client.delete(ids=doc_ids)

    def update_metadata(self, doc_id: str, metadata: dict):
        """Update metadata without re-embedding."""
        self.client.set_payload(
            collection_name="documents",
            payload=metadata,
            points=[doc_id]
        )
```

### 高可用性

```
+-------------------------------------------------------------+
|                    Load Balancer                              |
+----------------------------+--------------------------------+
                             |
            +----------------+----------------+
            v                v                v
     +--------------+ +--------------+ +--------------+
     |  Replica 1   | |  Replica 2   | |  Replica 3   |
     |   (Read)     | |   (Read)     | |   (Primary)  |
     +--------------+ +--------------+ +--------------+
                                             |
                                       (Replication)
                                             |
                                       +-----v-----+
                                       |  Storage   |
                                       +-----------+
```

**关键模式：**
- 写入采用主从（leader-follower）模式
- 读取副本用于查询扩展（read replica）
- 为高可用（HA）采用异步复制

### 监控

```python
VECTOR_DB_METRICS = [
    "query_latency_p50",
    "query_latency_p99",
    "queries_per_second",
    "index_size_gb",
    "vector_count",
    "filter_latency",
    "upsert_latency",
    "cache_hit_rate"
]

def alert_rules():
    return {
        "query_latency_p99_high": {
            "condition": "query_latency_p99 > 500ms",
            "severity": "warning"
        },
        "query_latency_p99_critical": {
            "condition": "query_latency_p99 > 2000ms",
            "severity": "critical"
        },
        "low_recall": {
            "condition": "bench_recall < 0.90",
            "severity": "warning"
        }
    }
```

---

## 托管 vs 自托管（TCO 分析）

### 成本对比

| 方面 | Pinecone（无服务器） | 自托管（Qdrant/Milvus） |
|--------|-----------------------|-----------------------------|
| **运维开销** | 零 | 高（需要 K8s + SRE） |
| **扩展** | 即时（可扩展到零） | 手动（节点预配） |
| **成本（小规模）** | $0 - $100/月 | $50/月（最低实例） |
| **成本（扩展后）** | 按 token/向量计费较高 | 单位成本较低 |

### 托管服务定价（仅供参考，始终以提供商页面为准）

| 提供商 | 模型 | 示例：10M 个向量，1536 维 |
|----------|-------|--------------------------------|
| Pinecone | 基于 Pod 或无服务器 | 无服务器约 ~$70-150/月 |
| Qdrant Cloud | 按 GB 计费 | 约 ~$50/月（20GB） |
| Weaviate Cloud | 按维度计费 | 约 ~$100/月 |
| Zilliz（Milvus） | 按 CU 计费 | 约 ~$75/月 |

### 自托管成本

```python
def estimate_self_hosted_cost(
    vectors: int,
    dimensions: int,
    cloud: str = "aws"
) -> dict:
    storage_gb = (vectors * dimensions * 4 * 2.5) / 1e9  # 2.5x for index

    # Instance sizing
    if storage_gb < 50:
        instance = "r6g.large"  # 16 GB RAM, ~$60/month
    elif storage_gb < 200:
        instance = "r6g.xlarge"  # 32 GB RAM, ~$120/month
    else:
        instance = "r6g.2xlarge"  # 64 GB RAM, ~$240/month

    return {
        "storage_gb": storage_gb,
        "instance": instance,
        "monthly_compute": instance_pricing[instance],
        "monthly_storage": storage_gb * 0.10,  # EBS
        "total_monthly": instance_pricing[instance] + storage_gb * 0.10
    }
```

### 决策：托管 vs 自托管

| 因素 | 托管 | 自托管 |
|--------|---------|-------------|
| 运维开销 | 低 | 高 |
| 小规模成本 | 更高 | 更低 |
| 大规模成本 | 可变 | 通常更低 |
| 控制权 | 较少 | 完全 |
| 合规性 | 取决于情况 | 完全可控 |
| 厂商锁定 | 是 | 否（如果是开源） |

**结论**：从无服务器开始。只有在你拥有超过 500M 个向量，或者有严格的 **本地部署/GPU 本地化** 要求时，才考虑自托管。

---

## 选型框架

### 决策树

```
Need < 100K vectors?
+-- Yes -> pgvector (if already using PostgreSQL)
|          +-- Chroma (for prototyping)
|
+-- No -> Need managed service?
          +-- Yes -> Cloud-first?
          |          +-- Yes -> Pinecone (easiest)
          |          +-- No -> Qdrant Cloud or Zilliz
          |
          +-- No -> Need enterprise features?
                    +-- Yes -> Milvus on Kubernetes
                    +-- No -> Qdrant or Weaviate self-hosted
```

### 评估标准

| 标准 | 权重 | 需要提出的问题 |
|-----------|--------|------------------|
| 规模 | 高 | 现在有多少向量？1 年后呢？1 |
| 延迟 | 高 | p99 要求是什么？ |
| 运维能力 | 高 | 我们能否运维它？ |
| 成本 | 中 | 预算约束是什么？ |
| 功能 | 中 | 支持混合搜索？多模态？ |
| 锁定风险 | 低-中 | 是否偏好开源？ |

### 概念验证清单

在确定使用某个向量数据库之前：

- [ ] 加载具有代表性的数据量
- [ ] 在目标 QPS 下基准测试查询延迟
- [ ] 测试元数据过滤性能
- [ ] 验证更新/删除性能
- [ ] 测试故障恢复
- [ ] 评估监控与可观测性
- [ ] 计算总体拥有成本

---

## 面试题

### 问：你会如何在 Pinecone 和自托管方案之间做选择？

**优秀回答：**
决策取决于多个因素：

**选择 Pinecone 时：**
- 团队缺乏有状态基础设施的运维能力
- 需要快速推进（按天而不是按周）
- 规模中等（低于 100M 个向量）
- 预算可以接受托管服务溢价
- 合规允许依赖云厂商

**选择自托管（Qdrant、Milvus）时：**
- 拥有 Kubernetes 和运维经验
- 规模化时对成本敏感
- 需要对数据拥有完全控制权
- 有特定合规要求
- 希望避免厂商锁定

对于大多数初创公司，我会先使用 Pinecone 或 Qdrant Cloud 以获得速度优势，然后在规模扩大且成本变得不可接受时评估迁移。切换成本中等，因为向量数据库的 API 很相似。

### 问：解释 HNSW 的工作原理，以及在什么情况下你不会使用它。

**优秀回答：**
HNSW 会构建一个向量的分层图：

**工作方式：**
1. 将向量作为节点插入到多层图中
2. 更高层节点更少，跳跃更大
3. 搜索：从顶层开始，贪心地导航到最近邻
4. 逐层向下，直到底层（包含所有向量）

**它为什么好：**
- O(log n) 查询复杂度
- 不需要训练
- 支持实时更新
- 召回率/延迟权衡极佳

**不适合使用的情况：**
- 非常小的数据集（<10K）：暴力搜索就足够
- 内存极度受限：HNSW 的图结构会占用约 1.5-2x 的向量大小
- 需要精确搜索：HNSW 是近似算法
- 更新负载重且延迟要求苛刻：更新可能导致短暂性能下降

替代方案：
- 受内存约束时使用 IVF-PQ
- 对十亿级规模且注重成本效率时使用 DiskANN
- 需要精确搜索时使用 Flat 索引
- 对超高维稀疏向量使用 LSH

### 问：什么时候你会选择基于磁盘的索引（如 DiskANN）而不是基于内存的索引（HNSW）？

**优秀回答：**
当索引的内存成本超过预算，或者超过单台高内存节点的容量时，我会使用基于磁盘的索引。例如，一个拥有 100 百万向量、维度为 1536 的索引，使用 HNSW 可能需要接近 1TB 的内存。使用 DiskANN 时，我可以把这 1TB 中的大部分存放在 NVMe SSD 上，在保持低于 10ms 查询时间的同时，将 RAM 需求降低 90-95%。对于非实时搜索应用，这代表了总体拥有成本（TCO, Total Cost of Ownership）的巨大下降。

### 问：为什么元数据过滤往往是向量数据库的瓶颈？

**优秀回答：**
在朴素的向量搜索中，我们先找到“Top K”最近邻，然后再按元数据过滤它们（例如，“只保留来自 2024 的文档”）。如果过滤条件非常严格，过滤后可能只剩下 0 个结果。专用数据库现在会使用 **带 HNSW 的预过滤**，在遍历图的同时只考虑满足布尔元数据约束的节点。之所以计算开销高，是因为它打破了 HNSW 的“短路”逻辑，因此需要专门的位掩码或硬件加速（SIMD）来保持低延迟。

### 问：你如何在向量数据库中处理多租户？

**优秀回答：**
主要有三种方法：

**1. 元数据过滤（最常见）：**
```python
results = db.search(
    vector=query,
    filter={"tenant_id": current_tenant}
)
```
- 优点：简单，单索引
- 缺点：所有租户共享资源，存在漏洞暴露数据的风险

**2. 每个租户一个集合：**
```python
results = db.collection(f"tenant_{tenant_id}").search(vector=query)
```
- 优点：隔离性强，可按租户扩展
- 缺点：集合数量多，运维开销大

**3. 每个租户一个命名空间（Pinecone）：**
```python
results = index.query(vector=query, namespace=tenant_id)
```
- 优点：在单一索引内实现隔离
- 缺点：厂商特定

**我会选择：**
- 大多数场景下使用元数据过滤（简单、成本效益高）
- 对高安全性要求使用独立集合
- 绝不使用后过滤（先检索全部，再过滤），因为存在泄露风险

---

## 参考资料

- Malkov 和 Yashunin. “使用分层可导航小世界图进行高效且稳健的近似最近邻搜索”（HNSW，2018）
- Microsoft Research. “Vamana/DiskANN：一种用于 ANN 搜索的基于磁盘的索引” (2019/2023)
- Pinecone 文档：https://docs.pinecone.io/
- Pinecone. “无服务器向量数据库的托管架构” (2024)
- Qdrant 文档：https://qdrant.tech/documentation/
- Weaviate 文档：https://weaviate.io/developers/weaviate
- Milvus 文档：https://milvus.io/docs
- pgvector：https://github.com/pgvector/pgvector

---

*上一篇：[Embedding Models（嵌入模型）](03-embedding-models.md) | 下一篇：[Hybrid Search（混合搜索）](05-hybrid-search.md)*
