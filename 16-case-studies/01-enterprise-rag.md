# 案例研究：企业 RAG（Retrieval-Augmented Generation，检索增强生成）系统

本案例研究将演示如何为企业文档搜索设计一个生产级 RAG 系统。内容涵盖需求收集、架构决策和实现细节。

## 目录

- [问题陈述](#问题陈述)
- [需求分析](#需求分析)
- [系统架构](#系统架构)
- [组件深入剖析](#组件深入剖析)
- [扩展性考虑](#扩展性考量)
- [成本分析](#成本分析)
- [经验总结](#经验总结)
- [面试讲解](#面试讲解流程)

---

## 问题陈述

### 场景

一家金融服务公司希望为其内部文档构建一个 AI 驱动的搜索系统：
- 500,000 份文档（政策、流程、研究报告）
- 5,000 名员工，分布于多个部门
- 文档每日更新
- 严格的合规与审计要求
- 需要回答带有来源引用的问题

### 当前痛点

- 员工每天花费 2 小时以上搜索信息
- 关键词搜索返回过多无关结果
- 知识分散在各个部门之间
- 新员工需要数月才能变得高效

---

## 需求分析

### 功能需求

| 需求 | 优先级 | 说明 |
|-------------|----------|-------|
| 自然语言问答（Natural language Q&A） | P0 | 核心功能 |
| 来源引用（Source citations） | P0 | 合规要求 |
| 多文档推理（Multi-document reasoning） | P1 | 连接不同文档中的信息 |
| 追问（Follow-up questions） | P1 | 对话上下文 |
| 文档摘要（Document summarization） | P2 | 长文档快速概览 |

### 非功能性需求

| 需求 | 目标 | 理由 |
|-------------|--------|-----------|
| 延迟（P95） | < 5 seconds | 用户体验 |
| 准确率 | > 90% | 信任与采用 |
| 可用性 | 99.9% | 关键业务 |
| 并发用户数 | 500 | 峰值使用 |
| 文档新鲜度 | < 1 hour | 政策更新 |

### 安全需求

- 基于角色的访问控制（RBAC）
- 所有查询的审计日志
- 数据不得离开公司的云边界：模型调用经由零数据保留条件下的私有端点（Bedrock、Google Cloud 或 Foundry），合规要求时仅在美国处理（约 10% 溢价；见[成本分析](#成本分析)）
- PII（Personally Identifiable Information，个人身份信息）检测与处理

---

## 系统架构

### 高层架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           User Interface                                │
│  (Web App, Slack Bot, API)                                             │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          API Gateway                                    │
│  • Authentication    • Rate Limiting    • Request Routing              │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Query Service                                    │
│  • Query understanding   • Permission check   • Orchestration          │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   Retrieval   │   │   Reranking   │   │  Generation   │
│   Service     │   │   Service     │   │   Service     │
│               │   │               │   │               │
│ • Hybrid      │   │ • Cross-      │   │ • LLM         │
│   search      │   │   encoder     │   │ • Prompt      │
│ • Filtering   │   │ • Scoring     │   │   building    │
└───────┬───────┘   └───────────────┘   └───────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Data Layer                                       │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Vector DB  │  │ Search Index│  │  Doc Store  │  │  Metadata   │   │
│  │  (Qdrant)   │  │ (Elastic)   │  │   (S3)      │  │  (Postgres) │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      Ingestion Pipeline                                 │
│  Document Upload → Parse → Chunk → Embed → Index → Store Metadata      │
└─────────────────────────────────────────────────────────────────────────┘
```

渲染为流程图（分层系统在查询流水线中展开，并在数据层收敛）：

```mermaid
flowchart TD
    UI[User Interface<br/>Web / Slack / API]
    GW[API Gateway<br/>Auth + rate limit]
    QS[Query Service<br/>Permission + orchestration]

    UI --> GW --> QS

    subgraph PIPELINE[Query Pipeline]
        RS[Retrieval<br/>Hybrid search]
        RR[Reranker<br/>Cross-encoder]
        GS[Generation<br/>Claude Sonnet 5.5]
        RS --> RR --> GS
    end

    QS --> PIPELINE

    subgraph DATA[Data Layer]
        VDB[(Vector DB)]
        ES[(Search Index)]
        DOC[(Doc Store)]
        META[(Metadata)]
    end

    RS -.semantic.-> VDB
    RS -.keyword.-> ES
    GS -.full text.-> DOC
    QS -.acl.-> META

    GS --> UI
```

### 技术选型（2026 年 10 月）

| 组件 | 选择 | 理由 |
|-----------|--------|-----------|
| **Primary LLM** | Claude Sonnet 5.5（每 100 万输入/输出 token 为 $2/$10） | 到 1M token 保持统一价格，多文档上下文不产生长上下文附加费；可选零数据保留；可经 Bedrock、Google Cloud 和 Foundry 私有端点访问；最早于 2027 年 9 月 28 日退役 |
| **复杂跨文档分析** | Claude Opus 5.5（$4/$20）或 GPT-6.1 Sol（$2/$10） | 对少数需要跨大量文档做多步推理的查询升级。GPT-6.1 Sol 的提示应低于 272K 输入 token，超过后 OpenAI 对整个请求按 $4/$15 计费 |
| **摘要与批量层级** | Gemini 3.8 Flash（推广价 $0.75/$3.75；2027 年 1 月 1 日起为 $1.50/$7.50） | 低成本 1M token 上下文，用于文档摘要和摄取阶段的增强；预算应按 2027 年价格制定 |
| **Embeddings** | text-embedding-3-large（每 100 万 token $0.13） | 质量成熟且未变化。若预计更换模型，Cohere Embed 5（Pro 与 Fast）和 Voyage 4 家族各自在不同尺寸间共享嵌入空间，可用大模型建索引、用低价模型查询，而无需重建索引 |
| **Vector DB** | Qdrant 1.19（自托管） | 性能、payload 过滤及本地部署合规。`memory` 设置（pinned、cached、cold）取代 `on_disk` 和 `always_ram` 用于分层 |
| **Reranker** | Qwen3-Reranker-8B（自托管，Apache 2.0）或 API 重排序器（Cohere Rerank 4、Voyage rerank-3） | API 重排序器每篇文档支持 32K token，消除了旧版对长分块的 512-token 截断 |

> [!NOTE]
> **转变：有意识地为更大的检索单元定价。** 主流前沿模型的窗口达到 1M token 后，团队可在多文档问题中检索完整章节（10K 至 50K token），不必执着于完美的 512-token 分块。但账单也会随之增长：每月 150 万次查询，如果每次多输入 10K token，按 Sonnet 5.5 定价，每月会多付约 $30,000。应按查询类型路由：查找用小分块，综合分析问题才使用大章节。供应商的定价规则也不同：Claude 4.6 及以后在 1M 内按统一价格计费，而 OpenAI 对超过 272K 输入 token 的整个请求重新定价。

---

## 组件深入剖析

### 文档摄取流水线（Document Ingestion Pipeline）

```python
class IngestionPipeline:
    def __init__(self):
        self.parser = DocumentParser()
        self.chunker = SemanticChunker(
            chunk_size=512,
            chunk_overlap=50
        )
        self.embedder = OpenAIEmbedder(model="text-embedding-3-large")
        self.vector_db = QdrantClient()
        self.metadata_db = PostgresClient()
    
    async def ingest(self, document: Document, user_context: UserContext):
        # 1. Parse document
        parsed = self.parser.parse(document)
        
        # 2. Extract metadata
        metadata = self.extract_metadata(parsed, document)
        
        # 3. Chunk
        chunks = self.chunker.chunk(parsed.text)
        
        # 4. Generate embeddings (batch)
        embeddings = await self.embedder.embed_batch([c.text for c in chunks])
        
        # 5. Store in vector DB with metadata
        points = [
            {
                "id": f"{document.id}_{i}",
                "vector": embedding,
                "payload": {
                    "document_id": document.id,
                    "chunk_index": i,
                    "text": chunk.text,
                    "department": metadata.department,
                    "access_level": metadata.access_level,
                    "created_at": metadata.created_at.isoformat()
                }
            }
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
        ]
        
        await self.vector_db.upsert(collection_name="documents", points=points)
        
        # 6. Store full document
        await self.doc_store.put(document.id, parsed.text)
        
        # 7. Store metadata
        await self.metadata_db.insert_document(document.id, metadata)
        
        # 8. Index in Elasticsearch for keyword search
        await self.es_client.index(
            index="documents",
            id=document.id,
            body={"text": parsed.text, **metadata.to_dict()}
        )
```

代码看起来像一条线性序列，但其中四次写入是并行发生的。序列图可以明确展示这种扇出，这对于理解部分失败模式很重要：

```mermaid
sequenceDiagram
    participant U as Upload Event
    participant P as Parser
    participant C as Chunker
    participant E as Embedder
    participant V as Vector DB
    participant S as Search Index
    participant D as Doc Store
    participant M as Metadata DB

    U->>P: document
    P->>C: parsed text + metadata
    C->>E: chunks
    par Parallel writes
        E->>V: chunk vectors + payloads
        P->>S: full text + metadata
        P->>D: full document blob
        P->>M: document metadata + ACL
    end
    Note over V,M: Document is queryable only<br/>after all four writes commit
```

### 查询处理（Query Processing）

```python
class QueryService:
    def __init__(self):
        self.retriever = HybridRetriever()
        self.reranker = CrossEncoderReranker()  # self-hosted Qwen3-Reranker or an API reranker
        self.generator = LLMGenerator()
        self.guardrails = GuardrailPipeline()
    
    async def process_query(
        self,
        query: str,
        user_context: UserContext,
        conversation_history: list[Message] = None
    ) -> QueryResponse:
        
        # 1. Input guardrails
        guardrail_result = self.guardrails.check_input(query)
        if not guardrail_result.passed:
            return QueryResponse(
                answer="I cannot help with that request.",
                blocked=True,
                reason=guardrail_result.reason
            )
        
        # 2. Query understanding (optional: rewrite query)
        processed_query = await self.understand_query(query, conversation_history)
        
        # 3. Retrieve candidates with permission filtering
        candidates = await self.retriever.search(
            query=processed_query,
            filters=self.build_permission_filter(user_context),
            top_k=50
        )
        
        # 4. Rerank
        reranked = await self.reranker.rerank(
            query=processed_query,
            documents=candidates,
            top_k=10
        )
        
        # 5. Build context
        context = self.build_context(reranked)
        
        # 6. Generate answer
        answer = await self.generator.generate(
            query=query,
            context=context,
            conversation_history=conversation_history
        )
        
        # 7. Output guardrails
        guardrail_result = self.guardrails.check_output(answer, context)
        if not guardrail_result.passed:
            answer = self.fallback_response()
        
        # 8. Build response with citations
        return QueryResponse(
            answer=answer,
            sources=[self.format_source(doc) for doc in reranked[:5]],
            confidence=self.calculate_confidence(reranked)
        )
    
    def build_permission_filter(self, user_context: UserContext) -> dict:
        return {
            "should": [
                {"key": "access_level", "match": {"value": "public"}},
                {"key": "department", "match": {"value": user_context.department}},
                {"key": "access_list", "match": {"any": [user_context.user_id]}}
            ]
        }
```

### 混合检索（Hybrid Retrieval）

```python
class HybridRetriever:
    def __init__(self, vector_weight: float = 0.7, keyword_weight: float = 0.3):
        self.vector_db = QdrantClient()
        self.es_client = ElasticsearchClient()
        self.embedder = OpenAIEmbedder()
        self.vector_weight = vector_weight
        self.keyword_weight = keyword_weight
    
    async def search(
        self,
        query: str,
        filters: dict,
        top_k: int = 50
    ) -> list[Document]:
        
        # Parallel retrieval
        vector_results, keyword_results = await asyncio.gather(
            self.vector_search(query, filters, top_k * 2),
            self.keyword_search(query, filters, top_k * 2)
        )
        
        # Reciprocal Rank Fusion
        fused = self.rrf_fusion(
            [vector_results, keyword_results],
            weights=[self.vector_weight, self.keyword_weight],
            k=60
        )
        
        return fused[:top_k]
    
    async def vector_search(self, query: str, filters: dict, top_k: int):
        query_embedding = await self.embedder.embed(query)
        
        # Query API: Qdrant 1.19 removed the legacy /search endpoint from its REST schema
        response = await self.vector_db.query_points(
            collection_name="documents",
            query=query_embedding,
            query_filter=filters,
            limit=top_k
        )
        results = response.points
        
        return [
            Document(
                id=r.payload["document_id"],
                chunk_id=r.id,
                text=r.payload["text"],
                score=r.score,
                metadata=r.payload
            )
            for r in results
        ]
    
    def rrf_fusion(self, result_lists: list, weights: list, k: int = 60) -> list:
        scores = defaultdict(float)
        docs = {}
        
        for results, weight in zip(result_lists, weights):
            for rank, doc in enumerate(results):
                rrf_score = weight / (k + rank + 1)
                scores[doc.chunk_id] += rrf_score
                docs[doc.chunk_id] = doc
        
        sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
        return [docs[id] for id in sorted_ids]
```

下图概览了混合检索流程。两个并行检索器先工作，然后 RRF 以加权排名融合结果，再由 cross-encoder 对候选结果重排，最后进行上下文格式化：

```mermaid
flowchart LR
    Q[User Query] --> EMB[Embed Query]
    Q --> KW[Extract Keywords]

    EMB --> VS[Vector Search<br/>top 100]
    KW --> KS[Keyword Search<br/>BM25 top 100]

    VS --> RRF[Reciprocal Rank Fusion<br/>0.7 semantic / 0.3 keyword]
    KS --> RRF

    RRF --> RR[Cross-Encoder Rerank<br/>top 50 to top 10]
    RR --> CTX[Context Format<br/>with citations]
    CTX --> LLM[Generation<br/>Claude Sonnet 5.5, 1M ctx]
```

### 长上下文生成

```python
import anthropic

class LongContextGenerator:
    """
    Claude Sonnet 5.5 over whole document sections. Documents sit in the
    system prompt, ahead of the conversation, so follow-up questions over the
    same documents hit the prompt cache (reads bill at $0.20 per 1M on
    Sonnet 5.5, 0.1x the input price).
    """
    def __init__(self):
        # Use AsyncAnthropicBedrockMantle, AsyncAnthropicVertex or AsyncAnthropicFoundry
        # instead to keep traffic on a private cloud endpoint
        self.client = anthropic.AsyncAnthropic()

    async def generate(
        self,
        query: str,
        context_docs: list[Document],
        conversation_history: list[dict] | None = None
    ) -> str:
        instructions = (
            "You are an enterprise knowledge assistant. "
            "Answer only from the provided documents. "
            "Cite every claim using [[DocName:PageNumber]] format."
        )
        doc_blocks = [
            {"type": "text", "text": f"<document name='{d.name}'>\n{d.text}\n</document>"}
            for d in context_docs
        ]
        doc_blocks[-1]["cache_control"] = {"type": "ephemeral"}  # cache through the last document

        # No temperature: Sonnet 5.5 rejects non-default sampling values,
        # and the Python SDK 1.x removed them from the method signature
        response = await self.client.messages.create(
            model="claude-sonnet-5-5",
            max_tokens=4096,
            system=[{"type": "text", "text": instructions}, *doc_blocks],
            output_config={"effort": "medium"},
            messages=[
                # History holds only prior questions and answers, never the documents,
                # so the cached system-plus-documents prefix stays byte-identical
                *(conversation_history or []),
                {"role": "user", "content": f"Question: {query}"},
            ],
        )
        # Adaptive thinking is on by default, so keep only the text blocks
        return "".join(b.text for b in response.content if b.type == "text")
```

> [!TIP]
> **生产选择与最新版本**
> Sonnet 5.5 于 2026 年 9 月 28 日发布。提示和护栏针对 Sonnet 5 或 Sonnet 4.6 调整过的团队，应先运行评估集再切换，因为升级并非直接替换：
> - **请求格式**：强制 `tool_choice`（`any` 或 `tool`）会返回 400，`thinking: {type: "disabled"}` 会返回 400（最低设置为 `between_tools`），非默认 `temperature` 也会返回 400（Sonnet 5 已如此）。
> - **行为**：effort 等级重新校准，应重新扫描各档位，而非照搬旧设置。
> - **期限**：仍固定 Sonnet 4.5 的系统无论如何都必须迁移；它将于 2026 年 11 月 30 日在 Claude API 和 Foundry 退役。
> - **SDK**：Anthropic Python SDK 1.0（2026 年 8 月 20 日）改用 `httpx2`，基于 httpx 的追踪和测试 mock 可能悄然漏掉调用。升级后应核对 span 数量。

---

## 扩展性考量

### 处理 500K 文档

```python
# Sharding strategy for Qdrant
qdrant_config = {
    "collection": "documents",
    "vectors": {
        "size": 3072,  # text-embedding-3-large
        "distance": "Cosine"
    },
    "optimizers": {
        "indexing_threshold": 20000  # Build index after 20K points
    },
    "replication_factor": 2,  # High availability
    "shard_number": 4  # Distribute across nodes
}
```

### 处理 500 个并发用户

```
Load Balancer
     │
     ├──► Query Service (replica 1)
     ├──► Query Service (replica 2)
     ├──► Query Service (replica 3)
     └──► Query Service (replica 4)
            │
            ├──► Vector DB (3-node cluster)
            ├──► LLM API (with retry/fallback)
            └──► Elasticsearch (3-node cluster)
```

### 缓存策略

```python
class QueryCache:
    def __init__(self):
        self.exact_cache = Redis(ttl=3600)  # 1 hour
        self.semantic_cache = SemanticCache(threshold=0.95, ttl=1800)
    
    async def get_or_compute(self, query: str, user_context: UserContext) -> QueryResponse:
        # Check exact cache
        cache_key = self.make_key(query, user_context.permissions)
        cached = await self.exact_cache.get(cache_key)
        if cached:
            return cached
        
        # Check semantic cache
        similar = await self.semantic_cache.find_similar(query, user_context.permissions)
        if similar:
            return similar
        
        # Compute
        response = await self.query_service.process_query(query, user_context)
        
        # Cache result
        await self.exact_cache.set(cache_key, response)
        await self.semantic_cache.add(query, user_context.permissions, response)
        
        return response
```

---

## 成本分析

### 每月成本估算（500 用户，每用户每天 100 次查询，按 2026 年 10 月标价）

| 组件 | 计算方式 | 每月成本 |
|-----------|-------------|--------------|
| 大语言模型（Claude Sonnet 5.5，仅美国处理按 1.1 倍计费） | 150 万次查询 ×（2K 输入 token × 每百万 $2.20 + 500 输出 token × 每百万 $11） | 约 $14,850 |
| 向量嵌入（Embeddings） | 约 7,500 万查询 token，加上每天重新嵌入约 2% 的语料（每天约 5,000 万 token，每月约 15 亿），按每百万 token $0.13 | 约 $200 |
| 重排序（Voyage rerank-3） | 150 万次查询 × 50 个候选 × 每个约 400 token × 每百万 token $0.05 | 约 $1,500 |
| 向量数据库（Qdrant） | 3 节点集群 | 约 $1,500 |
| Elasticsearch | 3-node cluster | ~$2,000 |
| 计算（Compute, Query Service） | 4 instances | ~$1,000 |
| **总计** | | **每月约 $21,000** |

模型一行使用 Claude API 标价；Bedrock 和 Google Cloud 对 Claude 有各自的费率表，因此要确认实际部署平台的区域价格。嵌入和重排序行也会把文档文本发送给厂商，必须遵守云边界要求：通过所在云的私有端点访问，或自行托管。表中还有两个关键假设。第一，上下文为 2K token：如果 20% 的查询会为综合分析拉取 20K token 的章节，每月需额外支出约 $12,000（30 万次查询 × 额外 18K token × 每百万 $2.20）。第二，输出为 500 token：Sonnet 5.5 默认运行自适应思考，思考 token 按输出计费，因此应测量每次查询实际的输出量，再信任 LLM 成本行。

### 成本优化机会

1. **响应缓存**：30% 命中率 → 节省约 $4,500 的 LLM 成本
2. **提示缓存**：缓存静态系统提示和指令；缓存读取按输入价格的 0.1 倍计费
3. **模型路由**：将简单查找路由到更便宜的层级（Claude Haiku 4.5 为 $1/$5，或 Gemini 3.8 Flash）→ LLM 成本最多节省 40%；Haiku 5.5 虽已预告但尚未发布，应规划迁移
4. **仅在必要时使用数据驻留**：只为有要求的部门固定美国处理，其余使用全球端点 → 最多省回约 $1,350（10% 溢价）
5. **批量重新嵌入**：通过 OpenAI Batch API 运行夜间重新嵌入 → 该行成本降低 50%（五折）
6. **自托管重排序器**：用 Qwen3-Reranker 替代 API 重排序器 → 消除约 $1,500 的 API 支出，但按 Silicon Data 10 月 1 日每 GPU 小时 $2.77 的指数价，一张专用 H100 每月约需 $2,000；只有利用已有 GPU 容量才省钱。若合规禁止把候选段落发给重排序 API，这也是默认方案

---

## 经验总结

### 做得好的地方

1. **混合检索（Hybrid search）**：语义检索 + 关键词检索显著提升了召回率
2. **重排序（Reranking）**：Top-5 精确率提升了 15%
3. **清晰的引用（Citations）**：建立了用户信任
4. **检索阶段的权限过滤（Permission filtering at retrieval）**：无需事后过滤

### 遇到的挑战

1. **表格抽取**：包含复杂表格的 PDF 需要自定义解析
2. **缩略词（Acronyms）**：领域特定缩略词需要展开
3. **新鲜度（Freshness）**：1 小时的新鲜度要求流式摄入
4. **长文档**：100+ 页文档需要分层切块（Hierarchical chunking）

### 如果重来，我们会怎么做

1. 更早开始更好的文档解析
2. 在扩展前先构建评估流水线（Evaluation pipeline）
3. 从第一天起实现查询日志（Query logging）
4. 更早与用户建立反馈闭环（Feedback loop）

---

## 面试讲解流程

### 如何在面试中展示这部分

**开场（2 分钟）：**  
"I will design an enterprise RAG system for internal document search. Let me clarify a few requirements first..."

**需求确认（3 分钟）：**
- 询问规模、延迟和准确率目标
- 澄清安全要求
- 了解文档类型和更新频率

**宏观设计（5 分钟）：**
- 绘制架构图
- 解释关键组件
- 论证技术选型

**深入讲解（10 分钟）：**
- 检索策略（Hybrid search，说明原因）
- 安全性（检索时的权限过滤）
- 生成（Prompt engineering，引用）
- 扩展性（Sharding、缓存、副本）

**权衡分析（5 分钟）：**
- 成本 vs 延迟（模型选择）
- 上下文大小 vs 成本（整章有助于综合分析，但会放大输入支出）
- 准确率 vs 延迟（重排序增加耗时）
- 新鲜度 vs 成本（Streaming vs Batch）

**监控（2 分钟）：**
- 关键指标（延迟、准确率、用户反馈）
- 如何发现问题
- 持续改进闭环（Continuous improvement loop）

---

*Next: [Case Study: Conversational AI Agent](02-conversational-agent.md)*
