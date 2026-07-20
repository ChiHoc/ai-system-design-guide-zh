# AI 设计模式（AI Design Patterns）

本章整理了构建 AI 系统的常见模式，类似软件工程中的设计模式。每个模式都包括何时使用、实现指引和权衡。

## 目录（Table of Contents）

- [RAG 模式](#rag-模式)
- [Agent 模式](#agent-模式)
- [优化模式](#优化模式)
- [可靠性模式](#可靠性模式)
- [成本模式](#成本模式)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## RAG 模式

### 模式：Naive RAG（朴素 RAG）

最简化的 RAG（Retrieval-Augmented Generation，检索增强生成）实现：

```
Query → Embed → Search → Top K → Stuff into prompt → Generate
```

**使用场景：**
- MVP（最小可行产品）和原型开发
- 简单问答
- 当检索质量已经足够时

**局限性：**
- 无重排序（reranking）
- 无查询增强（query enhancement）
- 可能检索到无关片段

---

### 模式：Advanced RAG（高级 RAG）

具备多阶段的增强流水线：

```
Query → Rewrite → Embed → Hybrid Search → Rerank → Filter → Generate
```

```python
class AdvancedRAG:
    async def query(self, user_query: str) -> str:
        # Step 1: Query rewriting
        enhanced_query = await self.rewrite_query(user_query)
        
        # Step 2: Hybrid retrieval
        semantic_results = await self.vector_search(enhanced_query, top_k=50)
        keyword_results = await self.bm25_search(enhanced_query, top_k=50)
        
        # Step 3: Fusion
        combined = self.reciprocal_rank_fusion(semantic_results, keyword_results)
        
        # Step 4: Reranking
        reranked = await self.rerank(enhanced_query, combined[:20])
        
        # Step 5: Generation with top results
        context = self.format_context(reranked[:5])
        return await self.generate(user_query, context)
```

**使用场景：**
- 生产系统
- 当准确率很重要时
- 复杂文档集合

---

### 模式：Parent-Child Retrieval（父子检索）

先检索小片段，再返回更大的父级片段：

```
Document
    └── Parent chunk (2000 tokens)
            ├── Child chunk (200 tokens) ← Retrieve on this
            ├── Child chunk (200 tokens)
            └── Child chunk (200 tokens)
```

```python
class ParentChildRetriever:
    def __init__(self, vector_store):
        self.vector_store = vector_store
    
    async def retrieve(self, query: str, top_k: int = 5) -> list[str]:
        # Search on child chunks (more precise)
        child_results = await self.vector_store.search(
            query, 
            collection="child_chunks",
            top_k=top_k * 3
        )
        
        # Get unique parent chunks
        parent_ids = set(r.metadata["parent_id"] for r in child_results)
        
        # Return parent chunks (more context)
        parents = await self.get_parents(list(parent_ids)[:top_k])
        return parents
```

**使用场景：**
- 需要检索精度
- 生成时需要上下文
- 文档结构是分层的

---

### 模式：Self-RAG

模型决定何时以及检索什么内容：

```python
class SelfRAG:
    async def generate(self, query: str) -> str:
        # Step 1: Decide if retrieval is needed
        needs_retrieval = await self.assess_retrieval_need(query)
        
        if needs_retrieval:
            # Step 2: Retrieve
            context = await self.retrieve(query)
            
            # Step 3: Assess relevance
            relevant_context = await self.filter_relevant(query, context)
            
            # Step 4: Generate with context
            response = await self.generate_with_context(query, relevant_context)
            
            # Step 5: Self-critique
            is_supported = await self.check_support(response, relevant_context)
            if not is_supported:
                response = await self.regenerate(query, relevant_context)
        else:
            response = await self.generate_without_context(query)
        
        return response
```

**使用场景：**
- 混合知识（参数化知识 + 检索知识）
- 希望模型具有选择性
- 研究与实验

---

### 模式：Corrective RAG（CRAG，纠错型 RAG）

评估并修正检索质量：

```python
class CorrectiveRAG:
    async def query(self, user_query: str) -> str:
        # Initial retrieval
        docs = await self.retrieve(user_query)
        
        # Grade each document
        graded = []
        for doc in docs:
            grade = await self.grade_relevance(user_query, doc)
            graded.append((doc, grade))
        
        # Categorize results
        relevant = [d for d, g in graded if g == "relevant"]
        ambiguous = [d for d, g in graded if g == "ambiguous"]
        
        if len(relevant) >= 3:
            # Enough relevant docs
            context = relevant
        elif len(relevant) + len(ambiguous) >= 2:
            # Refine ambiguous docs
            refined = await self.refine_search(user_query, ambiguous)
            context = relevant + refined
        else:
            # Web search fallback
            web_results = await self.web_search(user_query)
            context = relevant + web_results
        
        return await self.generate(user_query, context)
```

**使用场景：**
- 文档语料库不稳定或不可靠
- 需要高准确率
- 可以为质量校验支付额外延迟成本

---

## Agent 模式

### 模式：ReAct

交替执行推理与行动：

```
Thought → Action → Observation → Thought → Action → Observation → Answer
```

参见 [Agent 架构（Agent Architectures）](../07-agentic-systems/01-agent-fundamentals.md) 了解实现方式。

**使用场景：**
- 通用型 Agent
- 可解释的决策过程
- 中等复杂度任务

---

### 模式：Plan-and-Execute（先规划后执行）

先生成计划，再执行步骤：

```python
class PlanAndExecuteAgent:
    async def run(self, task: str) -> str:
        # Step 1: Create plan
        plan = await self.create_plan(task)
        
        # Step 2: Execute each step
        results = []
        for step in plan.steps:
            result = await self.execute_step(step, results)
            results.append(result)
            
            # Re-plan if needed
            if result.needs_replanning:
                plan = await self.replan(task, results)
        
        # Step 3: Synthesize final answer
        return await self.synthesize(task, results)
    
    async def create_plan(self, task: str) -> Plan:
        prompt = f"""
        Create a step-by-step plan to accomplish this task: {task}
        
        Return as JSON:
        {{
            "steps": [
                {{"id": 1, "description": "...", "tool": "..."}},
                ...
            ]
        }}
        """
        return await self.llm.generate(prompt)
```

**使用场景：**
- 复杂的多步任务
- 需要可见的执行计划
- 任务受益于分解

---

### 模式：Critic/Verifier（评审者/校验者）

一个 Agent 生成，另一个进行评议：

```python
class CriticPattern:
    async def generate_with_critique(self, task: str, max_iterations: int = 3) -> str:
        response = await self.generator.generate(task)
        
        for i in range(max_iterations):
            # Critique the response
            critique = await self.critic.evaluate(task, response)
            
            if critique.is_acceptable:
                break
            
            # Regenerate with feedback
            response = await self.generator.regenerate(
                task, 
                previous=response, 
                feedback=critique.feedback
            )
        
        return response
```

**使用场景：**
- 质量要求高
- 可以接受额外延迟
- 任务有明确的成功标准

---

### 模式：Hierarchical Agents（分层 Agent）

管理者向专门化 Worker 下发任务：

```python
class ManagerAgent:
    def __init__(self):
        self.workers = {
            "research": ResearchAgent(),
            "coding": CodingAgent(),
            "writing": WritingAgent()
        }
    
    async def run(self, task: str) -> str:
        # Decompose task
        subtasks = await self.decompose(task)
        
        # Assign to workers
        results = {}
        for subtask in subtasks:
            worker = self.workers[subtask.worker_type]
            results[subtask.id] = await worker.execute(subtask)
        
        # Synthesize results
        return await self.synthesize(task, results)
```

**使用场景：**
- 跨多个领域的复杂任务
- 不同子任务需要不同工具
- 存在并行化机会

---

## 优化模式

### 模式：Cascading Models（级联模型）

路由到“足够好且最便宜”的模型：

```python
class ModelCascade:
    def __init__(self):
        self.models = [
            ("gpt-4o-mini", 0.15),     # Cheapest
            ("gpt-4o", 2.50),           # Mid-tier
            ("claude-3.5-sonnet", 3.00) # Most capable
        ]
    
    async def generate(self, query: str) -> str:
        # Classify complexity
        complexity = await self.classify_complexity(query)
        
        if complexity == "simple":
            return await self.call_model("gpt-4o-mini", query)
        elif complexity == "medium":
            return await self.call_model("gpt-4o", query)
        else:
            return await self.call_model("claude-3.5-sonnet", query)
```

**使用场景：**
- 高查询量
- 查询复杂度变化大
- 成本优化优先

---

### 模式：Speculative Execution（推测执行）

先用小模型起草，再用大模型校验：

```python
class SpeculativeExecution:
    async def generate(self, prompt: str, n_tokens: int = 5) -> str:
        output = []
        
        while len(output) < max_tokens:
            # Draft with small model
            draft = await self.draft_model.generate(
                prompt + "".join(output),
                n_tokens=n_tokens
            )
            
            # Verify with large model
            verified = await self.target_model.verify(
                prompt + "".join(output),
                draft
            )
            
            # Accept verified tokens
            output.extend(verified.accepted_tokens)
            
            if verified.is_complete:
                break
        
        return "".join(output)
```

**使用场景：**
- 延迟敏感型应用
- 拥有对齐能力的草稿模型
- 生成模式可预测

---

### 模式：Caching Layers（分层缓存）

多级缓存策略：

```python
class CachingLLM:
    def __init__(self):
        self.exact_cache = ExactMatchCache()
        self.semantic_cache = SemanticCache(threshold=0.95)
    
    async def generate(self, query: str) -> str:
        # Level 1: Exact match
        cached = await self.exact_cache.get(query)
        if cached:
            return cached
        
        # Level 2: Semantic similarity
        similar = await self.semantic_cache.get_similar(query)
        if similar:
            return similar
        
        # Cache miss: Generate
        response = await self.llm.generate(query)
        
        # Store in caches
        await self.exact_cache.set(query, response)
        await self.semantic_cache.set(query, response)
        
        return response
```

**使用场景：**
- 重复性高的相似查询
- 成本降低优先
- 可容忍一定的数据过期（staleness）

---

## 可靠性模式

### 模式：Retry with Fallback（重试 + 回退）

```python
class RetryWithFallback:
    async def generate(self, query: str) -> str:
        providers = [
            ("openai", "gpt-4o"),
            ("anthropic", "claude-3.5-sonnet"),
            ("google", "gemini-1.5-pro")
        ]
        
        for provider, model in providers:
            try:
                return await self.call(provider, model, query)
            except RateLimitError:
                continue
            except ServiceError:
                continue
        
        # All providers failed
        raise AllProvidersUnavailable()
```

---

### 模式：Circuit Breaker（熔断器）

```python
class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, reset_timeout: int = 60):
        self.failures = 0
        self.state = "closed"
        self.last_failure = None
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
    
    async def call(self, func, *args):
        if self.state == "open":
            if time.time() - self.last_failure > self.reset_timeout:
                self.state = "half-open"
            else:
                raise CircuitOpenError()
        
        try:
            result = await func(*args)
            self.failures = 0
            self.state = "closed"
            return result
        except Exception as e:
            self.failures += 1
            self.last_failure = time.time()
            if self.failures >= self.failure_threshold:
                self.state = "open"
            raise
```

---

### 模式：Bulkhead（舱壁隔离）

隔离组件间故障传播：

```python
class BulkheadExecutor:
    def __init__(self, max_concurrent: int = 10):
        self.semaphore = asyncio.Semaphore(max_concurrent)
    
    async def execute(self, func, *args):
        async with self.semaphore:
            return await func(*args)

# Separate bulkheads for different operations
rag_bulkhead = BulkheadExecutor(max_concurrent=20)
agent_bulkhead = BulkheadExecutor(max_concurrent=5)
```

---

## 成本模式

### 模式：Token Budget（Token 预算）

```python
class TokenBudget:
    def __init__(self, max_input: int, max_output: int):
        self.max_input = max_input
        self.max_output = max_output
    
    def constrain_input(self, messages: list[dict]) -> list[dict]:
        total_tokens = 0
        constrained = []
        
        for msg in reversed(messages):
            tokens = count_tokens(msg["content"])
            if total_tokens + tokens > self.max_input:
                break
            constrained.insert(0, msg)
            total_tokens += tokens
        
        return constrained
```

---

### 模式：Cost Tracking Decorator（成本追踪装饰器）

```python
def track_cost(model: str):
    def decorator(func):
        async def wrapper(*args, **kwargs):
            start_tokens = get_token_count()
            result = await func(*args, **kwargs)
            end_tokens = get_token_count()
            
            cost = calculate_cost(model, end_tokens - start_tokens)
            metrics.record("llm_cost", cost, tags={"model": model})
            
            return result
        return wrapper
    return decorator

@track_cost("gpt-4o")
async def generate_response(query: str):
    return await llm.generate(query)
```

---

## 面试题

### 问：请描述三种 RAG（Retrieval-Augmented Generation，检索增强生成）模式及其适用场景。

**标准答案：**

“我会讲述 Naive RAG、Advanced RAG 和 Parent-Child Retrieval（父子检索）。

**Naive RAG** 是最简单的方式：对查询做 embedding，进行向量检索，将 top K 片段塞入 prompt（提示词）后生成。我在 MVP 和检索质量已经不错的场景下使用它。它实现快，但没有重排序或查询增强。

**Advanced RAG** 增加了多阶段流程：查询改写（query rewriting）、混合检索（语义 + 关键词）、重排序（reranking）和过滤。我在对准确率有要求的生产环境中使用它。额外的延迟（重排序带来的 100-200ms）在精确率提升 10-15% 时是值得的。

**Parent-Child Retrieval** 对小片段做 embedding 以保证匹配精度，但返回更大粒度的父级片段以补充上下文。我在文档有结构化组织且既需要检索精度又需要生成上下文时使用它。

我选择的模式取决于准确率要求、延迟预算和文档特征。我通常先从 Naive RAG 开始建立基线，再迭代到 Advanced RAG。”

### 问：你会为生产级 LLM 系统使用哪些可靠性模式？

**标准答案：**

“我会实施多层可靠性机制：

**Retry with exponential backoff（指数退避重试）** 用于处理瞬时故障。LLM API 常见速率限制和临时错误。

**Multi-provider fallback（多供应商回退）**，这样当 OpenAI 出现问题时，可以自动切换到 Anthropic 或 Google。这需要对 LLM 接口进行抽象。

**Circuit breaker（熔断器）** 用于避免反复打爆故障中的服务。连续 N 次失败后，我会打开熔断并立即路由到 fallback，让主服务有时间恢复。

**Graceful degradation（优雅降级）** 在所有供应商都失效时生效。返回缓存结果、展示回退提示，或改为排队稍后处理，而不是直接报错。

**Bulkhead isolation（舱壁隔离）** 以防单一组件故障级联。Agent 工作负载与 RAG 工作负载使用独立的线程池。

**Timeouts（超时控制）** 覆盖每个层级。LLM 调用可能会卡住；我会设置较严格的超时，并优雅处理。

关键是默认假设故障会发生，并为故障设计系统，而不是假设它们不会发生。”

---

## 参考资料

- Gao 等. 《检索增强生成（Retrieval-Augmented Generation, RAG）用于大型语言模型：综述》（2024）
- Yao 等. 《ReAct：在语言模型中协同推理与行动》（2023）
- Microsoft AI 模式：https://learn.microsoft.com/azure/architecture/patterns/

---

*下一步：[避免反模式](02-anti-patterns.md)*
