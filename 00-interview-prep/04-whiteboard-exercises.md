# AI 系统设计白板题

本章提供了常见于 AI 方向面试中的系统设计练习的详细讲解。每道练习都包含完整题目、结构化解题思路，以及用于区分优秀候选人的讨论要点。

## 目录

- [练习 1：企业级 RAG 系统](#练习-1-企业级-rag-系统)
- [练习 2：客户支持聊天机器人](#练习-2-客户支持聊天机器人)
- [练习 3：代码审查助手](#练习-3-代码审查助手)
- [练习 4：文档处理流水线](#练习-4-文档处理流水线)
- [练习 5：实时内容审核](#练习-5-实时内容审核)
- [练习 6：多租户 AI 平台](#练习-6-多租户-ai-平台)
- [练习 7：大规模语义搜索](#练习-7-大规模语义搜索)
- [练习 8：面向生产级 LLM（大语言模型）产品的评估流水线](#练习-8-生产级-llm-产品的评估流水线) ⭐ *NEW*
- [练习 9：长运行 Agent 的记忆与状态](#练习-9-长运行-agent-的记忆与状态) ⭐ *NEW*
- [白板题提示](#白板练习提示)

---

## 练习 1：企业级 RAG 系统

### 题目说明

为一家大型企业设计一个基于 RAG（Retrieval-Augmented Generation，检索增强生成）的知识助手，需求如下：

- 来自多个来源的 1000 万份文档（SharePoint、Confluence、Google Drive、内部 wiki）
- 50,000 名员工，具备基于角色的访问控制
- 文档持续更新
- 查询时必须遵守文档权限
- 95% 的查询响应时间低于 3 秒
- 支持多语言（英语、西班牙语、普通话）

### 时间分配（35 分钟）

| 阶段 | 时间 | 重点 |
|-------|------|-------|
| 澄清 | 3 分钟 | 范围、优先级、约束 |
| 高层架构 | 7 分钟 | 组件和数据流 |
| 数据流水线 | 8 分钟 | 摄取、切分、索引 |
| 查询流水线 | 8 分钟 | 检索、生成、权限 |
| 可靠性与扩展 | 5 分钟 | 故障处理、扩展 |
| 评估 | 4 分钟 | 指标和监控 |

### 解题讲解

#### 澄清问题

```
1. What is the document size distribution? (PDFs, wikis, code?)
2. How often do permissions change? (Impacts caching strategy)
3. Is conversation history required or single-turn Q&A?
4. What is the accuracy bar? (Can we say "I don't know"?)
5. Are there compliance requirements? (Audit, data residency)
```

#### 高层架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          DATA PLANE                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────────┐│
│  │   Connectors │───▶│   Processor  │───▶│       Vector Database        ││
│  │ (SP,GD,Conf) │    │ (chunk,embed)│    │  (Pinecone/Qdrant/Weaviate)  ││
│  └──────────────┘    └──────────────┘    └──────────────────────────────┘│
│                                                      ▲                   │
│                                                      │ sync              │
│  ┌──────────────────────────────────────────────────┼───────────────────┐│
│  │                    Permission Service            │                   ││
│  └──────────────────────────────────────────────────┼───────────────────┘│
└─────────────────────────────────────────────────────┼───────────────────┘
                                                      │
┌─────────────────────────────────────────────────────┼───────────────────┐
│                          QUERY PLANE                │                   │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────┴──────┐             │
│  │    User      │───▶│  Query API   │───▶│   Retriever    │             │
│  │  Interface   │    │              │    │ (+ perm filter)│             │
│  └──────────────┘    └──────────────┘    └────────┬───────┘             │
│                             │                      │                     │
│                             ▼                      ▼                     │
│                      ┌──────────────┐    ┌──────────────┐               │
│                      │   Reranker   │◀───│   Chunks     │               │
│                      └──────┬───────┘    └──────────────┘               │
│                             │                                            │
│                             ▼                                            │
│                      ┌──────────────┐    ┌──────────────┐               │
│                      │  Generator   │───▶│   Response   │               │
│                      │    (LLM)     │    │  + Citations │               │
│                      └──────────────┘    └──────────────┘               │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 数据流水线深入解析

**1. 连接器：**
```
Each source has a dedicated connector:
- SharePoint: Graph API with delta sync
- Confluence: REST API with webhooks
- Google Drive: Drive API with push notifications

Connector responsibilities:
- Fetch document content and metadata
- Track change events (create, update, delete)
- Extract permissions from source system
- Normalize to common document schema
```

**2. 文档 Schema：**
```json
{
  "doc_id": "uuid",
  "source": "sharepoint|confluence|gdrive",
  "source_id": "original_id_in_source",
  "title": "string",
  "content": "string",
  "content_type": "pdf|html|docx|md",
  "language": "en|es|zh",
  "permissions": {
    "users": ["user_id_1", "user_id_2"],
    "groups": ["group_id_1"],
    "visibility": "private|internal|public"
  },
  "metadata": {
    "author": "string",
    "created_at": "timestamp",
    "updated_at": "timestamp",
    "path": "folder/path"
  }
}
```

**3. 切分策略：**
```
Given mixed document types, use adaptive chunking:

- Markdown/HTML: Semantic chunking by headers
- PDFs: Layout-aware chunking using document AI
- Wiki pages: Section-based chunking

Chunk parameters:
- Target size: 512 tokens
- Overlap: 50 tokens
- Preserve: headers, tables, code blocks

Each chunk inherits parent document permissions.
```

**4. Embedding：**
```
Multilingual requirement suggests:
- Model: Cohere embed-v3 (multilingual, good quality)
- Alternative: OpenAI text-embedding-3-large

Batch embedding:
- Process in batches of 100 chunks
- Rate limit handling with exponential backoff
- Store embedding with chunk in vector DB
```

**5. 向量数据库选择：**
```
Pinecone or Qdrant for this scale.

Selection criteria:
- Metadata filtering: Critical for permissions
- Scale: 10M docs × 5 chunks = 50M vectors
- Hybrid search: Needed for keyword queries

Schema:
- Vector: embedding
- Metadata: doc_id, chunk_id, language, permissions, source
```

#### 查询流水线深入解析

**1. 权限解析：**
```python
def get_user_permissions(user_id: str) -> PermissionSet:
    """
    Resolve all documents user can access.
    Returns set of:
    - Direct user grants
    - Group memberships expanded
    - Public document access
    
    CACHED with 5-minute TTL since permissions change infrequently.
    """
    cache_key = f"permissions:{user_id}"
    if cached := cache.get(cache_key):
        return cached
    
    perms = permission_service.resolve(user_id)
    cache.set(cache_key, perms, ttl=300)
    return perms
```

**2. 带过滤条件的检索：**
```python
def retrieve(query: str, user_id: str, top_k: int = 20) -> List[Chunk]:
    perms = get_user_permissions(user_id)
    
    # Detect language for query
    lang = detect_language(query)
    
    # Build permission filter
    # User can see: public docs, their own, or groups they belong to
    filter = {
        "$or": [
            {"visibility": "public"},
            {"users": {"$in": [user_id]}},
            {"groups": {"$in": perms.groups}}
        ]
    }
    
    # Optional: boost same-language content
    if lang != "en":
        filter["language"] = lang
    
    results = vector_db.search(
        query_embedding=embed(query),
        top_k=top_k,
        filter=filter
    )
    return results
```

**3. 重排序：**
```
Rerank top-20 to get top-5 with cross-encoder.
Model: bge-reranker-v2-m3 (multilingual)
Latency budget: ~100ms
```

**4. 生成：**
```python
def generate(query: str, chunks: List[Chunk], user_id: str) -> Response:
    context = format_chunks_with_citations(chunks)
    
    prompt = f"""You are a knowledge assistant for [Company].
Answer the question using ONLY the provided context.
If the context does not contain the answer, say "I could not find information about that in our knowledge base."
Always cite sources using [1], [2] format.

CONTEXT:
{context}

QUESTION: {query}
"""
    
    response = llm.generate(
        prompt=prompt,
        model="gpt-4o",
        temperature=0.1
    )
    
    return format_with_source_links(response, chunks)
```

#### 扩展性与可靠性

**延迟预算（p95 < 3s）：**
```
Permission resolution:   50ms  (cached)
Embedding:              100ms
Vector search:          100ms
Reranking:              150ms
LLM generation:        1500ms
Network/overhead:       100ms
─────────────────────────────
Total:                 2000ms (buffer for P95)
```

**扩展性考虑：**
```
- Vector DB: Sharded by source or hash
- Embedding service: Horizontal scale, stateless
- LLM calls: Multiple providers for redundancy
- Cache: Redis cluster for permissions and responses
```

**故障处理：**
```
- Vector DB down: Return cached results + degraded warning
- LLM down: Fallback to secondary provider
- Rate limiting: Queue with backpressure
- Embedding service: Batch retries with circuit breaker
```

#### 评估方法

**离线指标：**
```
- Retrieval: Precision@5, Recall@5, MRR
- Generation: RAGAS (faithfulness, relevance)
- End-to-end: Answer correctness on test set
```

**在线指标：**
```
- User feedback: Thumbs up/down
- Query reformulation rate: User rephrasing indicates failure
- Citation click-through: Are sources useful?
```

**监控：**
```
- Latency dashboards by percentile
- Permission filter hit rate
- Empty result rate by source
- Cost per query
```

---

## 练习 2：客户支持聊天机器人

### 题目说明

为一家电商公司设计一个 AI 驱动的客户支持系统：

- 每天处理 10,000 次对话
- 可访问商品目录（100 万件商品）、订单历史、FAQ
- 目标：在无需人工接手的情况下解决 70% 的工单
- 支持订单查询、退货、商品问题
- 多语言支持（3 种语言）
- 与现有 Zendesk 工单系统集成

### 解题要点

**关键架构决策：**

1. **带流程控制的 Agent 架构：**
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ┌─────────┐     ┌─────────────┐     ┌─────────────┐   │
│   │ Intake  │────▶│  Classify   │────▶│   Router    │   │
│   └─────────┘     └─────────────┘     └──────┬──────┘   │
│                                              │           │
│         ┌────────────────┬──────────────────┼───────┐   │
│         ▼                ▼                  ▼       ▼   │
│   ┌───────────┐   ┌───────────┐   ┌───────────┐ ┌─────┐ │
│   │Order Flow │   │Product Q&A│   │ Returns   │ │Human│ │
│   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘ └─────┘ │
│         │               │               │               │
│         └───────────────┴───────────────┘               │
│                         │                               │
│                   ┌─────▼─────┐                         │
│                   │  Response │                         │
│                   │ Generator │                         │
│                   └───────────┘                         │
└─────────────────────────────────────────────────────────┘
```

2. **工具设计：**
```python
tools = [
    {
        "name": "lookup_order",
        "description": "Look up order details by order ID or customer email",
        "parameters": {
            "order_id": "optional string",
            "email": "optional string"
        }
    },
    {
        "name": "search_products",
        "description": "Search product catalog",
        "parameters": {
            "query": "string",
            "category": "optional string",
            "price_range": "optional tuple"
        }
    },
    {
        "name": "create_return",
        "description": "Initiate a return for an order",
        "parameters": {
            "order_id": "string",
            "reason": "string",
            "items": "list of item IDs"
        }
    },
    {
        "name": "escalate_to_human",
        "description": "Transfer to human agent",
        "parameters": {
            "reason": "string",
            "priority": "low|medium|high"
        }
    }
]
```

3. **升级人工的判定标准：**
```
Escalate to human when:
- Customer explicitly requests human
- Sentiment is highly negative (detected by classifier)
- Issue involves payment disputes
- Agent confidence is low after 2 attempts
- Complex multi-order issues
- Refund above threshold amount
```

4. **集成模式：**
```
Zendesk integration:
- Webhook receives new tickets
- AI handles via API
- Resolution → close ticket
- Escalation → assign to queue with context summary
- All interactions logged to ticket timeline
```

---

## 练习 3：代码审查助手

### 题目说明

为一个开发平台设计一个代码审查助手：

- 自动审查 pull request（PR，拉取请求）
- 提供具体、可执行的反馈
- 遵循仓库风格指南和约定
- 可建议代码修复
- 与 GitHub/GitLab 集成
- 每天处理 50,000 个 PR

### 解题要点

**关键技术选择：**

1. **上下文组装：**
```
For each changed file, assemble context:
- The diff (changed lines)
- Full file content (for understanding)
- Related files (imports, tests, types)
- Repository conventions (.eslintrc, .editorconfig)
- Previous review comments (learn from feedback)
```

2. **审查类别：**
```python
review_types = [
    "bug_risk",           # Potential bugs
    "security",           # Security issues
    "performance",        # Performance concerns
    "maintainability",    # Code quality
    "style",              # Style guide violations
    "test_coverage"       # Missing tests
]
```

3. **模型选择：**
```
Primary: Claude Sonnet 4.6 (best price-to-quality for code understanding; Opus 4.8 for the hardest reviews)
Fallback: GPT-5.5

Specialized models:
- Security scanning: CodeQL + LLM review
- Style: Linters + LLM explanation
```

4. **输出格式：**
```markdown
## Review Summary

### Critical Issues (must fix)
- **Line 45**: SQL injection vulnerability in user query
  ```python
  # Instead of:
  query = f"SELECT * FROM users WHERE id = {user_id}"
  # Use:
  query = "SELECT * FROM users WHERE id = ?"
  cursor.execute(query, (user_id,))
  ```

### Suggestions (consider fixing)
- **Line 78-82**: This loop could be simplified using list comprehension
...
```

5. **延迟策略：**
```
Target: Review ready within 2 minutes of PR creation

Strategy:
- Queue PR for processing
- Parallel processing of files
- Stream results as available
- Cache repository conventions
```

---

## 练习 4：文档处理流水线

### 题目说明

为金融服务场景设计一个文档处理流水线：

- 每天处理 100,000 份文档（发票、合同、表单）
- 以 99% 的准确率提取结构化数据
- 处理 PDF、扫描文档、手写笔记
- 符合 HIPAA/SOC2 合规要求
- 对低置信度提取结果进行人工审核

### 解题要点

**流水线架构：**

```
┌────────┐   ┌───────────┐   ┌────────────┐   ┌────────────┐
│ Ingest │──▶│ Classify  │──▶│  Extract   │──▶│  Validate  │
└────────┘   └───────────┘   └────────────┘   └────────────┘
                                                     │
                                     ┌───────────────┼───────────────┐
                                     ▼               ▼               ▼
                              ┌──────────┐   ┌──────────┐   ┌──────────┐
                              │ Auto-pass│   │  Review  │   │  Reject  │
                              └──────────┘   └──────────┘   └──────────┘
```

**关键组件：**

1. **文档分类：**
```
Fine-tuned classifier on document types:
- Invoice, Contract, Receipt, Form, ID, Other

Model: LayoutLMv3 or fine-tuned ViT
Confidence threshold: 0.95 for auto-routing
```

2. **提取策略：**
```
Tiered extraction based on document type:

Tier 1: Document AI (Textract/Azure)
- Good for structured forms
- Fast and cheap
- Returns confidence scores

Tier 2: Vision LLM (Claude Opus 4.8, GPT-5.5, Gemini 3.1 Pro)
- Fallback for complex layouts
- Better for unstructured text
- More expensive

Combine outputs and cross-validate.
```

3. **验证规则：**
```python
validation_rules = {
    "invoice": [
        ("total", lambda x: x > 0, "Total must be positive"),
        ("date", lambda x: parse_date(x), "Invalid date format"),
        ("vendor_id", lambda x: regex_match(x, TAX_ID_PATTERN), "Invalid tax ID"),
        ("line_items", lambda x: sum(i.amount for i in x) == total, "Line items must sum to total")
    ],
    "contract": [
        ("parties", lambda x: len(x) >= 2, "Contract must have at least 2 parties"),
        ("effective_date", lambda x: parse_date(x), "Invalid date"),
        ("signature_present", lambda x: x == True, "Signature required")
    ]
}
```

4. **人工审核界面：**
```
Reviewer sees:
- Original document image
- Extracted fields with confidence scores
- Validation errors highlighted
- Suggested corrections from LLM
- One-click approval or field-level corrections
```

5. **合规措施：**
```
HIPAA/SOC2 requirements:
- All documents encrypted at rest (AES-256)
- TLS 1.3 in transit
- Audit log for all access and changes
- PHI detection and masking
- Retention policies enforced
- Access controls with MFA
```

---

## 练习 5：实时内容审核

### 问题陈述

为一个社交平台设计内容审核系统：

- 每天 100 万条帖子（文本、图片、视频）
- 延迟要求：帖子可见时间低于 500ms
- 检测：仇恨言论、暴力、成人内容、垃圾信息
- 为误判提供申诉流程
- 支持 10 种语言

### 方案亮点

**架构模式：多阶段级联（Multi-Stage Cascade）**

```
         ┌───────────────────────────────────────────┐
         │              Fast Filters                 │
         │   (regex, blocklist, hash matching)       │
         └─────────────────┬─────────────────────────┘
                           │ Pass 95%
                           ▼
         ┌───────────────────────────────────────────┐
         │            ML Classifiers                 │
         │   (text: BERT, image: CLIP, video: X3D)   │
         └─────────────────┬─────────────────────────┘
                           │ Uncertain 5%
                           ▼
         ┌───────────────────────────────────────────┐
         │            LLM Analysis                   │
         │   (context-aware, nuanced decisions)      │
         └─────────────────┬─────────────────────────┘
                           │ Still uncertain 0.5%
                           ▼
         ┌───────────────────────────────────────────┐
         │            Human Review                   │
         └───────────────────────────────────────────┘
```

**关键设计决策：**

1. **延迟优化：**
```
Target: 500ms total

Stage 1 (Fast): 20ms
- Regex patterns
- Known hash matching (PhotoDNA)
- Blocklist lookup

Stage 2 (ML): 80ms
- Batched inference on GPU
- Small specialized models
- Parallel text/image processing

Stage 3 (LLM): 400ms (async for borderline)
- Only 5% of content reaches here
- Used for nuanced decisions
```

2. **阈值策略：**
```python
class ModerationDecision:
    BLOCK = "block"          # High confidence violation
    ALLOW = "allow"          # High confidence safe
    LIMIT = "limit"          # Reduce distribution
    REVIEW = "human_review"  # Queue for human

thresholds = {
    "hate_speech": {
        "block": 0.95,
        "limit": 0.80,
        "review": 0.60
    },
    "adult_content": {
        "block": 0.98,  # Higher threshold, legal implications
        "limit": 0.90,
        "review": 0.70
    }
}
```

3. **申诉流程：**
```
1. User submits appeal
2. Content queued for human review
3. Different reviewer than original (blind review)
4. Decision logged with reasoning
5. If overturned:
   - Content restored
   - Original decision added to training data as negative
   - Model retrained periodically
```

---

## 练习 6：多租户 AI 平台

### 问题陈述

设计一个多租户 AI 平台（AI-as-a-Service，AI 即服务）：

- 服务 500+ 企业客户
- 每个客户都有自己的文档和模型
- 租户之间完全数据隔离
- 按租户进行使用量跟踪和计费
- 不同价格层级具有不同能力
- 需要满足 SOC2 合规

### 方案亮点

**租户隔离架构：**

```
┌─────────────────────────────────────────────────────────────────┐
│                         API Gateway                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │   Auth → Tenant Context → Rate Limit → Route             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Tenant-Aware Service Layer                    │
│                                                                  │
│  All operations scoped to tenant_id from context                │
│  - Retrieval filters by tenant                                  │
│  - Cache keys prefixed by tenant                                │
│  - Audit logs include tenant                                    │
└─────────────────────────────────────────────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Shared Vector  │ │  Shared LLM     │ │  Shared Object  │
│  DB (filtered)  │ │  (no tenant     │ │  Storage        │
│                 │ │   data in prompt│ │  (tenant paths) │
│  tenant_id in   │ │   history)      │ │                 │
│  all metadata   │ │                 │ │  s3://bucket/   │
└─────────────────┘ └─────────────────┘ │  {tenant_id}/   │
                                        └─────────────────┘
```

**关键隔离点：**

```python
class TenantContext:
    tenant_id: str
    user_id: str
    tier: str  # "starter" | "pro" | "enterprise"
    
    def __enter__(self):
        # Set tenant context for all downstream calls
        _tenant_context.set(self)
        
    def __exit__(self, *args):
        _tenant_context.set(None)

# Middleware ensures tenant context on every request
@middleware
def enforce_tenant_context(request, call_next):
    tenant_id = extract_tenant_from_token(request.headers["Authorization"])
    with TenantContext(tenant_id=tenant_id, ...):
        verify_tenant_access(tenant_id, request.path)
        response = call_next(request)
        add_tenant_to_audit_log(tenant_id, request, response)
    return response
```

**计费和使用量跟踪：**

```python
usage_schema = {
    "tenant_id": "string",
    "timestamp": "datetime",
    "operation": "embed|retrieve|generate",
    "model": "string",
    "tokens_in": "int",
    "tokens_out": "int",
    "latency_ms": "int",
    "cost_cents": "decimal"
}

# Real-time usage aggregation
async def track_usage(tenant_id: str, operation: Usage):
    # Append to time-series DB
    await timeseries.write("usage", {
        "tenant_id": tenant_id,
        **operation.dict()
    })
    
    # Update real-time counter for rate limiting
    await redis.incr(f"usage:{tenant_id}:{today()}", operation.tokens)
```

---

## 练习 7：大规模语义搜索

### 问题陈述

为一个电商网站设计语义搜索系统：

- 5000 万个商品
- 每天 1 亿次查询
- P99 延迟低于 100ms
- 支持筛选条件（价格、类别、品牌、评分）
- 基于用户历史的个性化
- 实时库存更新

### 方案亮点

**核心挑战：在每天 1 亿次查询下实现 100ms**

```
100M queries/day = 1,157 QPS average
Peak: 5,000-10,000 QPS

At 100ms latency, need:
- Edge caching
- Pre-computed embeddings
- Optimized retrieval
- Minimal LLM involvement
```

**架构：**

```
┌────────────────────────────────────────────────────────────┐
│                         CDN/Edge                            │
│              (Cache popular queries: ~30% hit)              │
└─────────────────────────────┬──────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────┐
│                      Query Service                          │
│  1. Embed query (cached embeddings for common queries)      │
│  2. Retrieve candidates (ANN search)                        │
│  3. Apply filters (post-filter or hybrid)                   │
│  4. Personalize ranking                                     │
│  5. Return results                                          │
└─────────────────────────────┬──────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────┐
│                    Vector Database Cluster                  │
│  - Sharded by category (reduce search space)                │
│  - HNSW index with ef_search tuned for speed                │
│  - Metadata filtering with roaring bitmaps                  │
└────────────────────────────────────────────────────────────┘
```

**延迟预算：**

```
Edge cache check:    5ms
Embedding lookup:   10ms (cached) or 30ms (compute)
Vector search:      30ms
Filtering:          10ms
Personalization:    10ms
Serialization:      10ms
Network overhead:   25ms
─────────────────────
Total:              100ms target (with cache hit)
```

**混合搜索策略（Hybrid Search Strategy，混合搜索策略）：**

```python
def search(query: str, filters: dict, user_id: str) -> List[Product]:
    # Determine search strategy based on query
    if is_keyword_heavy(query):
        # "nike air max 90 size 10"
        sparse_weight = 0.7
        dense_weight = 0.3
    else:
        # "comfortable running shoes for flat feet"
        sparse_weight = 0.3
        dense_weight = 0.7
    
    # Parallel retrieval
    dense_results = vector_db.search(embed(query), top_k=100, filter=filters)
    sparse_results = elastic.search(query, top_k=100, filter=filters)
    
    # Reciprocal rank fusion
    combined = rrf_merge(
        [dense_results, sparse_results],
        weights=[dense_weight, sparse_weight]
    )
    
    # Personalization boost
    personalized = apply_user_preferences(combined, user_id)
    
    return personalized[:20]
```

**实时更新：**

```
Product updates (price, inventory) flow:
1. Change event published to Kafka
2. Consumer updates vector DB metadata
3. Search reflects change within seconds

Reindexing (description changes):
1. Full re-embed required
2. Run as async job
3. Swap index when complete
```

---

## 练习 8：生产级 LLM 产品的评估流水线

### 问题陈述

“你的公司发布了一款由 5 万名日活用户使用的 AI 助手。管理层希望每周发布模型和提示词变更，同时不引入质量回归。设计评估流水线：离线评估、CI 门禁、judge 校准和生产监控。预算：评估系统本身的成本应低于推理支出的 2%。”

### 需要澄清的问题

- 对这个产品来说，“质量”指什么？（任务成功率、忠实度、语气、安全性？）
- 我们今天是否已有任何标注数据，还是从零开始？
- 变更频率是多少？（提示词按天，模型按月？）
- 一个已发布回归的成本是多少？（支持工单、流失、监管风险？）
- 谁会使用评估结果？（用来卡 PR 的工程师、跟踪质量的 PM、跟踪趋势线的高管？）

### 方案讲解

**高层架构：**

```
                    ┌────────────────────────────────────────────┐
                    │              EVAL PIPELINE                  │
                    │                                             │
  Prompt/model PR ──► CI runner ── dev set (visible, ~200 cases) │
                    │     │                                       │
                    │     ├── held-out set (CI-only, ~300 cases,  │
                    │     │    rotated quarterly)                  │
                    │     │                                       │
                    │     └── gate: pass/fail vs baseline ──► merge│
                    │                                             │
  Production ──────► sampler (1-5% of traffic)                   │
                    │     │                                       │
                    │     ├── LLM-judge scoring (async, cheap)    │
                    │     ├── human-graded slice (weekly, ~100)   │
                    │     └── outcome metrics (thumbs, escalation)│
                    │                                             │
                    └──── dashboards + regression alerts ─────────┘
```

**1. 数据集策略（大多数候选人会跳过的部分）：**

```
Golden dataset composition:
- 40% sampled from real production traces (stratified by intent cluster)
- 30% known-hard cases from past incidents and complaints
- 20% adversarial cases (injection attempts, edge formats)
- 10% canary cases that must never change behavior

Split: dev (iterate freely) / held-out (CI-only, never inspected)
Refresh: quarterly, sampled from recent traffic; archive old sets
```

**2. 评分设计：**

- 每个维度（忠实度、完整性、语气、安全性）使用二元通过/失败，而不是 1-5 分量表。二元决策可复现；Likert 量表会漂移。
- 为了规模化使用 LLM-as-judge（以大模型充当评审）：一个廉价模型（Claude Haiku 4.5、GPT-5.5-mini），配合每个维度的 rubric 和 few-shot 锚点示例。
- judge 校准：每月与人工评分切片做一致性检查。judge-human 一致性本身就是仪表盘指标；低于 85% 一致性时，先修正 judge 提示词，再讨论任何产品结论。

**3. CI 门禁：**

```python
def eval_gate(pr_results, baseline_results):
    # Hard gates: any safety regression blocks merge
    if pr_results.safety_pass_rate < baseline_results.safety_pass_rate:
        return Block(reason="safety regression")
    # Soft gates: quality within noise band
    delta = pr_results.task_success - baseline_results.task_success
    if delta < -0.02:                  # 2pt regression threshold
        return Block(reason=f"quality drop {delta:.1%}")
    if pr_results.held_out_success < pr_results.dev_success - 0.05:
        return Warn(reason="possible dev-set overfitting")
    return Pass()
```

**4. 生产监控：**

- 对线上流量进行抽样 judge 评分（1-5%），按天趋势化。
- 结果关联：投诉率、点踩率和升级率与评估分数一起画在同一个仪表盘上。评估趋势与结果趋势出现背离时，触发一次评估复盘。
- 漂移告警：输入分布变化（意图簇混合）、按分段的分数下降，以及 judge 一致性衰减。

**5. 成本控制：**

```
50K DAU, ~3 requests each = 150K requests/day
Sample 2% = 3K judged requests/day
Judge cost: ~1K tokens per judgment on a $1/1M model = ~$3/day
Weekly human slice: 100 cases x 3 min reviewer time
CI runs: 500 cases x ~2K tokens per PR = under $2 per PR
Total: well under the 2% budget; the human slice is the
dominant cost and it is what keeps the judge honest.
```

### 强候选人的区别点

- 他们会先设计数据集，再设计评分器；一个在过时数据集上的优秀 judge 其实什么都测不出来。
- 他们把 judge 当作一个有自己评估体系的系统组件（与人类的一致性校准），而不是当作真值。
- 他们会不经提示地指出评估被“刷分”的风险：开发集过拟合、judge 过度迎合、指标收窄、对难例的静默排除。
- 他们会把离线分数和生产结果联系起来，而不是庆祝绿色仪表盘。
- 他们会量化评估预算，并把昂贵的人工标注放在最有杠杆的地方。

---

## 练习 9：长运行 Agent 的记忆与状态

### 问题陈述

“为一个个人 AI 助手设计记忆系统，它会在数月内与用户协作：它应该记住偏好和事实，从过去会话中学习，在合适的时刻回忆相关历史，并忘记不该保留的内容。会话可以持续数小时。支持 100 万用户。”

### 需要澄清的问题

- 哪种记忆失败伤害最大：忘记重要内容，还是回忆出错误或过时内容？
- 隐私约束？（GDPR 删除、按用户隔离、受监管数据？）
- 记忆是仅限用户个人，还是也包含共享组织知识？
- 每次轮次的回忆延迟预算是多少？
- 单个会话会持续多久？（决定会话内与跨会话设计。）

### 方案讲解

**记忆层级：**

```
┌──────────────────────────────────────────────────────────┐
│ L1 Working memory: the context window                     │
│   Current session, tool results, scratchpad               │
│   Managed by compaction + just-in-time loading            │
├──────────────────────────────────────────────────────────┤
│ L2 Episodic memory: what happened                         │
│   Past session summaries, trajectories, outcomes          │
│   Store: vector DB, retrieved by similarity + recency     │
├──────────────────────────────────────────────────────────┤
│ L3 Semantic memory: what is true                          │
│   Extracted facts and preferences with provenance         │
│   Store: structured records or knowledge graph            │
├──────────────────────────────────────────────────────────┤
│ L4 Procedural memory: how to do things                    │
│   Learned workflows, per-user playbooks (skills)          │
│   Store: versioned files, loaded on demand                │
└──────────────────────────────────────────────────────────┘
```

**1. 会话内（L1）：上下文工程，而不是存储。**
在窗口阈值处进行压缩（总结历史，保留最近工件），按需通过引用加载大型内容，以及一份结构化的临时笔记，Agent 在压缩后会重新读取它。持续数小时的会话绝不会把完整转录一直放在上下文里。

**2. 写入路径（最难的部分）：**

```
Session ends (or hits checkpoint)
    │
    ├── Summarize episode → L2 (embedding + metadata:
    │     timestamp, topics, outcome, sentiment)
    │
    └── Fact extraction pass → candidate facts
          │
          ├── Deduplicate against existing L3
          ├── Conflict check: contradicts a stored fact?
          │     ├── Newer + higher confidence → supersede (keep old
          │     │     version with valid_to timestamp)
          │     └── Ambiguous → store as candidate, confirm with
          │           user at next natural opportunity
          └── Importance filter: discard chit-chat, keep
                preferences, commitments, corrections
```

冲突路径最关键：“用户从马德里搬到了里斯本”必须覆盖旧事实，而不是并存。双时态记录（valid_from、valid_to）使覆盖关系可审计且可逆。

**3. 读取路径：**

- 每一轮都会基于当前意图构建回忆查询，从 L2 检索 top-k（相似度 + 近期性 + 重要性加权），并从 L3 获取匹配事实。
- 相关性门控会丢弃弱匹配，而不是硬塞进去；错误记忆对回答的毒害比缺失记忆更严重。
- 回忆预算：每轮只使用几百 token 的记忆，绝不转储整段转录。

**4. 遗忘与隐私：**

- 衰减：若未被访问强化，事件性条目的检索权重会随时间降低。
- 归并：周期性任务会把相关事件合并为摘要（很多“账单问题”事件会变成一条模式笔记）。
- GDPR 删除：到处使用按用户划分的分区键；删除会移除 L2/L3/L4 行并使缓存失效。按用户做硬隔离；记忆绝不会通过相似性在租户间共享。

**5. 规模草图（100 万用户）：**

```
Storage: ~thousands of L2 entries + hundreds of L3 facts per
  active user; vector DB partitioned by user_id (metadata
  filter or namespace per tenant tier)
Write path: async after session close; queue + worker pool
Read path: p95 < 150ms recall (ANN on a per-user slice is small)
Cost: extraction pass on session close is the main LLM cost;
  use a cheap model (Haiku 4.5 / V4 Flash) with a strict schema
```

### 强候选人有何不同

- 他们会把会话内上下文管理与跨会话记忆区分开来，而不是将二者混为一谈。
- 他们会把更多时间放在写入路径（write path）上，包括抽取（extraction）、去重（dedup）和冲突替代（conflict supersession），而不只是检索（retrieval）。
- 他们认为错误召回（wrong recall）比没有召回更糟，并据此设计相关性门控（relevance gate）。
- 他们会把记忆投毒（memory poisoning）视为一个安全攻击面：今天写入、明天被信任的非受信内容需要来源标记（provenance tags）和审查门控（review gates）。
- 他们会把生产级框架（Mem0、Zep、Letta）作为自建与采购（build-vs-buy）选项来提及，同时仍然能够基于原语进行设计。

---

## 白板练习提示

### 绘图提示

1. **先画方框和标签**，再用箭头连接
2. **使用一致的记法**：服务用矩形，数据库用圆柱形，箭头表示数据流
3. **在箭头上标注数据**：说明组件之间流动的是什么
4. **留出空间**，方便在讨论时补充内容

### 需要掌握的常见模式

| 模式 | 何时使用 | 画法 |
|---------|-------------|---------|
| 负载均衡器 + 服务集群 | 任何可扩展服务 | LB → 多个方框 |
| 队列 + 工作者 | 异步处理 | Queue → 工作者池 |
| 缓存层 | 读多、低延迟敏感 | 服务前的菱形 |
| CDC/流式处理 | 实时更新 | Kafka/stream 图标 |
| Sidecar | 横切关注点 | 贴在服务旁边的小方框 |

### 传递强候选人信号的表达

- "在我设计之前，先让我了解一下规模..."
- "这里的取舍是..."
- "在生产环境中，我们还需要..."
- "需要考虑的一种失败模式是..."
- "让我带你过一遍延迟预算..."
- "关于评估，我会测量..."

### 时间管理

- 不要花超过 5 分钟做澄清
- 在深入之前先画出完整的高层图景
- 为可靠性和评估留出时间
- 与面试官确认重点关注领域

---

*另见: [问题库](01-question-bank.md) | [答案框架](02-answer-frameworks.md) | [常见陷阱](03-common-pitfalls.md)*
