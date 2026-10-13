# 生产级 RAG 规模化

生产级 RAG 不再是一个周末项目。它是一个分布式系统，包含检索管线、缓存层、路由逻辑、自我纠错循环、多租户隔离以及成本控制，且所有这些都在严格的延迟 SLA 下运行。当 RAG 在生产中失败时，原因通常位于模型上游：正确段落未被完整分块、索引或检索，因此生成器根本没有见到它。正因如此，成功的企业级部署会把知识源（而不是模型）作为主要投资。

## 目录

- [RAG 与长上下文](#rag-与长上下文)
- [查询路由与分类](#查询路由与分类)
- [RAG 的语义缓存](#rag-的语义缓存)
- [多索引策略](#多索引策略)
- [RAG 管线优化](#rag-管道优化)
- [纠正型 RAG：自检式检索](#纠正式-rag-自检检索)
- [自适应检索](#自适应检索)
- [成本优化模式](#成本优化模式)
- [故障模式与调试](#失败模式与调试)
- [监控与告警](#监控与告警)
- [扩展到百万级文档](#扩展到数百万份文档)
- [多租户 RAG 隔离](#多租户-rag-检索增强生成-隔离)
- [真实世界架构示例](#真实世界架构示例)
- [系统设计面试视角](#系统设计面试角度)
- [参考资料](#参考资料)

---

## RAG 与长上下文

随着多数前沿模型家族支持约 1M 令牌上下文窗口（Claude Opus 5.5 与 Sonnet 5.5、上下文达 1.05M 的 GPT-6 Sol 与 Astra、Gemini 3.8 Flash、Muse Spark 1.3，以及 Xiaomi MiMo-V2.6、Llama 4 Maverick 等开放模型），问题已经不再是“RAG 还是长上下文？”，而是“各自在什么情况下更优？”

### 决策矩阵

```
                    Small Corpus           Large Corpus
                    (<100K tokens)         (>1M tokens)
                 +---------------------+---------------------+
  Static Data    |  Long Context Wins  |  RAG Required       |
  (rarely        |  - Stuff it all in  |  - Can't fit in     |
   changes)      |  - Simpler arch     |    context window   |
                 |  - No index needed  |  - Index + retrieve |
                 +---------------------+---------------------+
  Dynamic Data   |  Hybrid Approach    |  RAG Required       |
  (updates       |  - Cache context    |  - Incremental      |
   frequently)   |  - Invalidate on    |    indexing          |
                 |    change           |  - Real-time updates |
                 +---------------------+---------------------+
  Multi-User     |  RAG Preferred      |  RAG Required       |
  (per-user      |  - Personalized     |  - Tenant isolation  |
   data)         |    retrieval        |  - Access control    |
                 +---------------------+---------------------+
```

### 逐项对比

| 维度 | RAG | 长上下文（1M 令牌） |
|-----------|-----|--------------------------|
| **平均查询成本** | ~$0.001-0.015（5K 上下文 token，从 GPT-6 Luna 到 Claude Sonnet 5.5） | 使用 Claude 热缓存时输入约 $0.20-0.25；无缓存时 $2-4 |
| **平均延迟（p50）** | ~1s | ~30-45s |
| **特定事实的精度** | 高（定向检索） | 中间部分会退化 |
| **跨文档综合** | 弱（上下文有限） | 强（能看到全部） |
| **语料库大小上限** | 无上限 | ~1M 令牌 |
| **数据新鲜度** | 分钟级（增量索引） | 需要完整重新加载；任一编辑都会使其之后的缓存失效 |
| **每百万次查询成本** | ~$1K-15K | 热缓存至少约 $200K；无缓存时 $2M-4M |

### “迷失在中间”问题

LLM 不会在整个上下文窗口中均匀关注信息。放在长上下文中间的信息，相比放在开头或结尾的信息，准确率会出现 30%+ 的下降。RAG 通过只把最相关的块放入一个短而聚焦的上下文中，完全绕开了这个问题。

### 缓存读取的成本临界点

更便宜的缓存读取改变了**稳定**语料的选择。在同一个模型上，若将语料保存在服务商的提示词缓存中，每次查询的输入成本低于 RAG 的条件是：

```
corpus_tokens x cache_read_multiplier  <  retrieved_context_tokens
```

| 模型（2026 年 10 月 1 日标价） | 缓存读取费率 | 与 5K-token RAG 上下文成本相同的语料规模 |
|----------------------------------|------------|------------------------------------------------------|
| Claude Fable 5.1 | 0.025 倍（每百万 token $0.25） | 约 200K token |
| Claude Opus 5.5 | 0.05 倍（每百万 token $0.20） | 约 100K token |
| GPT-6.1 Sol | 0.05 倍（每百万 token $0.10） | 约 100K token |
| 其他多数 Claude 与 OpenAI 模型 | 0.1 倍 | 约 50K token |

这个公式没有计入以下因素：
- **缓存写入和 TTL。** Claude 对 5 分钟写入收取 1.25 倍、对 1 小时写入收取 2 倍费用（Opus 5.5 分别为每百万 token $5 和 $8）；OpenAI 自 GPT-5.6 起收取 1.25 倍费用，TTL 固定为 30 分钟。查询频率低于 TTL 的语料会反复支付写入成本。Gemini 3.8 Flash 的显式缓存读取费率为 0.1 倍，但还按小时收取存储费（2026 年 12 月 31 日前每百万 token 每小时 $0.50；2027 年 1 月 1 日起为 $1.00），因此 200K-token 语料即使没有读取，每小时也需 $0.10 至 $0.20。
- **长上下文附加费。** OpenAI 在输入超过 272K token 后，对整次请求按长上下文费率计费；xAI 在达到 200K token 后将所有 token 价格翻倍。Anthropic 的 Claude 4.6 及后续版本直到 1M token 都采用统一价格。
- **质量和延迟。** 便宜的缓存读取无法解决“迷失在中间”或超长提示词的预填充时间，而且只对容得下的语料有用。

应按模型重新计算，而非引用固定阈值。实际变化主要发生在小语料端：很少变更的 100K 至 200K-token 手册或政策集，现在作为缓存前缀通常比建索引更便宜、更简单。

### 最佳实践：混合模式

最终胜出的架构会把两者结合起来：先用 RAG 从大语料库中检索出最优候选，再把这些候选加载到长上下文窗口中做跨文档推理。

```
  User Query
      |
      v
+------------------+     +-------------------+
|  RAG Retrieval   |---->|  Long Context     |
|  (Find top 20    |     |  Synthesis        |
|   from 10M docs) |     |  (Reason across   |
+------------------+     |   20 docs deeply) |
                          +-------------------+
                                  |
                                  v
                          Final Answer with
                          Cross-Doc Citations
```

**经验法则**：如果你的语料库能够放进上下文，而且你能承受延迟，也能承受成本，那就用长上下文。否则就用 RAG。对于大多数受成本和延迟约束的生产系统来说，RAG 仍然是正确的默认选择。

### 第三种选择：只编译一次知识

一类新产品在摄入时预先计算结构化知识，而不是每次查询时检索分块。典型例子是 **Pinecone Nexus**（2026 年 8 月 6 日正式可用）：领域专家通过 Manifest 描述任务（实体、关系和答案形式）；Nexus 将源文档一次编译成摘要、结构化提取结果和实体关系图；智能体通过 KnowQL 语言一次调用即可查询。数据平面运行在客户自己的 AWS、Google Cloud 或 Azure 账户中。Pinecone 报告（供应商自行评测），在 tau-Knowledge 上，GPT-5.5 搭配 Nexus 的得分为 47.4%，不搭配时为 46.4%，每项任务成本降低 77%，模型调用减少约 35%。

| | 查询时检索（RAG） | 只编译一次 |
|---|---|---|
| **成本发生位置** | 每次查询 | 摄入和重新编译 |
| **错误发生位置** | 检索遗漏，可按查询观察 | 编译错误，在重新编译前会影响每个答案 |
| **意料之外的问题** | 可以处理 | 仅限 Manifest 预设的答案形式 |
| **语料漂移** | 增量重新索引 | 重新编译受影响的产物 |

一次编译适合问题形式重复、内容稳定且查询量大的领域（政策、判例法、产品目录）。长尾和探索性问题仍应采用查询时检索；即使采用编译方案，也应保留检索作为回退路径。

---

## 查询路由与分类

并不是每个查询都需要检索。生产系统会对传入查询进行分类，并把它们路由到最优处理路径。

### 四路径路由器

```
                         User Query
                             |
                             v
                    +------------------+
                    |  Query Classifier |
                    |  (LLM or trained  |
                    |   classifier)     |
                    +--------+---------+
                             |
            +--------+-------+-------+--------+
            |        |               |        |
            v        v               v        v
        +------+ +--------+    +--------+ +--------+
        |Direct| |Simple  |    |Complex | |Agentic |
        | LLM  | |  RAG   |    |  RAG   | |  RAG   |
        +------+ +--------+    +--------+ +--------+
        "What    "What is      "Compare   "Analyze
        is 2+2?" our refund    Q3 vs Q4   all legal
                  policy?"     revenue    risks in
                               trends"    these 50
                                          contracts"
```

### 分类信号

| 信号 | 直接 LLM | 简单 RAG | 复杂 RAG | 代理式 RAG |
|--------|-----------|------------|-------------|-------------|
| **需要私有数据** | 否 | 是 | 是 | 是 |
| **单跳回答** | 是 | 是 | 否 | 否 |
| **需要多个来源** | 否 | 否 | 是 | 是 |
| **需要推理链** | 否 | 否 | 可能 | 是 |
| **时间敏感数据** | 否 | 可能 | 可能 | 是 |

### 实现：轻量级路由器

```python
class QueryRouter:
    """Routes queries to the optimal retrieval strategy."""

    def __init__(self, classifier_model: str = "gpt-6-luna"):
        self.classifier = classifier_model
        self.route_counts = Counter()  # for monitoring

    async def classify(self, query: str, user_context: dict) -> str:
        # Step 1: Rule-based fast path
        if self._is_trivial(query):
            return "direct_llm"

        # Step 2: Check if query references private/org data
        if not self._needs_retrieval(query, user_context):
            return "direct_llm"

        # Step 3: LLM-based complexity classification
        complexity = await self._assess_complexity(query)

        if complexity == "simple":
            return "simple_rag"
        elif complexity == "multi_hop":
            return "complex_rag"
        else:
            return "agentic_rag"

    def _is_trivial(self, query: str) -> bool:
        """Fast regex/keyword check for trivial queries."""
        trivial_patterns = [
            r"^(what is|define|explain)\s+\w+$",
            r"^(hi|hello|thanks|bye)",
        ]
        return any(re.match(p, query.lower()) for p in trivial_patterns)

    async def _assess_complexity(self, query: str) -> str:
        """Use a small, fast model to classify complexity."""
        prompt = f"""Classify this query's retrieval complexity:
        - "simple": needs one document lookup
        - "multi_hop": needs 2-3 lookups, comparison, or synthesis
        - "agentic": needs planning, tool use, or iterative search

        Query: {query}
        Classification:"""

        result = await llm_call(self.classifier, prompt, max_tokens=10)
        return result.strip().lower()
```

### 面向领域的路由

对于拥有多个知识领域的系统，在检索之前先把查询路由到正确的索引。

```python
# Rule-based domain routing
DOMAIN_RULES = {
    "revenue|sales|quota|ARR":     "financial_index",
    "policy|handbook|PTO|benefits": "hr_index",
    "API|endpoint|SDK|integration": "engineering_index",
    "compliance|GDPR|SOC2|audit":   "legal_index",
}

# Embedding-based domain routing (for ambiguous queries)
class DomainRouter:
    def __init__(self):
        self.domain_centroids = {}  # pre-computed per domain

    def route(self, query_embedding: list[float]) -> str:
        similarities = {
            domain: cosine_sim(query_embedding, centroid)
            for domain, centroid in self.domain_centroids.items()
        }
        return max(similarities, key=similarities.get)
```

---

## RAG 的语义缓存

语义缓存会识别一个新查询在语义上是否与之前的查询基本相同，并复用缓存结果。经过良好调优的语义缓存，生产系统报告可实现高达 68% 的成本降低，以及 65 倍的延迟提升。

### 三层缓存架构

```
  User Query
      |
      v
+---------------------+
| Layer 1: Exact Cache |  Hash(query) -> response
| (Redis/Memcached)    |  TTL: 1 hour
| Hit rate: ~15-25%    |  Latency: <5ms
+----------+----------+
           | miss
           v
+---------------------+
| Layer 2: Semantic    |  Embed(query) -> nearest neighbor
| Cache (Vector DB)    |  Threshold: cosine > 0.95
| Hit rate: ~20-35%    |  Latency: <50ms
+----------+----------+
           | miss
           v
+---------------------+
| Layer 3: Document    |  Cache retrieved chunks
| Cache               |  Skip re-embedding
| (saves embedding $) |  TTL: until doc changes
+----------+----------+
           | miss
           v
    Full RAG Pipeline
```

### 语义缓存实现

```python
class SemanticCache:
    """Cache RAG responses by query semantic similarity."""

    def __init__(self, vector_store, similarity_threshold: float = 0.95):
        self.vector_store = vector_store
        self.threshold = similarity_threshold
        self.response_store = {}  # query_id -> cached response

    async def get(self, query: str) -> Optional[CachedResponse]:
        # Step 1: Exact match (fast path)
        exact_key = hashlib.sha256(query.encode()).hexdigest()
        if exact_key in self.response_store:
            return self.response_store[exact_key]

        # Step 2: Semantic match
        query_embedding = await embed(query)
        results = self.vector_store.search(
            query_embedding, top_k=1
        )

        if results and results[0].score >= self.threshold:
            cached_id = results[0].metadata["response_id"]
            cached = self.response_store.get(cached_id)
            if cached and not cached.is_expired():
                return cached

        return None

    async def put(
        self, query: str, response: str,
        sources: list[str], ttl_seconds: int = 3600
    ):
        query_embedding = await embed(query)
        response_id = str(uuid4())

        # Store the embedding for future similarity lookups
        self.vector_store.upsert(
            id=response_id,
            embedding=query_embedding,
            metadata={"response_id": response_id}
        )

        # Store the actual response
        self.response_store[response_id] = CachedResponse(
            response=response,
            sources=sources,
            created_at=time.time(),
            ttl=ttl_seconds,
        )
```

### 缓存失效策略

| 策略 | 触发条件 | 使用场景 |
|----------|---------|----------|
| **基于 TTL** | 固定时间过期 | 通用查询、新闻 |
| **事件驱动** | 文档更新 webhook | 知识库 |
| **版本标记** | 文档版本不匹配 | 合规关键场景 |
| **置信度门控** | 检索分数低 | 波动性领域 |

**关键规则**：始终把源文档 ID 与响应一起缓存。当任一源文档更新时，失效所有引用它的缓存条目。

```python
# Webhook-based cache invalidation
@app.post("/webhook/document-updated")
async def on_document_updated(doc_id: str):
    # Find all cache entries that used this document
    affected = cache_index.find_by_source(doc_id)
    for entry in affected:
        semantic_cache.invalidate(entry.response_id)
    logger.info(f"Invalidated {len(affected)} cache entries for doc {doc_id}")
```

---

## 多索引策略

单一的单体索引无法扩展。生产系统会按领域、租户或文档类型对向量索引进行分区，以提高检索精度和运维隔离性。

### 索引分区模式

```
Pattern 1: Per-Domain Indexes
+--------+  +--------+  +--------+  +--------+
|  Legal |  |   HR   |  |Finance |  |  Eng   |
| Index  |  | Index  |  | Index  |  | Index  |
+--------+  +--------+  +--------+  +--------+
    |            |            |           |
    +----------- +-----+------+-----------+
                       |
                 Query Router
                       |
                  User Query


Pattern 2: Per-Tenant Indexes (Silo Model)
+----------+  +----------+  +----------+
| Tenant A |  | Tenant B |  | Tenant C |
|  Index   |  |  Index   |  |  Index   |
| (Acme)   |  | (Globex) |  | (Wayne)  |
+----------+  +----------+  +----------+


Pattern 3: Shared Index with Metadata Filtering (Pool Model)
+-------------------------------------------+
|           Shared Vector Index              |
|  +-------+  +-------+  +-------+          |
|  | doc_1 |  | doc_2 |  | doc_3 |  ...     |
|  | t:A   |  | t:B   |  | t:A   |          |
|  +-------+  +-------+  +-------+          |
|                                            |
|  WHERE tenant_id = "A"  <-- filter         |
+-------------------------------------------+
```

### 何时使用各模式

| 模式 | 隔离性 | 成本 | 运行复杂度 | 最适合 |
|---------|-----------|------|----------------------|----------|
| **按领域** | 中等 | 中等 | 中等 | 具有不同知识领域的内部工具 |
| **按租户孤岛** | 最强 | 高 | 高 | 企业级 SaaS、受监管行业 |
| **共享池** | 最弱 | 低 | 低 | 中小企业 SaaS、成本敏感型产品 |
| **混合桥接** | 可配置 | 中等 | 高 | 混合客户群（企业 + 中小企业） |

### 分层索引策略

对于非常大的语料库，使用两级索引：用于路由的粗粒度“摘要索引”，以及用于精确性的细粒度“分块索引”。

```
  Query: "What is the refund policy for enterprise plans?"
      |
      v
+--------------------+
| Summary Index      |  Contains doc-level summaries
| (10K entries)      |  Fast, broad search
+--------+-----------+
         |
         | Top 3 matching docs identified
         v
+--------------------+
| Chunk Index        |  Contains 500-token chunks
| (2M entries)       |  Precise, targeted search
| Filtered to 3 docs |
+--------+-----------+
         |
         v
   Top 5 chunks -> LLM
```

---

## RAG 管道优化

朴素的顺序式 RAG 管道会在每一步都增加延迟。生产管道会使用并行、批处理和异步处理来满足亚秒级 SLA。

### 顺序式与优化后管道

```
SEQUENTIAL (Naive):
Query -> Embed(200ms) -> Search(150ms) -> Rerank(300ms) -> Generate(800ms)
Total: ~1450ms

OPTIMIZED (Parallel + Cached):
Query ----+---> Embed(200ms) ---> Vector Search(150ms) ---+
          |                                                |--> RRF Merge -> Rerank(300ms) -> Generate(800ms)
          +---> BM25 Keyword Search(100ms) ---------------+
          |
          +---> Cache Check(5ms) -- HIT --> Return cached (5ms total)

With cache miss: ~1050ms (embedding + keyword in parallel)
With cache hit:  ~5ms
```

### 并行检索

```python
async def parallel_retrieve(
    query: str,
    query_embedding: list[float],
    indexes: list[str],
) -> list[Chunk]:
    """Run vector search, keyword search, and graph traversal in parallel."""

    tasks = [
        vector_search(query_embedding, index="main", top_k=20),
        bm25_search(query, index="main", top_k=20),
        # Optionally, graph-based retrieval for entity queries
        graph_search(query, max_hops=2, top_k=10),
    ]

    # All retrieval strategies execute concurrently
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Filter out failures (graceful degradation)
    valid_results = [r for r in results if not isinstance(r, Exception)]

    # Merge with Reciprocal Rank Fusion
    merged = reciprocal_rank_fusion(valid_results, k=60)

    return merged[:20]  # top 20 after fusion
```

### 批量嵌入

在同时处理摄取或多个查询时，对嵌入调用进行批处理，以最大化 GPU 利用率。

```python
class EmbeddingBatcher:
    """Batch embedding requests to reduce per-call overhead."""

    def __init__(self, model: str, batch_size: int = 64, max_wait_ms: int = 50):
        self.model = model
        self.batch_size = batch_size
        self.max_wait = max_wait_ms / 1000
        self.queue: asyncio.Queue = asyncio.Queue()
        self._running = True

    async def embed(self, text: str) -> list[float]:
        """Submit a single text and wait for its embedding."""
        future = asyncio.Future()
        await self.queue.put((text, future))
        return await future

    async def _batch_loop(self):
        """Background loop that collects and processes batches."""
        while self._running:
            batch = []
            try:
                # Wait for at least one item
                item = await asyncio.wait_for(
                    self.queue.get(), timeout=1.0
                )
                batch.append(item)

                # Collect more items up to batch_size or max_wait
                deadline = time.time() + self.max_wait
                while len(batch) < self.batch_size and time.time() < deadline:
                    try:
                        item = await asyncio.wait_for(
                            self.queue.get(),
                            timeout=max(0, deadline - time.time())
                        )
                        batch.append(item)
                    except asyncio.TimeoutError:
                        break

                # Process the batch
                texts = [t for t, _ in batch]
                embeddings = await embed_batch(self.model, texts)

                for (_, future), emb in zip(batch, embeddings):
                    future.set_result(emb)

            except asyncio.TimeoutError:
                continue
```

### 带早期检索的流式生成

在用户输入尚未完成之前就开始检索（基于暂停检测），并在生成 token 产出时进行流式输出。

```
Timeline:
0ms     User starts typing...
300ms   Pause detected -> trigger retrieval speculatively
500ms   User submits query
        Retrieval already 200ms in -> finishes at 650ms
650ms   Reranking begins
950ms   First generation token streams to user
1800ms  Full response complete

vs. without speculation:
0ms     User submits query
200ms   Embedding
350ms   Retrieval
650ms   Reranking
1500ms  First token
2300ms  Full response complete
```

---

## 纠正式 RAG：自检检索

纠正式 RAG（CRAG）在检索和生成之间增加了一层验证。系统会在生成响应之前评估检索到的文档是否真正回答了查询。

### CRAG 决策循环

```
  User Query
      |
      v
  Retrieve Top-K
      |
      v
+------------------+
| Relevance Grader  |  "Are these docs relevant to the query?"
| (LLM or trained   |
|  classifier)      |
+--------+---------+
         |
    +----+----+--------+
    |         |        |
    v         v        v
 CORRECT   AMBIGUOUS  WRONG
    |         |        |
    v         v        v
 Generate  Supplement  Discard &
 directly  with web    re-retrieve
           search      with reformulated
                       query
```

AMBIGUOUS 分支需要网页搜索后端，网关如今也提供这项服务。Cloudflare 的 Web Search API（2026 年 10 月 2 日测试版）运行在 AI Gateway 中，返回来自 Ceramic.ai、Exa 和 Linkup 的结构化网页摘要，按合作伙伴标价收费且不加价，账单和日志统一通过网关处理。无论由谁提供搜索，都必须将网页结果视为不可信输入：它们可能包含提示词注入，应放在单独且明确标注的上下文块中，不能在提示词中凌驾于租户自有文档之上。

### 实现

```python
class CorrectiveRAG:
    """Self-correcting RAG pipeline with retrieval quality checks."""

    def __init__(self, max_corrections: int = 2):
        self.max_corrections = max_corrections

    async def answer(self, query: str) -> RAGResponse:
        attempts = 0
        current_query = query
        all_sources = []

        while attempts <= self.max_corrections:
            # Step 1: Retrieve
            chunks = await retrieve(current_query, top_k=10)

            # Step 2: Grade relevance
            grade = await self._grade_relevance(query, chunks)

            if grade.verdict == "correct":
                # High-confidence retrieval, generate directly
                return await self._generate(query, chunks, all_sources)

            elif grade.verdict == "ambiguous":
                # Supplement with additional search
                web_results = await web_search(current_query)
                chunks = self._merge_and_dedupe(chunks, web_results)
                return await self._generate(query, chunks, all_sources)

            else:  # "wrong"
                # Reformulate query and retry
                current_query = await self._reformulate(
                    original_query=query,
                    failed_query=current_query,
                    reason=grade.reason,
                )
                all_sources.extend(chunks)
                attempts += 1

        # Exhausted retries: generate best-effort with disclaimer
        return await self._generate_with_caveat(query, all_sources)

    async def _grade_relevance(
        self, query: str, chunks: list[Chunk]
    ) -> RelevanceGrade:
        """Use LLM to grade whether chunks answer the query."""
        prompt = f"""Given this query and retrieved documents, assess relevance.

Query: {query}

Documents:
{self._format_chunks(chunks)}

Respond with:
- verdict: "correct" (docs clearly answer the query)
- verdict: "ambiguous" (docs partially relevant, need supplementing)
- verdict: "wrong" (docs are irrelevant to the query)
- reason: brief explanation

JSON response:"""

        result = await llm_call(prompt, response_format="json")
        return RelevanceGrade(**json.loads(result))
```

### Self-RAG：批判 token

Self-RAG 通过内联批判 token 扩展了这一模式。模型在每一步都会评估自己的输出：

1. **[检索]**：我应该检索吗？（是/否）
2. **[相关]**：检索到的信息相关吗？（是/否）
3. **[已支持]**：我的答案是否有证据支持？（完全/部分/否）
4. **[有用]**：这个答案真的有用吗？（分数 1-5）

如果任何批判检查失败，模型会回退到更早的步骤。

---

## 自适应检索

并非每个查询都能从检索中获益。自适应检索会动态决定是否检索、检索多少，以及从哪些来源检索。

### 检索决策树

```
  User Query
      |
      v
  "Does this query need external knowledge?"
      |
  +---+---+
  |       |
  No      Yes
  |       |
  v       v
Direct   "How complex is the retrieval need?"
 LLM      |
answer  +-+--+---------+
        |    |         |
        v    v         v
     Single Multi    Agentic
      hop   hop      (planning
        |    |       required)
        v    v         |
     1 index 2-3       v
     top-5  indexes  Full agent
             top-10  loop
```

### 查询复杂度估计器

```python
class AdaptiveRetriever:
    """Decides retrieval strategy based on query characteristics."""

    async def retrieve(self, query: str) -> RetrievalPlan:
        # Fast heuristics first
        if self._is_general_knowledge(query):
            return RetrievalPlan(strategy="none", reason="general knowledge")

        if self._is_simple_lookup(query):
            return RetrievalPlan(
                strategy="single_hop",
                indexes=["primary"],
                top_k=5,
            )

        # LLM-based assessment for ambiguous cases
        plan = await self._plan_retrieval(query)
        return plan

    def _is_general_knowledge(self, query: str) -> bool:
        """Check if query is about widely known facts."""
        general_indicators = [
            "what is", "who is", "define", "explain the concept",
        ]
        has_org_refs = bool(re.search(
            r"(our|my|the company|internal|proprietary)", query.lower()
        ))
        is_general = any(
            query.lower().startswith(g) for g in general_indicators
        )
        return is_general and not has_org_refs

    def _is_simple_lookup(self, query: str) -> bool:
        """Check if query can be answered with a single document."""
        single_hop_patterns = [
            r"what is (the|our) .+ policy",
            r"how (do I|to) .+",
            r"where (can I|do I) find",
        ]
        return any(re.search(p, query.lower()) for p in single_hop_patterns)
```

### 面向令牌预算的检索

根据可用的令牌预算和预期的响应复杂度来调整检索投入。

```python
def plan_retrieval_budget(query: str, max_budget_tokens: int = 4000):
    """Allocate token budget across retrieval and generation."""

    complexity = estimate_complexity(query)  # 1-5 scale

    if complexity <= 2:
        # Simple query: small context, save tokens for generation
        return {"context_tokens": 1000, "generation_tokens": 3000, "top_k": 3}
    elif complexity <= 4:
        # Medium: balanced
        return {"context_tokens": 2500, "generation_tokens": 1500, "top_k": 8}
    else:
        # Complex: heavy retrieval, concise generation
        return {"context_tokens": 3500, "generation_tokens": 500, "top_k": 15}
```

### 作为托管功能的自适应推理强度

托管搜索服务如今将这种升级模式作为配置提供。Azure AI Search 知识库在 REST API 2026-04-01 中正式可用（抽取式检索已正式可用，查询规划和答案合成仍在预览）；2026-08-01-preview API 新增 `retrievalReasoningEffort: "auto"`：先进行轻量检索，仅在依据不足时才升级到 LLM 查询规划，最高为中等强度。同一预览版还通过服务器发送事件流式返回检索结果，并允许按知识源跳过重排序。如果自行构建路由器，应沿用这种形式：低价路径为默认路径，升级触发器必须基于实测的依据充分性信号，而不是猜测查询复杂度。

---

## 成本优化模式

在大规模场景下，RAG（检索增强生成）成本会在嵌入、检索、重排序和生成各环节不断累积。未经优化的系统可能会花费 10-50x 更多的成本。

### 典型 RAG 查询的成本拆分

```
Component         Cost per Query    % of Total    Optimization
-----------------------------------------------------------------
Embedding         $0.000005         ~1%           Batch + cache
Vector Search     $0.00001          ~2%           Index optimization
Reranking         $0.0001           ~5-15%        Skip for simple queries
LLM Generation    $0.0004-0.008     ~80-95%       Model tiering, caching
-----------------------------------------------------------------
Total (naive)     ~$0.001-0.01
Total (optimized) ~$0.0002-0.002    (5-10x reduction)
```

### 分层模型策略

```
                Query Complexity
                Low         Medium        High
             +----------+----------+----------+
 Generation  |  Small   |  Mid     |  Large   |
 Model       |  Model   |  Model   |  Model   |
             | (GPT-6   | (Sonnet  | (Opus    |
             |  Luna)   |  5.5)    |  5.5)    |
             | ~$0.0004 | ~$0.008  | ~$0.016  |
             +----------+----------+----------+

 Reranking   |  Skip    | Lightweight| Cross-  |
             |          | reranker   | encoder |
             +----------+----------+----------+
```

成本以每次请求 2.6K 输入、300 输出 token，按 2026 年 10 月 1 日标价估算，尚未计入推理 token。价格差主要集中在小型和中型模型之间：Claude Opus 5.5（$4 / $20）只比 Sonnet 5.5（$2 / $10）贵一倍，而 Sonnet 5.5 或 GPT-6 Sol 的价格是 GPT-6 Luna 的 20 倍。因此，路由的主要价值在小型/中型边界，应把分类器精力放在那里；中型/大型边界的收益往往难以抵消误路由成本。

### 渐进式细化模式

先用最少的检索进行回答。只有在用户提出后续问题，或者置信度较低时，才升级检索。

```python
class ProgressiveRAG:
    """Start cheap, escalate only when needed."""

    async def answer(self, query: str, session: Session) -> str:
        # Level 1: Try semantic cache
        cached = await self.cache.get(query)
        if cached:
            return cached.response  # Cost: ~$0

        # Level 2: Fast retrieval + small model
        chunks = await retrieve(query, top_k=3)
        response = await generate(
            query, chunks, model="gpt-6-luna"
        )

        # Check confidence
        if response.confidence > 0.85:
            await self.cache.put(query, response)
            return response.text  # Cost: ~$0.0003

        # Level 3: Deep retrieval + reranking + larger model
        chunks = await retrieve(query, top_k=15)
        reranked = await rerank(query, chunks, top_k=5)
        response = await generate(
            query, reranked, model="claude-sonnet-5-5"  # replaces claude-sonnet-4-5 (retires Nov 30, 2026)
        )

        if response.confidence > 0.7:
            await self.cache.put(query, response)
            return response.text  # Cost: ~$0.008

        # Level 4: Full agentic pipeline (expensive but thorough)
        return await self.agentic_pipeline.run(query)  # Cost: ~$0.05
```

### 成本护栏

```python
class CostGuard:
    """Prevent runaway costs in production RAG."""

    def __init__(self):
        self.daily_budget = 500.0  # $500/day
        self.per_query_limit = 0.10  # $0.10 max per query
        self.per_user_hourly = 1.0  # $1/user/hour

    async def check(self, user_id: str, estimated_cost: float) -> bool:
        daily_spent = await self.get_daily_spend()
        if daily_spent + estimated_cost > self.daily_budget:
            raise BudgetExceededError("Daily budget exhausted")

        user_spent = await self.get_user_hourly_spend(user_id)
        if user_spent + estimated_cost > self.per_user_hourly:
            raise RateLimitError("User hourly budget exceeded")

        if estimated_cost > self.per_query_limit:
            # Downgrade to cheaper strategy
            return False  # signals caller to use cheaper path

        return True
```

### 自建还是购买：托管 RAG 的单价

托管检索现在公开每次查询的价格，让自建与购买成为一道算术题。Cloudflare AI Search 于 2026 年 10 月 1 日正式可用：底层使用 Workers AI、Vectorize、R2 和 Browser Run，向量与关键词搜索并行运行，支持融合、可选重排序、扫描 PDF 的可选 OCR，以及通过 Qwen3-VL-Embedding 进行图像检索。收费从 2026 年 11 月 1 日开始：

| 项目 | 价格 | 每月免费额度（所有 Workers 套餐） |
|------|-------|-------------------------------------|
| 摄入 | 每百万 token $0.75；图像处理另加每百万 token $0.50 | 500 万 token |
| 存储 | 每 GB 每月 $2.00 | 10 GB |
| 语义查询（向量或混合） | 每千次 $0.75 | 1,000 次 |
| 全文查询 | 每千次 $0.10 | 1,000 次 |

每月一百万次混合查询的检索成本为 $750，远低于自行运维技术栈的工程人力成本。但在 1,000 QPS（每月约 26 亿次查询）下，仅检索费就约为每月 $190 万，足以支付不少自托管向量数据库节点和一支值班团队。分界点大约在每月数千万次查询，应结合自己的基础设施和人员成本计算。其他供应商也在打包相同的技术栈：Cohere Compass Cloud（2026 年 9 月 25 日私人测试）把解析、稠密与稀疏嵌入、权限感知检索和重排序封装在 MCP 服务器之后，供智能体逐步缩小语料范围。

**生命周期风险是“购买”决策的另一半。** OpenAI 于 2026 年 8 月 26 日关闭 Assistants API。向量存储仍可沿用：Responses API 的 `file_search` 工具接收相同的 `vector_store_ids`、`max_num_results` 和元数据过滤条件，因此索引无需重新摄入；但线程与运行编排代码必须重写。保持检索存储与编排解耦，才能单独迁移其中任何一方。

---

## 失败模式与调试

生产环境中的 RAG 系统具有叠加的失败概率。若每个三个阶段的可靠性均为 95%，则整体可靠性会降至 0.95 x 0.95 x 0.95 = 0.86。理解失败模式至关重要。

### RAG 失败分类法

```
+------------------------------------------------------------------+
|                    RAG Failure Modes                               |
+------------------------------------------------------------------+
|                                                                    |
|  RETRIEVAL FAILURES          GENERATION FAILURES                   |
|  +---------------------+    +-------------------------+           |
|  | Missing documents   |    | Hallucination despite   |           |
|  | (not indexed)       |    | good context            |           |
|  +---------------------+    +-------------------------+           |
|  | Wrong chunks        |    | Ignoring retrieved      |           |
|  | (low precision)     |    | context                 |           |
|  +---------------------+    +-------------------------+           |
|  | Missed chunks       |    | Over-reliance on one    |           |
|  | (low recall)        |    | source                  |           |
|  +---------------------+    +-------------------------+           |
|  | Stale embeddings    |    | Citation fabrication    |           |
|  | (drift)             |    |                         |           |
|  +---------------------+    +-------------------------+           |
|                                                                    |
|  SYSTEM FAILURES             QUALITY FAILURES                      |
|  +---------------------+    +-------------------------+           |
|  | Index unavailable   |    | Chunking artifacts      |           |
|  +---------------------+    +-------------------------+           |
|  | Embedding service   |    | Context window overflow |           |
|  | timeout             |    +-------------------------+           |
|  +---------------------+    | Answer too vague        |           |
|  | Reranker OOM        |    | (over-hedging)          |           |
|  +---------------------+    +-------------------------+           |
|                                                                    |
+------------------------------------------------------------------+
```

### 许多检索失败其实是分块失败

检索器只能返回分块器创建的内容。如果一项事实被拆到两个分块，或者分块失去了赋予其含义的章节标题，那么无论嵌入模型和重排序器多好，也无法检出完整答案。因此，当下方清单指向检索问题时，应先检查分块，再考虑更换嵌入模型。常见的分块失败包括：

- **分块过小**：丢失上下文。“它要价 $200”——到底是什么要价 $200？
- **分块过大**：削弱相关性。一个 2000 令牌的分块里，只有 1 句相关。
- **边界切分**：表格或列表被拆分到两个分块中。
- **缺少元数据**：分块缺少标题、文档名或章节上下文。

### 调试检查清单

```
When RAG quality drops, investigate in this order:

1. RETRIEVAL QUALITY (check first: most common root cause)
   [ ] Log the query and retrieved chunks side by side
   [ ] Compute retrieval precision@K manually for 20 failing queries
   [ ] Check if relevant documents exist in the index at all
   [ ] Compare BM25 vs vector results: if BM25 wins, embeddings are stale

2. CHUNKING QUALITY (check second)
   [ ] Sample 50 random chunks: do they make sense in isolation?
   [ ] Check chunk boundaries for tables, lists, code blocks
   [ ] Verify metadata (title, section, doc_id) is present

3. RERANKING QUALITY (check third)
   [ ] Compare pre-rerank vs post-rerank orderings
   [ ] Check if reranker is pushing relevant results down

4. GENERATION QUALITY (check last)
   [ ] Test with perfect context (manually curated): does LLM still fail?
   [ ] Check for context window overflow (truncated chunks)
   [ ] Verify system prompt is not conflicting with retrieved context
```

### 智能体式 RAG 失败模式

智能体式 RAG 会引入另外三种失败模式：

1. **检索震荡**：智能体反复检索，但始终无法收敛到答案。追踪日志显示近乎重复的查询，以及来回摆动的搜索词。修复：将检索迭代次数限制为 3-5 次，并按会话跟踪查询唯一性。

2. **工具风暴**：智能体在单轮中过度调用工具。修复：为每个查询设置工具调用上限和成本上限。

3. **上下文膨胀**：智能体积累了过多检索分块，导致上下文窗口溢出。修复：实现滑动窗口，在上下文超过阈值时丢弃最旧的分块。

---

## 监控与告警

生产环境中的 RAG 需要专门的监控，不能只依赖标准应用指标。应将系统化评估视为第一天就需要具备的能力，而不是沿用早期 RAG“先上线，后评估”的模式；指标和评审模型分层参见 [RAG 评估模式](13-rag-evaluation-patterns.md)。

### RAG 监控栈

```
+--------------------------------------------------------------------+
|                    RAG Observability Layers                          |
+--------------------------------------------------------------------+
|                                                                      |
|  L1: INFRASTRUCTURE          L2: PIPELINE                           |
|  +----------------------+   +-----------------------------+         |
|  | Latency (p50/p95/p99)|   | Retrieval precision@K      |         |
|  | Error rates          |   | Retrieval recall@K         |         |
|  | Throughput (QPS)     |   | Reranker effectiveness     |         |
|  | Cache hit rate       |   | Chunk utilization rate     |         |
|  | Index size/growth    |   | Context window fill rate   |         |
|  +----------------------+   +-----------------------------+         |
|                                                                      |
|  L3: QUALITY                 L4: BUSINESS                           |
|  +----------------------+   +-----------------------------+         |
|  | Faithfulness score   |   | User satisfaction (thumbs) |         |
|  | Answer relevancy     |   | Task completion rate       |         |
|  | Hallucination rate   |   | Escalation to human rate   |         |
|  | Citation accuracy    |   | Cost per successful query  |         |
|  +----------------------+   +-----------------------------+         |
|                                                                      |
+--------------------------------------------------------------------+
```

### 关键指标与告警

| 指标 | 目标 | 告警阈值 | 动作 |
|--------|--------|-----------------|--------|
| **p95 延迟** | <2s | >5s | 扩展检索基础设施 |
| **缓存命中率** | >40% | <20% | 调整相似度阈值 |
| **检索精确率@5** | >0.7 | <0.5 | 重新评估分块 |
| **忠实度** | >0.9 | <0.8 | 审查生成提示词 |
| **幻觉率** | <5% | >10% | 收紧事实依据提示词 |
| **空检索率** | <2% | >5% | 检查索引覆盖率 |
| **每次查询成本** | <$0.005 | >$0.02 | 审查模型分层 |

### 端到端追踪日志

每个查询都应生成一条追踪记录，用单个请求 ID 串联所有流水线阶段。

```python
@dataclass
class RAGTrace:
    request_id: str
    timestamp: datetime
    query: str
    route: str                    # "simple_rag", "complex_rag", etc.
    cache_hit: bool
    retrieval_latency_ms: float
    chunks_retrieved: int
    chunks_after_rerank: int
    rerank_latency_ms: float
    generation_model: str
    generation_latency_ms: float
    total_latency_ms: float
    input_tokens: int
    output_tokens: int
    estimated_cost: float
    faithfulness_score: float     # 0-1, computed async
    user_feedback: Optional[str]  # thumbs up/down

    def to_dict(self) -> dict:
        return asdict(self)
```

### 自动化质量抽样

对生产查询样本运行离线评估，以便在用户察觉之前发现质量漂移。

```python
async def nightly_quality_check(sample_size: int = 200):
    """Sample production queries and evaluate RAG quality."""
    traces = await get_recent_traces(limit=sample_size)

    scores = []
    for trace in traces:
        # Re-run the query with evaluation
        eval_result = await evaluate_rag_response(
            query=trace.query,
            response=trace.response,
            retrieved_chunks=trace.chunks,
            metrics=["faithfulness", "relevancy", "context_precision"],
        )
        scores.append(eval_result)

    avg_faithfulness = mean([s.faithfulness for s in scores])
    avg_relevancy = mean([s.relevancy for s in scores])

    if avg_faithfulness < 0.85:
        alert("RAG faithfulness degraded", severity="high")
    if avg_relevancy < 0.70:
        alert("RAG relevancy degraded", severity="medium")

    publish_metrics("rag.nightly.faithfulness", avg_faithfulness)
    publish_metrics("rag.nightly.relevancy", avg_relevancy)
```

---

## 扩展到数百万份文档

从数千份文档扩展到数百万份文档，会在索引吞吐量、检索延迟和索引管理方面带来挑战。

### 扩展维度

```
Documents:   1K  -->  100K  -->  1M  -->  100M
             |        |         |         |
Chunks:      10K      1M        10M       1B
             |        |         |         |
Index Size:  50MB     5GB       50GB      5TB
             |        |         |         |
Strategy:    Single   Single    Sharded   Distributed
             Node     Node +    Index     Cluster +
                      Replicas             Tiered
```

### 大规模摄取流水线

```
  Document Sources
  (S3, DBs, APIs, File Shares)
         |
         v
+-------------------+
| Ingestion Queue   |  (Kafka / SQS)
| - Deduplication   |
| - Priority queue  |
+--------+----------+
         |
    +----+----+----+----+
    |    |    |    |    |     Parallel workers
    v    v    v    v    v
  +--+ +--+ +--+ +--+ +--+
  |W1| |W2| |W3| |W4| |W5|  Parse + Chunk + Embed
  +--+ +--+ +--+ +--+ +--+
    |    |    |    |    |
    +----+----+----+----+
         |
         v
+-------------------+
| Vector DB Cluster |
| (Sharded by       |
|  doc_type or      |
|  tenant_id)       |
+-------------------+
```

### 分片策略

| 策略 | 工作方式 | 优点 | 缺点 |
|----------|-------------|------|------|
| **基于哈希** | shard = hash(doc_id) % N | 分布均匀 | 需要跨分片查询 |
| **基于范围** | 按日期范围分片 | 基于时间的查询很快 | 分片大小不均 |
| **基于领域** | 按文档类型分片 | 不需要跨分片查询 | 领域不平衡 |
| **基于租户** | 按 tenant_id 分片 | 隔离性完美 | 会产生许多小分片 |

### 索引维护

在达到数百万份文档规模时，索引维护会成为关键的运维关注点。

```python
class IndexMaintenanceScheduler:
    """Scheduled tasks for index health at scale."""

    async def run_daily(self):
        # 1. Detect and re-embed stale documents
        stale_docs = await find_docs_with_old_embeddings(
            older_than_days=90,
            embedding_model_version="v2"  # current is v3
        )
        if stale_docs:
            await enqueue_reembedding(stale_docs)

        # 2. Remove orphaned vectors (doc deleted but vector remains)
        orphans = await find_orphaned_vectors()
        if orphans:
            await delete_vectors(orphans)

        # 3. Compact and optimize indexes
        for shard in await list_shards():
            if shard.fragmentation_pct > 20:
                await compact_shard(shard.id)

        # 4. Verify index health
        for shard in await list_shards():
            health = await check_shard_health(shard.id)
            if not health.ok:
                alert(f"Shard {shard.id} unhealthy: {health.reason}")
```

### 无停机重新嵌入

“更换嵌入模型就必须完整重建索引”不再是唯一方案：

- **共享嵌入空间。** Voyage 4 家族（voyage-4-large 每百万 token $0.12、voyage-4 $0.06、voyage-4-lite $0.02，另有开放权重的 voyage-4-nano）共用一个空间；Cohere 的 `embed-v5.0-pro` 和 `-fast`（2026 年 9 月 30 日）也是如此。用大模型建一次索引，再用小模型查询，就能在不动索引的情况下更换查询侧模型。Qdrant 的 Constella 研究预览版（2026 年 9 月 29 日）更进一步：文档索引固定使用 Stella（400M），查询编码器可更换；其中 3450 万参数的 Constella Nano 保留了 Stella 在 BEIR 上约 91% 的 nDCG@10，CPU 延迟则降低了 12 倍（供应商报告）。
- **在线回填。** 如果文档侧必须改变，则添加第二个向量字段，在后台回填，在黄金集上对两者执行影子查询，再切换。Milvus 3.0（2026 年 7 月）支持在线添加、回填和删除列，使数亿行规模也能热切换。
- **数据库内部嵌入。** MongoDB Atlas Automated Embedding（2026 年 8 月 13 日正式可用）和 turbopuffer 原生嵌入（2026 年 9 月 29 日正式可用）移除了同步流水线，但也让索引绑定到供应商选择的模型版本。采用前应询问模型升级和重新嵌入如何安排、如何计费。

### 内存层级与量化

1,536 维 float32 向量占 6 KB，因此十亿个分块在计算索引图之前就约需 6 TB。基于旋转的低 bit 量化是主要手段，而且**需要主动开启或仍处于预览阶段，并非默认配置**：Qdrant 1.18 加入 Hadamard 旋转的 TurboQuant，1.19 加入仅保存 4 bit 的 Turbo4 类型（比 float32 加 4-bit 副本小 9 倍，但原始向量不再保留，峰值召回会受损）；Weaviate 1.39 预览版的 4-bit Rotational Quantization 可将 1,536 维向量从 6,144 字节压至 784 字节。Qdrant 1.19 还用统一的 `memory` 设置（pinned、cached 或 cold）替换 `on_disk` / `always_ram`，覆盖向量、HNSW、稀疏索引和载荷索引。

生产模式是：将量化向量固定在内存中用于候选搜索，把全精度原始向量冷存于磁盘以对候选结果重打分，并在每次调整量化方案后，将 ANN 召回率与精确 kNN 比较（参见 [RAG 评估模式](13-rag-evaluation-patterns.md#区分嵌入模型与索引的问题)）。

### 用于检索的只读副本

将读写路径分离，确保摄取过程不会降低查询延迟。

```
  Ingestion Pipeline              Query Pipeline
        |                              |
        v                              v
  +-----------+     Replication   +-----------+
  |  Primary  | ----------------> |  Replica  |
  |  (Write)  |                   |  (Read)   |
  +-----------+                   +-----------+
                                  |  Replica  |
                                  |  (Read)   |
                                  +-----------+
                                  |  Replica  |
                                  |  (Read)   |
                                  +-----------+
```

---

## 多租户 RAG（检索增强生成）隔离

多租户 RAG 是 SaaS 产品中最常见的生产模式。隔离做错意味着租户之间发生数据泄漏，这是严重的安全故障。

### 三种隔离模型

```
SILO MODEL (Strongest Isolation)
+----------+  +----------+  +----------+
| Tenant A |  | Tenant B |  | Tenant C |
| +------+ |  | +------+ |  | +------+ |
| |Index | |  | |Index | |  | |Index | |
| +------+ |  | +------+ |  | +------+ |
| |Cache | |  | |Cache | |  | |Cache | |
| +------+ |  | +------+ |  | +------+ |
+----------+  +----------+  +----------+
Cost: $$$$    Best for: Enterprise, Regulated Industries


POOL MODEL (Cost-Efficient)
+-------------------------------------------+
|              Shared Index                  |
|  [A] [B] [A] [C] [B] [A] [C] [B] [C]    |
|                                            |
|  Every query includes:                     |
|  WHERE tenant_id = ? (MANDATORY)           |
+-------------------------------------------+
Cost: $       Best for: SMB SaaS


BRIDGE MODEL (Hybrid)
+----------+  +----------------------------+
| Tenant A |  |     Shared Pool            |
| (Enterprise) | [B] [C] [D] [E] [F] [G]  |
| +------+ |  |                            |
| |Dedicated|  | WHERE tenant_id = ?       |
| |Index | |  +----------------------------+
| +------+ |
+----------+
Cost: $$      Best for: Mixed customer base
```

### 安全性：纵深防御

```python
class TenantIsolatedRetriever:
    """Enforces tenant isolation at every retrieval layer."""

    async def retrieve(
        self, query: str, tenant_id: str, user_id: str
    ) -> list[Chunk]:
        # Layer 1: Tenant ID is MANDATORY in every query
        if not tenant_id:
            raise SecurityError("tenant_id required for retrieval")

        # Layer 2: Validate user belongs to tenant
        if not await self.authz.user_in_tenant(user_id, tenant_id):
            raise AuthorizationError("User not in tenant")

        # Layer 3: Apply tenant filter at the database level
        chunks = await self.vector_db.search(
            query_embedding=await embed(query),
            filter={"tenant_id": {"$eq": tenant_id}},  # ALWAYS filtered
            top_k=10,
        )

        # Layer 4: Post-retrieval verification
        for chunk in chunks:
            assert chunk.metadata["tenant_id"] == tenant_id, \
                f"Cross-tenant leak detected: {chunk.id}"

        # Layer 5: Audit log
        await self.audit_log.record(
            action="retrieve",
            tenant_id=tenant_id,
            user_id=user_id,
            chunk_ids=[c.id for c in chunks],
        )

        return chunks
```

### 租户过滤器阻止不了的泄漏

强制 `tenant_id` 过滤可以阻止跨租户的*结果*，却不能阻止跨租户的*信号*：

| 通道 | 泄漏方式 | 缓解措施 |
|---------|--------------|------------|
| **共享 BM25 统计量** | 池化索引中的 IDF 由所有租户的文档共同计算，因此一个租户的词汇会改变另一个租户的排序，分数也会反映整个语料的词频 | 按租户计算 IDF（Qdrant 1.19 已为稀疏/BM25 搜索加入此功能），或使用隔离的词法索引 |
| **推理前缀缓存** | 在自托管引擎中，共享前缀缓存可能成为判断其他租户是否发送过相同前缀的时间侧信道 | 所有代码路径都使用租户专属的缓存盐。vLLM 的 GHSA-935w-9g4m-p28p 曾有一条路径遗漏该盐；使用 vLLM 0.30.0 或更高版本 |
| **语义响应缓存** | 将基于租户 A 文档生成的答案，返回给提出相似问题的租户 B | 缓存键必须包含租户和 ACL 集合，不能全局共享 |
| **引擎漏洞** | 任何有权构建索引的角色都可能触发漏洞 | pgvector 0.8.7（2026 年 10 月 1 日）修复了 CVE-2026-103484：0.8.6 及更早版本在构建 IVFFlat 时可能溢出并导致代码执行。不要向应用角色授予索引创建权限，并确认托管 Postgres 已提供补丁 |

Silo 现在也可以指客户自己的云账户：Pinecone BYOC 于 2026 年 9 月 23 日在 AWS、Google Cloud 和 Azure 正式可用，将向量、文档、元数据和请求载荷等数据平面放在客户云中；供应商控制平面只通过向外发起的连接来管理它。

### 感知租户的摄取

必须在流水线的每个阶段注入租户上下文，从摄取一直到生成。

```
Document Upload (Tenant A)
        |
        v
  +---------------------+
  | Validate Ownership  |  Does this doc belong to Tenant A?
  +---------------------+
        |
        v
  +---------------------+
  | Chunk + Embed       |  Attach tenant_id to every chunk
  +---------------------+
        |
        v
  +---------------------+
  | Index with Metadata |  {"tenant_id": "A", "doc_id": "...", ...}
  +---------------------+
        |
        v
  +---------------------+
  | Invalidate Cache    |  Clear Tenant A's cache entries
  +---------------------+             for affected documents
```

### 防止吵闹邻居

在池化模型中，某个租户的高负载可能会降低所有租户的性能。

```python
class TenantRateLimiter:
    """Per-tenant rate limiting and resource quotas."""

    def __init__(self):
        self.tenant_limits = {
            "free":       {"qps": 5,   "daily_queries": 500},
            "pro":        {"qps": 50,  "daily_queries": 10_000},
            "enterprise": {"qps": 200, "daily_queries": 100_000},
        }

    async def check(self, tenant_id: str, tier: str) -> bool:
        limits = self.tenant_limits[tier]

        current_qps = await self.redis.get(f"qps:{tenant_id}")
        if current_qps and int(current_qps) >= limits["qps"]:
            raise RateLimitError(f"QPS limit ({limits['qps']}) exceeded")

        daily_count = await self.redis.get(f"daily:{tenant_id}")
        if daily_count and int(daily_count) >= limits["daily_queries"]:
            raise RateLimitError("Daily query limit exceeded")

        # Increment counters
        pipe = self.redis.pipeline()
        pipe.incr(f"qps:{tenant_id}")
        pipe.expire(f"qps:{tenant_id}", 1)  # 1-second window
        pipe.incr(f"daily:{tenant_id}")
        pipe.expire(f"daily:{tenant_id}", 86400)
        await pipe.execute()

        return True
```

---

## 真实世界架构示例

### 示例 1：客户支持 RAG

```
+------------------------------------------------------------------+
|                   Customer Support RAG System                     |
+------------------------------------------------------------------+
|                                                                    |
|  Customer Query                                                    |
|       |                                                            |
|       v                                                            |
|  +------------+    +---------+    +------------------+             |
|  | Query      |--->| Semantic|--->| Intent           |             |
|  | Normalizer |    | Cache   |    | Classifier       |             |
|  +------------+    +---------+    +--------+---------+             |
|                     (hit->skip)            |                       |
|                                   +--------+---------+             |
|                                   |                  |             |
|                                   v                  v             |
|                             +-----------+    +-------------+      |
|                             | Knowledge |    | Order/Acct  |      |
|                             | Base RAG  |    | Database    |      |
|                             | (articles,|    | (SQL lookup)|      |
|                             |  FAQs)    |    +-------------+      |
|                             +-----------+           |              |
|                                   |                 |              |
|                                   +--------+--------+              |
|                                            |                       |
|                                            v                       |
|                                   +------------------+             |
|                                   | Response Gen     |             |
|                                   | (with citations  |             |
|                                   |  + confidence)   |             |
|                                   +--------+---------+             |
|                                            |                       |
|                                   +--------+---------+             |
|                                   |                  |             |
|                                   v                  v             |
|                            confidence > 0.8    confidence < 0.8   |
|                            Auto-respond        Route to human      |
|                                                                    |
+------------------------------------------------------------------+

Scale: 50K articles, 2M customer interactions/month
Latency SLA: p95 < 3s
Cache hit rate: ~45%
Auto-resolution rate: ~60%
```

### 示例 2：企业知识平台

```
+------------------------------------------------------------------+
|              Enterprise Multi-Tenant Knowledge Platform            |
+------------------------------------------------------------------+
|                                                                    |
|  +------------------+                                              |
|  | Auth + Tenant    |                                              |
|  | Resolution       |                                              |
|  +--------+---------+                                              |
|           |                                                        |
|           v                                                        |
|  +------------------+                                              |
|  | Query Router     |                                              |
|  +--+----+----+-----+                                              |
|     |    |    |                                                     |
|     v    v    v                                                     |
|  +----+ +----+ +--------+                                          |
|  |Docs| |Wiki| |Tickets |  Per-domain indexes                     |
|  |Idx | |Idx | |Idx     |  (all tenant-filtered)                   |
|  +----+ +----+ +--------+                                          |
|     |    |    |                                                     |
|     +----+----+                                                     |
|          |                                                          |
|          v                                                          |
|  +------------------+                                              |
|  | Cross-Encoder    |                                              |
|  | Reranker         |                                              |
|  +--------+---------+                                              |
|           |                                                        |
|           v                                                        |
|  +------------------+     +-------------------+                    |
|  | Tiered LLM       |<--->| Permission Filter |                    |
|  | Generation        |     | (doc-level ACLs)  |                    |
|  +------------------+     +-------------------+                    |
|           |                                                        |
|           v                                                        |
|  +------------------+                                              |
|  | Response + Audit |                                              |
|  | Trail            |                                              |
|  +------------------+                                              |
|                                                                    |
+------------------------------------------------------------------+

Scale: 200 tenants, 10M documents total, 500K queries/day
Isolation: Bridge model (5 enterprise silos + shared pool)
Ingestion: Async via Kafka, ~50K docs/day
```

### 示例 3：法律文档分析

```
  User: "Summarize indemnification clauses across all vendor contracts"
      |
      v
  +---------------------+
  | Agentic RAG Planner |
  +---------------------+
      |
      | Plan: 1. Find all vendor contracts
      |        2. Extract indemnification clauses
      |        3. Synthesize comparison
      |
      v
  +---------------------+    +-------------------+
  | Step 1: Metadata    |--->| Filter: doc_type  |
  | Search              |    | = "vendor_contract"|
  +---------------------+    +-------------------+
      |                            |
      | 47 contracts found         |
      v                            v
  +---------------------+    +-------------------+
  | Step 2: Section     |--->| Filter: section   |
  | Retrieval           |    | = "indemnification"|
  +---------------------+    +-------------------+
      |                            |
      | 43 relevant sections       |
      v                            |
  +---------------------+         |
  | Step 3: Long Context|<--------+
  | Synthesis           |
  | (load 43 sections   |
  |  into 1M context)   |
  +---------------------+
      |
      v
  Comparative summary with
  per-contract citations
```

---

## 系统设计面试角度

### 问：设计一个 RAG（检索增强生成）系统，能够在 10,000 个每秒查询量（QPS）下，服务 500 个租户，并将 p99 延迟控制在 2 秒。

**强答案：**

我会把这个系统设计为四层。

**第 1 层：路由与缓存。** 查询路由器会对每个传入查询进行分类（直接 LLM、大型语言模型，简单 RAG，复杂 RAG）。三层缓存（精确匹配、语义缓存、文档缓存）可处理大约 40-50% 的流量。这意味着只有 5,000-6,000 的 QPS 实际会进入检索流水线。

**第 2 层：检索。** 我会使用桥隔离模型（bridge isolation model）——前 20 个企业租户使用专用索引（silo，信息孤岛），其余 480 个共享一个池化索引，并强制进行 tenant_id 过滤。检索并行运行混合搜索（向量检索 + BM25），再用 Reciprocal Rank Fusion（互惠排名融合）合并结果。向量数据库集群按租户层级分片，并进行只读副本复制以提升读取吞吐。

**第 3 层：生成。** 分层模型策略会把简单查询路由到小模型，把复杂查询路由到更大的模型。这样既能保持较低的平均成本，也能为困难查询维持质量。按租户限流可防止邻居噪声问题。

**第 4 层：可观测性。** 每个查询都会产生一条追踪记录，包含延迟拆分、检索得分和成本。夜间质量检查会抽样 500 个查询，评估忠实性（faithfulness）和相关性（relevancy）。如果 p95 延迟超过 3 秒，或忠实性低于 0.85，就会触发告警。

**成本估算**：10K QPS 相当于每天 8.64 亿次查询，因此单次请求的成本计算至关重要。缓存命中率为 50% 时，每天仍需生成 4.32 亿次。按每次请求 2.6K 输入和 300 输出 token、2026 年 10 月标价，以及 70% 使用 GPT-6 Luna（约 $0.0004/次）、30% 使用 Claude Sonnet 5.5 或 GPT-6 Sol 之类每百万 token 收费 $2 / $10 的中档模型（约 $0.008/次）计算，成本约为 $12 万加 $106 万，即每天约 **$120 万**，尚未计入共享系统提示词的缓存优惠。这个数字决定了实际设计：缓存静态提示词前缀（读取费率为 0.1 倍或更低）、提高缓存命中率、谈妥承诺用量价格，并自托管小模型层；毕竟每天约 3 亿次小模型请求，早已超过专用 GPU 集群比按 token 收费的 API 更经济的规模。

### 问：当 RAG 系统检索到不相关文档，但 LLM 仍然生成了听起来很合理的答案时，你会如何处理？

**强答案：**

这是最危险的 RAG 失败模式，因为它会产生“基于真实但不相关文档”的自信幻觉。我会从三个点来处理：

首先，在检索阶段实现相关性评分器（relevance grader）——一个分类器（或 LLM 调用），对每个检索到的 chunk 相对于查询进行打分。如果所有 chunk 的分数都低于阈值，系统应该要么升级到网页搜索（Corrective RAG 模式），要么直接返回“我没有足够的信息”，而不是基于薄弱上下文生成答案。

其次，在生成阶段使用受约束提示，要求模型在证据不足时明确说明。输出中加入置信度分数，并将低置信度答案路由给人工审核。

第三，在监控中跟踪检索分数与用户反馈之间的相关性。如果用户对检索分数很高的查询仍然给出差评，那么 reranker（重排序器）或 chunking 策略很可能是根因。记录完整追踪（查询、检索到的 chunks、生成答案、用户反馈），这样你就能调试具体失败案例。

### 问：你的 RAG 系统成本在过去一个月翻了三倍，但查询量没有增加。你会如何诊断和修复？

**强答案：**

我会按以下顺序调查：

首先，检查 **缓存命中率**。如果它下降了，就意味着更多查询在走完整流水线。常见原因包括：语义缓存阈值变更、数据更新后缓存失效过于激进，或者查询分布发生变化，与缓存中的查询不再匹配。

其次，检查 **模型路由分布**。如果查询分类器把更多查询路由到了昂贵的大模型，单这一点就足以让成本翻三倍。查看查询复杂度是否发生了变化，或者分类器行为是否漂移。

第三，检查 agentic RAG 路径中的 **检索抖动**。如果 Corrective RAG 循环更频繁地重试（可能是因为 embedding 过时或检索质量下降），那么每个查询都会触发多次检索和生成调用。追踪日志会显示每个查询的平均迭代次数。

第四，检查 **embedding（向量嵌入）流水线**。如果文档被不必要地重复嵌入（重复摄取、没有去重），embedding 成本就会飙升。

修复方案取决于根因，但常见措施包括：调整语义缓存阈值、为每个查询设置成本上限以强制走更便宜的回退路径、修复 embedding 陈旧问题以减少纠正式检索循环，以及在摄取流水线中加入去重。

---

## 参考资料

- Asai 等人，《Self-RAG：学习检索、生成与批判》（2024）
- Yan 等人，《纠正式检索增强生成（CRAG）》（2024）
- Shi 等人，《RAGRouter：学习将查询路由到多个 RAL 模型》（2025）
- Redis，《大规模 RAG：如何构建生产级 AI 系统于 2026》
- Anthropic，《1M 令牌上下文窗口正式可用》（2026 年 3 月）
- RAGAS 框架，《上下文精度、召回率、忠实性与相关性指标》
- AWS，《使用 Amazon Bedrock Knowledge Bases 的多租户 RAG》（2025）
- Microsoft，《设计安全的多租户 RAG 推理解决方案》（2025）
- Microsoft。《Azure AI Search 新功能》（智能体检索，2026-08-01-preview）
- Cloudflare。《AI Search is now generally available》及 AI Search 限制和定价（2026 年 10 月）
- Pinecone。《Pinecone Nexus is generally available》（2026 年 8 月）
- Qdrant。《Qdrant 1.19》发布说明（2026 年 8 月）
- pgvector。CHANGELOG，0.8.7（2026 年 10 月）

---

*上一篇：[RAG 评估模式](13-rag-evaluation-patterns.md) | 下一篇：[用于 AI 的数据工程](15-data-engineering-for-ai.md)*
