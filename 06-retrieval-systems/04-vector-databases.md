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
| 暴力搜索（例如未建 HNSW 或 IVFFlat 索引的 pgvector） | O(n * d) | 约可支撑到 1M 个向量 |
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
- 内存占用高：全精度向量和图链接都驻留在 RAM 中
- 在高维情况下，图本身只占较小比例。按 OpenSearch 的估算规则，每个向量为 1.1 x (4 x dims + 8 x M) 字节；在 1,536 维、M 为 16 至 64 时，比原始 float32 向量多约 12–19%；低维向量的额外占比更大
- 10M 个 1,536 维向量每份副本需要约 70–75 GB RAM（其中 61 GB 是 float32 向量），尚未计入复制副本

**关键参数：**
- `M`：每个节点的最大连接数（16-64）
- `ef_construction`：构建时探索范围（100-500）
- `ef_search`：查询时探索范围（50-200）

### DiskANN（基于 SSD）

它面向无法全部放入 RAM 的**十亿级**索引。原始论文用一台配备 64 GB RAM 和 SSD 的工作站服务十亿个 SIFT 数据点，实现每秒超过 5,000 次查询、低于 3 ms 的平均延迟，以及 95% 以上的 1-recall@1。

**工作原理：**
- 将全精度向量和图存放在 SSD（NVMe）上，仅把压缩后的 PQ 编码保留在 RAM 中，用于引导搜索
- 使用 Vamana 算法实现高效的基于磁盘图遍历

**优点：**
- 对于十亿级数据集，成本比 HNSW 低 10 倍，且延迟只增加不到 5ms
- 相比 HNSW，RAM 需求减少 90-95%

**缺点：**
- 相比纯内存 HNSW，延迟略高
- 尾延迟取决于 NVMe IOPS，因此应按并发查询量而非仅按容量配置 SSD

**示例：** 一个 1 亿向量、1,536 维的索引，使用 HNSW 时每份副本约需 700 GB RAM（其中 614 GB 是 float32 向量，加上图与额外开销）。使用 DiskANN 时，RAM 需求可减少 90–95%，同时仍能保持低于 10ms 的查询时间。

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

### 低位和基于旋转的量化

2026 年 5 至 9 月，多种引擎推出或扩展了 1 至 8 bit 的向量存储，多数为可选或预览功能，而非默认设置。新方法是**先旋转，再量化**。嵌入向量各维度的方差极不均匀，直接按维度做标量量化会在变化较小的维度浪费 bit，并截断变化较大的维度。先乘以随机旋转矩阵或 Hadamard 旋转矩阵，将能量均匀分散到各维度，再用统一的 4 bit 或 1 bit 网格量化，就能减少信息损失。

| 引擎 | 功能 | 状态 | 存储占用 |
|---|---|---|---|
| Qdrant | 带 Hadamard 旋转的 TurboQuant（1.18，2026 年 5 月）；Turbo4 存储类型只保留 4 bit 形式（1.19，2026 年 8 月） | 可选 | 从 1.18 中每坐标 36 bit（float32 原始值加 4 bit 副本）降至 Turbo4 的 4 bit，缩小 9 倍 |
| Weaviate | 4-bit Rotational Quantization（1.39，2026 年 8 月），在原有 8 bit 和 1 bit RQ 基础上新增 | 预览版，仅限 HNSW | 1,536 维向量从 6,144 字节降至 784 字节（7.84x） |
| Elasticsearch | DiskBBQ（`bbq_disk`，自 9.2 正式发布）在 9.5（2026 年 8 月）增加对称的 1 bit OSQ 评分器和合并时校准 | 正式发布；从 9.4 起，在许可证涵盖该功能（Enterprise）时成为浮点向量的默认索引类型 | 每维约 1 bit，另加校正项 |
| turbopuffer | 普通 `i8` 向量类型（2026 年 6 月），不旋转 | 已发布 | 对量化感知模型，存储和查询成本比 f32 低 75%（供应商数据） |

Qdrant 自报数据展示了权衡：在一个数据集上，4 bit TurboQuant 召回率为 0.9193，8 bit 标量量化为 0.9285，未压缩为 0.9419；前者的压缩程度是标量量化的两倍（供应商自报）。设计上的关键选择是是否**保留用于重新评分的浮点原始向量**。把原始向量放在磁盘或对象存储中，并对前几百名候选重新评分，可恢复大部分损失的召回率；丢弃它们（Turbo4）成本最低，却也限制了最高召回率。

RAM 计算也因此改变：1 亿个 1,536 维向量以 float32 存储约需 614 GB，以 4 bit 存储则约需 77 GB。到十亿向量规模，这意味着从一群高内存节点，降到少数机器加 SSD。

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
| **Pinecone** | 托管云端（标准版为无服务器）；BYOC 于 2026 年 9 月 23 日正式发布（数据平面运行在用户的 AWS、GCP 或 Azure 账户中） | 易于起步、可扩展、托管 SLA；BM25 全文搜索于 2026 年 9 月 9 日正式发布 | 存储费加读写单元费 |
| **Qdrant** | 开源 / 云端（Rust，高性能） | 自托管可控、过滤检索能力强；供应商基准声称在 10M 个向量时 p99 约 12ms | 按 GB 计费（云端）或免费 |
| **Weaviate** | 开源 / 云端 | 单次查询中原生混合检索（BM25 + 稠密向量 + 元数据）、MMR 多样性与 Boost API（1.39 正式发布）、多模态 | 按每维每小时计费 |
| **Milvus** | 开源 / 云端（Zilliz） | 分布式扩展；3.0（2026 年 7 月）增加通过对象存储中的 Parquet、Iceberg、Lance 和 Vortex 访问的外部集合，以及在线列回填 | 免费（自托管）或 Zilliz Cloud |
| **turbopuffer** | 托管服务，以对象存储为基础 | 以较低成本服务大量冷命名空间（按租户划分的索引）；原生嵌入于 2026 年 9 月 29 日正式发布 | 按用量计费 |
| **Chroma** | 开源 | 原型开发、本地开发、嵌入式使用 | 免费 |

### 通用型（插件/扩展）

| 数据库 | 类型 | 最适合 | 定价模式 |
|----------|------|----------|---------------|
| **pgvector（0.8.7）** | PostgreSQL 扩展 | 小规模、已有 PG 环境（HNSW + IVFFlat）。应更新至 0.8.7（2026 年 10 月 1 日）：该版修复 CVE-2026-103484，即任何获准创建索引的角色均可触发的 IVFFlat 构建溢出 | 仅计算资源 |
| **Elasticsearch（9.5）** | 搜索引擎 | 通过 `rrf` 和 `linear` 检索器进行混合搜索；DiskBBQ 量化向量；`semantic_text` 字段在摄取时自动嵌入 | 按许可证计费 |
| **MongoDB Atlas Vector Search** | 文档数据库 | 适合已有 MongoDB 环境；Automated Embedding 于 2026 年 8 月 13 日正式发布（Atlas 在写入时使用 Voyage 模型嵌入及重新嵌入文档） | Atlas 集群定价 |

### 2026 年市场变化

评估引擎时有三项变化：

1. **嵌入进入数据库。**MongoDB Atlas Automated Embedding（正式发布）、turbopuffer 原生嵌入（正式发布；turbopuffer 声称 Readwise 通过与查询执行并行嵌入，将嵌入中位延迟缩短 8 倍）、Elasticsearch `semantic_text` 和 Milvus 3.0 的 Hugging Face Inference Providers 集成，都消除了独立的嵌入与同步流水线。代价是耦合：模型版本由供应商决定，采用前要问清模型变更如何触发重新嵌入。
2. **索引向湖仓靠近。**Milvus 3.0 的外部集合可就地查询 Parquet、Iceberg、Lance 和 Vortex 数据（零复制、只读）；turbopuffer 9 月 30 日的《RIP, vector database》介绍了 v3 存储设计，其中 ANN 索引成为次级索引，不再是主要数据布局（已宣布，通过 CI，但尚未用于生产；文中的规模数字由供应商提供）。问题从“选哪个向量数据库”转为“在对象存储上就地建索引，还是复制到服务型存储”。
3. **低位量化扩展到多家供应商**（见[上文](#低位和基于旋转的量化)），改变了 HNSW 容量规划的 RAM 预算。

---

## 数据库详细对比

### 功能矩阵

| 功能 | Pinecone | Qdrant | Weaviate | Milvus | pgvector |
|---------|----------|--------|----------|--------|----------|
| **语言** | 专有 | Rust | Go | Go/C++ | C |
| 托管选项 | 是 | 是 | 是 | 是（Zilliz） | 通过云端 PG |
| 自托管 | 仅 BYOC（数据平面在自有云中） | 是 | 是 | 是 | 是 |
| **无服务器** | 是（最佳） | 是 | 是 | 是（Zilliz） | 否 |
| **云原生** | 任意 | 任意 | 任意 | 分布式使用 K8s；单机可用 Docker | 任意 |
| 元数据过滤 | 良好 | 优秀 | 良好 | 良好 | 通过 SQL |
| **混合搜索** | 稀疏+稠密，或 BM25 全文检索后由客户端融合 | 原生 | 原生 | 原生 | 多阶段（有限） |
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

# Qdrant (Query API; the legacy /search endpoint is removed from the 1.19 REST schema)
results = client.query_points(
    collection_name="documents",
    query=query_embedding,
    limit=10,
    query_filter=Filter(
        must=[
            FieldCondition(key="tenant_id", match=MatchValue(value="123")),
            FieldCondition(key="category", match=MatchAny(any=["tech", "science"]))
        ]
    )
).points
```

**性能影响：** 过滤发生在搜索过程中，而不是之后。预过滤索引更快，但灵活性更差。

**为什么元数据过滤常常是瓶颈：** 在朴素的向量搜索中，我们先找到“Top K”最近邻，然后再按元数据过滤。如果过滤条件非常严格，过滤后可能只剩下 0 个结果。专用数据库现在使用 **带 HNSW 的预过滤**，遍历图时只考虑满足布尔元数据约束的节点。这需要专门的位掩码或硬件加速（SIMD）来保持低延迟。

**磁盘原生元数据：** 现代数据库按组件在 RAM 与磁盘间分层存储。Qdrant 1.19 用统一的 `memory` 设置（pinned、cached 或 cold）取代原有的 `on_disk` 和 `always_ram` 标志，并将其应用于向量、HNSW 图、稀疏索引和 payload 索引，使复杂过滤（如全文 + 地理位置 + 向量）无需把所有 payload 索引常驻 RAM。

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

一些数据库（Weaviate、Qdrant、Milvus、Elasticsearch）可原生融合稠密与关键词搜索结果。Pinecone 的 BM25 全文检索每次请求只按一种评分方式排序，因此需分别执行词汇和向量搜索，再在客户端融合（例如使用 RRF）。

```python
# Weaviate native hybrid (Python client v4)
docs = client.collections.use("Document")
results = docs.query.hybrid(
    query=query,
    alpha=0.5,  # 0 = BM25 only, 1 = vector only
    limit=5,
)
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

### 安全补丁

应像管理其他数据库一样，关注向量存储的 CVE 公告。pgvector 0.8.7（2026 年 10 月 1 日）修复了 CVE-2026-103484：IVFFlat 索引构建期间的缓冲区溢出，可让任何获准创建索引的数据库角色执行代码。2026 年更早的补丁还修复了并行 HNSW 构建溢出（0.8.2）与 HNSW 清理过程中可能发生的索引损坏（0.8.3）。对于托管 PostgreSQL，应确认提供商已提供 0.8.7；多租户 schema 中不要授予应用角色 `CREATE INDEX`。Milvus 3.0.1 也修复了通过外部代理端口的流式 gRPC 调用进行未认证访问的问题。

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

### 托管 RAG 流水线（自建还是购买）

一种更新的选择是跳过向量数据库选型，使用负责解析、分块、嵌入、索引和检索的托管流水线，按摄取 token、存储量和查询量付费。Cloudflare AI Search 于 2026 年 10 月 1 日正式发布，以下价格自 2026 年 11 月 1 日生效：

| 计费项 | 价格 | 每月包含量（Workers 套餐） |
|---|---|---|
| 摄取 | 每 1M token $0.75（图像每 1M 另加 $0.50） | 5M token |
| 存储 | 每 GB·月 $2.00 | 10 GB·月 |
| 语义、向量或混合查询 | 每 1K 次 $0.75 | 1,000 次 |
| 全文查询 | 每 1K 次 $0.10 | 1,000 次 |

规模化后，单次查询计费占主导：每月 10M 次混合查询，仅查询费就约为 $7,500；而自托管索引完成资源配置后，每次查询的边际成本接近零。托管流水线适合快速给出首个答案，以及低流量或突发流量；稳定的高 QPS 场景，应比较查询计费与节点成本加嵌入 API 费用。Pinecone Nexus 和 Cohere Compass Cloud 将这种“购买整条流水线”的方式进一步延伸；参见[智能体式 RAG](08-agentic-rag.md#一次编译知识)。

### 自托管成本

```python
def estimate_self_hosted_cost(
    vectors: int,
    dimensions: int,
    cloud: str = "aws"
) -> dict:
    storage_gb = (vectors * dimensions * 4 * 2.5) / 1e9  # 2.5x for index

    # Instance sizing: an in-RAM HNSW index must fit in memory with headroom
    if storage_gb < 12:
        instance = "r6g.large"  # 16 GB RAM
    elif storage_gb < 25:
        instance = "r6g.xlarge"  # 32 GB RAM
    elif storage_gb < 50:
        instance = "r6g.2xlarge"  # 64 GB RAM
    else:
        instance = "r6g.4xlarge"  # 128 GB RAM; past ~100 GB, shard, quantize, or use DiskANN

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

**结论**：从无服务器开始。只有在你拥有超过 500M 个向量，或者有严格的**本地部署/GPU 本地化**要求时，才考虑自托管。如果要求只是“数据保留在自己的云账户”而非“自行运维”，2026 年 9 月正式发布的 Pinecone BYOC 已能满足前者，同时免去运维负担。

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
- [ ] 在目标 QPS 下，使用真实过滤条件和 top-k 深度基准测试查询延迟（供应商数字很少纳入严格过滤；2026 年 9 月发布的 Qdrant-FineWeb-10B 提供覆盖 10.07B 向量、带精确 top-1,000 真值的公开生产规模基准）
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
- 需要完全控制软件，而不仅是数据所在位置
- 有特定合规要求
- 希望避免厂商锁定

2026 年的两项变化缩小了差距：Pinecone BYOC（9 月 23 日正式发布）让数据平面运行在自有云账户中，Pinecone 无法从外部入站访问；Pinecone 的 BM25 全文检索（9 月 9 日正式发布）也削弱了“必须有单独的关键词引擎”的理由，不过词汇与向量结果仍须在客户端融合。

对于大多数初创公司，我会先使用 Pinecone 或 Qdrant Cloud 加快启动，然后在规模扩大且成本变得不可接受时评估迁移。切换成本主要是重新嵌入和重建索引，而不是 API：查询接口相似，但数据库内嵌入功能会将你绑定到供应商选择的模型。

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
- 内存极度受限：HNSW 要求每个全精度向量及其图链接常驻 RAM
- 需要精确搜索：HNSW 是近似算法
- 更新负载重且延迟要求苛刻：更新可能导致短暂性能下降

替代方案：
- 受内存约束时使用 IVF-PQ
- 对十亿级规模且注重成本效率时使用 DiskANN
- 需要精确搜索时使用 Flat 索引
- 对超高维稀疏向量使用 LSH

### 问：什么时候你会选择基于磁盘的索引（如 DiskANN）而不是基于内存的索引（HNSW）？

**优秀回答：**
当索引的内存成本超过预算，或者超过单台高内存节点的容量时，我会使用基于磁盘的索引。例如，1 亿个 1,536 维向量使用 HNSW 时，每个副本约需 700 GB RAM（仅 float32 向量就占 614 GB）。使用 DiskANN 时，我可以把全精度向量和图保存在 NVMe SSD，仅将压缩编码留在 RAM 中，在保持低于 10 ms 查询时间的同时，将 RAM 需求降低 90–95%。任何能容忍每次查询多花几毫秒的工作负载都可显著降低总体拥有成本（TCO）；大多数 RAG 流量属于此类，因为端到端延迟主要由 LLM 调用决定。

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

**混合搜索的隐患：**BM25 分数依赖整个语料库的 IDF 统计。在共享集合中，一个大租户的词汇会改变其他租户的关键词分数，词项统计也会跨越租户边界泄露。应使用支持按租户计算 IDF 的引擎（Qdrant 1.19 已为稀疏搜索和 BM25 增加此功能），或让大租户使用独立集合。

---

## 参考资料

- Malkov 和 Yashunin. “使用分层可导航小世界图进行高效且稳健的近似最近邻搜索”（HNSW，2018）
- Subramanya 等人. “DiskANN: Fast Accurate Billion-point Nearest Neighbor Search on a Single Node”（Microsoft Research，NeurIPS 2019）
- [OpenSearch. “k-NN index: HNSW memory estimation”](https://docs.opensearch.org/2.9/search-plugins/knn/knn-index/)
- Pinecone 文档：https://docs.pinecone.io/
- Pinecone. “无服务器向量数据库的托管架构” (2024)
- Qdrant 文档：https://qdrant.tech/documentation/
- Weaviate 文档：https://weaviate.io/developers/weaviate
- Milvus 文档：https://milvus.io/docs
- pgvector：https://github.com/pgvector/pgvector
- [Milvus 3.0.0 发布说明（2026 年 7 月）](https://github.com/milvus-io/milvus/releases/tag/v3.0.0)
- [Qdrant 1.19 发布说明（2026 年 8 月）](https://qdrant.tech/blog/qdrant-1.19.x/)
- [Weaviate 1.39 发布说明（2026 年 8 月）](https://weaviate.io/blog/weaviate-1-39-release)
- [Elasticsearch 发布说明](https://www.elastic.co/docs/release-notes/elasticsearch)
- [turbopuffer. “RIP, vector database”（2026 年 9 月）](https://turbopuffer.com/blog/rip-vector-database)
- [Qdrant-FineWeb-10B 基准（2026 年 9 月）](https://qdrant.tech/blog/qdrant-fineweb-10b-release/)
- [Cloudflare AI Search 定价](https://developers.cloudflare.com/ai-search/platform/limits-pricing/)

---

*上一篇：[Embedding Models（嵌入模型）](03-embedding-models.md) | 下一篇：[Hybrid Search（混合搜索）](05-hybrid-search.md)*
