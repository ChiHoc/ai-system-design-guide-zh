# 大语言模型可观察性（LLM Observability）

LLM（大语言模型）系统的可观察性（observability）需要根据 AI 应用的独特特性，对日志（logs）、指标（metrics）和调用链（traces）这三大支柱进行适配。

## 目录

- [为什么 LLM 可观察性不同](#为什么-llm-可观察性不同)
- [三大支柱](#三大支柱)
- [关键指标](#关键指标)
- [追踪 LLM 流水线](#质量监控)
- [质量监控](#质量监控)
- [成本追踪](#成本追踪)
- [告警策略](#告警策略)
- [可观察性工具](#可观察性工具)
- [面试问题](#面试问题)
- [参考资料](#参考资料)

---

## 为什么 LLM 可观察性不同

传统可观察性（observability）关注：
- 请求/响应模式
- 延迟和吞吐量
- 错误率
- 资源利用率

LLM 系统新增了：
- **质量是一级指标（first-class metric）**：一个快速且可用、但输出很差的系统，仍然是失败的
- **非确定性（non-determinism）**：同一输入可能产生不同输出
- **Token 经济学（token economics）**：成本会以复杂方式随使用量增长
- **多组件流水线（multi-component pipelines）**：RAG 通常包含检索、重排序、生成步骤
- **主观正确性（subjective correctness）**：通常没有可直接对照的真实值（ground truth）

---

## 三大支柱

### 日志（Logging）

```python
class LLMLogger:
    def log_request(
        self,
        request_id: str,
        model: str,
        messages: list[dict],
        parameters: dict
    ):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "request_id": request_id,
            "type": "llm_request",
            "model": model,
            "parameters": parameters,
            "input_tokens": self.count_tokens(messages),
            # Hash for privacy, full content in secure store
            "content_hash": self.hash_content(messages)
        }
        self.logger.info(json.dumps(log_entry))
    
    def log_response(
        self,
        request_id: str,
        response: str,
        latency_ms: float,
        tokens: dict
    ):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "request_id": request_id,
            "type": "llm_response",
            "latency_ms": latency_ms,
            "input_tokens": tokens["input"],
            "output_tokens": tokens["output"],
            "ttft_ms": tokens.get("ttft_ms"),
            "content_hash": self.hash_content(response)
        }
        self.logger.info(json.dumps(log_entry))
```

**需要记录的内容（What to log）:**
- 用于关联的 Request ID
- 模型和参数
- Token 数量
- 延迟（TTFT 和总时延）
- 内容（若涉及隐私则进行哈希处理）

### 指标（Metrics）

```python
from prometheus_client import Counter, Histogram, Gauge

# Request metrics
llm_requests_total = Counter(
    "llm_requests_total",
    "Total LLM requests",
    ["model", "status"]
)

llm_latency_seconds = Histogram(
    "llm_latency_seconds",
    "LLM request latency",
    ["model"],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0]
)

llm_ttft_seconds = Histogram(
    "llm_ttft_seconds",
    "Time to first token",
    ["model"],
    buckets=[0.05, 0.1, 0.2, 0.5, 1.0, 2.0]
)

# Token metrics
tokens_used_total = Counter(
    "tokens_used_total",
    "Total tokens consumed",
    ["model", "direction"]  # direction: input/output
)

# Cost metrics
llm_cost_dollars = Counter(
    "llm_cost_dollars",
    "LLM cost in dollars",
    ["model"]
)

# Quality metrics (sampled)
quality_score = Gauge(
    "llm_quality_score",
    "Sampled quality score",
    ["model", "task_type"]
)
```

### 调用链（Traces）

RAG 流水线的端到端追踪：

```python
from opentelemetry import trace

tracer = trace.get_tracer("rag_pipeline")

async def rag_query(query: str) -> str:
    with tracer.start_as_current_span("rag_query") as span:
        span.set_attribute("query", query)
        
        # Embedding step
        with tracer.start_as_current_span("embed_query") as embed_span:
            query_embedding = await embed(query)
            embed_span.set_attribute("embedding_dim", len(query_embedding))
        
        # Retrieval step
        with tracer.start_as_current_span("vector_search") as search_span:
            results = await vector_db.search(query_embedding, top_k=10)
            search_span.set_attribute("results_count", len(results))
            search_span.set_attribute("top_score", results[0].score if results else 0)
        
        # Reranking step
        with tracer.start_as_current_span("rerank") as rerank_span:
            reranked = await reranker.rerank(query, results)
            rerank_span.set_attribute("reranked_count", len(reranked))
        
        # Generation step
        with tracer.start_as_current_span("generate") as gen_span:
            response = await llm.generate(query, context=reranked[:5])
            gen_span.set_attribute("model", llm.model)
            gen_span.set_attribute("output_tokens", count_tokens(response))
        
        return response
```

---

## 关键指标

### 运行指标（Operational Metrics）

| 指标 | 描述 | 典型告警阈值 |
|--------|-------------|------------------------|
| 请求率 | 每秒请求数 | 异常检测 |
| 错误率 | 失败请求 / 总请求 | > 5% |
| 延迟 p50 | 响应时间中位数 | > 2s |
| 延迟 p95 | 95 分位数 | > 5s |
| 延迟 p99 | 99 分位数 | > 10s |
| TTFT | 首个 token 出现时间 | > 1s |
| Token 吞吐量 | 每秒 token 数 | < 基线 |

### 质量指标（Quality Metrics）

| 指标 | 描述 | 采集方式 |
|--------|-------------|-------------------|
| 质量评分 | LLM-as-judge 评分 | 抽样（1-5%） |
| 忠实度 | RAG 回答是否基于上下文 | 抽样 |
| 相关性 | 回答是否回应了问题 | 抽样 |
| 用户满意度 | 点赞/点踩、评分 | 用户反馈 |
| 任务完成率 | 用户是否达成目标 | 隐式信号 |

### 成本指标（Cost Metrics）

| 指标 | 描述 | 粒度 |
|--------|-------------|-------------|
| 每次请求成本 | 平均成本 | 按模型 |
| 每日成本 | 每日总支出 | 全局 + 按模型 |
| 每次用户动作成本 | 完成用户目标的成本 | 按任务类型 |
| Token 效率 | 每个 token 带来的价值 | 按使用场景 |

---

## 质量监控

### 采样策略（Sampling Strategy）

```python
class QualitySampler:
    def __init__(self, sample_rate: float = 0.05):
        self.sample_rate = sample_rate
        self.judge = LLMJudge()
    
    async def maybe_evaluate(
        self,
        request_id: str,
        query: str,
        context: list[str],
        response: str
    ):
        # Sample randomly
        if random.random() > self.sample_rate:
            return
        
        # Evaluate quality
        scores = await self.judge.evaluate(
            query=query,
            context=context,
            response=response,
            criteria=["relevance", "faithfulness", "helpfulness"]
        )
        
        # Record metrics
        for criterion, score in scores.items():
            quality_score.labels(
                model=self.model,
                criterion=criterion
            ).set(score)
        
        # Store for analysis
        await self.store_evaluation(request_id, scores)
```

### 漂移检测（Drift Detection）

```python
class QualityDriftDetector:
    def __init__(self, window_size: int = 1000):
        self.window_size = window_size
        self.baseline_scores = []
        self.current_scores = []
    
    def add_score(self, score: float):
        self.current_scores.append(score)
        
        if len(self.current_scores) >= self.window_size:
            self.check_drift()
            self.current_scores = []
    
    def check_drift(self):
        if not self.baseline_scores:
            self.baseline_scores = self.current_scores.copy()
            return
        
        # Statistical test for drift
        baseline_mean = np.mean(self.baseline_scores)
        current_mean = np.mean(self.current_scores)
        
        # Simple threshold-based detection
        drift_threshold = 0.1  # 10% degradation
        if (baseline_mean - current_mean) / baseline_mean > drift_threshold:
            self.alert_drift(baseline_mean, current_mean)
    
    def alert_drift(self, baseline: float, current: float):
        alert = {
            "type": "quality_drift",
            "baseline_score": baseline,
            "current_score": current,
            "degradation_pct": (baseline - current) / baseline * 100
        }
        self.send_alert(alert)
```

---

## 成本追踪

### 实时成本计算（Real-Time Cost Calculation）

```python
class CostTracker:
    # Pricing per 1M tokens (verify current rates)
    PRICING = {
        "gpt-4o": {"input": 2.50, "output": 10.00},
        "gpt-4o-mini": {"input": 0.15, "output": 0.60},
        "claude-3.5-sonnet": {"input": 3.00, "output": 15.00},
        "claude-3.5-haiku": {"input": 0.25, "output": 1.25},
    }
    
    def track(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
        request_id: str
    ) -> float:
        pricing = self.PRICING.get(model, {"input": 0, "output": 0})
        
        input_cost = (input_tokens / 1_000_000) * pricing["input"]
        output_cost = (output_tokens / 1_000_000) * pricing["output"]
        total_cost = input_cost + output_cost
        
        # Record metrics
        llm_cost_dollars.labels(model=model).inc(total_cost)
        tokens_used_total.labels(model=model, direction="input").inc(input_tokens)
        tokens_used_total.labels(model=model, direction="output").inc(output_tokens)
        
        # Log for analysis
        self.log_cost(request_id, model, input_tokens, output_tokens, total_cost)
        
        return total_cost
```

### 成本归因（Cost Attribution）

```python
class CostAttributor:
    def attribute_cost(
        self,
        request_id: str,
        user_id: str,
        team: str,
        use_case: str,
        cost: float
    ):
        # Store for billing and analysis
        attribution = {
            "request_id": request_id,
            "user_id": user_id,
            "team": team,
            "use_case": use_case,
            "cost": cost,
            "timestamp": datetime.utcnow()
        }
        
        self.store(attribution)
        
        # Update running totals
        self.update_user_total(user_id, cost)
        self.update_team_total(team, cost)
        
        # Check budgets
        if self.exceeds_budget(team):
            self.alert_budget_exceeded(team)
```

---

## 告警策略

### 告警配置（Alert Configuration）

```yaml
alerts:
  # Availability
  - name: high_error_rate
    condition: error_rate > 0.05
    for: 5m
    severity: critical
    runbook: "Check provider status, verify API keys, review recent changes"
    
  # Latency
  - name: high_latency_p95
    condition: latency_p95 > 10s
    for: 5m
    severity: warning
    runbook: "Check model, reduce context size, verify provider status"
    
  # Cost
  - name: cost_spike
    condition: hourly_cost > 2 * rolling_avg_hourly_cost
    for: 1h
    severity: warning
    runbook: "Check for traffic spike, review recent deployments, verify caching"
    
  # Quality
  - name: quality_degradation
    condition: avg_quality_score < 3.5 over 1h
    for: 30m
    severity: warning
    runbook: "Review recent changes, check model performance, sample responses"
    
  # Resource
  - name: rate_limit_approaching
    condition: rate_limit_usage > 0.8
    for: 15m
    severity: warning
    runbook: "Consider model routing, implement backpressure"
```

### 告警优先级（Alert Prioritization）

| 严重级别 | 响应时间 | 示例 |
|----------|---------------|----------|
| 严重 | < 15 分钟 | 服务不可用、错误率 > 50% |
| 高 | < 1 小时 | 错误率 > 10%，P99 > 30s |
| 警告 | < 4 小时 | 质量下降、成本激增 |
| 信息 | 下一个工作日 | 趋势变化、容量规划 |

---

## 可观察性工具

### LLM 专用工具

| 工具 | 重点 | 最适合 |
|------|-------|----------|
| LangSmith | LangChain tracing | 基于 LangChain 的应用 |
| Langfuse | 开源 tracing | 自托管、隐私保护 |
| Weights & Biases | 实验跟踪 | ML 团队 |
| Arize Phoenix | LLM 监控 | 生产环境监控 |
| Helicone | API 代理日志 | 简单集成 |

### 集成示例：Langfuse

```python
from langfuse import Langfuse

langfuse = Langfuse()

async def traced_rag_query(query: str) -> str:
    # Start trace
    trace = langfuse.trace(name="rag_query", input=query)
    
    # Embedding span
    embed_span = trace.span(name="embed")
    embedding = await embed(query)
    embed_span.end()
    
    # Retrieval span
    retrieve_span = trace.span(name="retrieve")
    results = await vector_db.search(embedding)
    retrieve_span.end(output={"count": len(results)})
    
    # Generation span
    gen_span = trace.generation(
        name="generate",
        model="gpt-4o",
        input={"query": query, "context": results}
    )
    response = await llm.generate(query, context=results)
    gen_span.end(output=response)
    
    # End trace
    trace.update(output=response)
    
    return response
```

---

## 面试问题

### 问：你会为生产环境的 LLM 系统监控哪些指标？

**强回答：**

“我会把指标分成三类：

**运行指标（Operational metrics）**：这是任何服务都应具备的基础指标。
- 请求率（request rate）和错误率（error rate）
- 延迟分位数：p50、p95、p99
- 流式输出（streaming）的首 token 时间（TTFT）
- 可用性（availability）

**质量指标（Quality metrics）**：这是 LLM 可观察性的独特之处。
- 使用 LLM-as-judge（大模型评审）进行抽样质量评分（样本率 1-5%）
- 对于 RAG：忠实度（faithfulness）和相关性（relevance）评分
- 用户反馈：点赞/点踩、显式评分
- 在可衡量时的任务完成率（task completion rate）

**成本指标（Cost metrics）**：
- 按模型划分的每次请求成本（cost per request）
- 每日/每周成本趋势
- 每次成功用户动作成本（cost per successful user action）
- Token 效率（token efficiency）

我会为运行问题（error rate > 5%，P95 > SLA）和质量漂移（平均分较基线下降 10%）设置告警。成本告警有助于捕捉失控的用量激增（runaway usage）。

关键洞察是：一个快速、可用但输出质量差的 LLM 系统，依然是在失败。质量必须是一级指标（first-class metric）。”

### 问：你如何在生产中检测质量下降？

**强回答：**

“我采用多种方法：

**持续抽样（Continuous sampling）**：我会对 1-5% 的请求进行 LLM-as-judge（大模型评审）评估。这能在不对全部请求做评估的情况下提供质量信号。

**漂移检测（Drift detection）**：我会维护一个质量分布基线（baseline），并使用统计检验来检测当前得分何时出现显著漂移。10% 的质量下降会触发警告。

**用户反馈（User feedback）**：点赞/点踩（thumbs up/down），如果可用则使用显式评分。这是用户满意度的真实反馈（ground truth）。

**隐式信号（Implicit signals）**：任务完成率、重试率（retry rate）、升级率（escalation rate）、会话时长。如果用户更难完成任务，质量可能已经下降。

**当我检测到下降时的处理方式：**
1. 检查最近是否有部署（deployment）或提示词（prompt）变更
2. 抽样检查具体响应以定位问题
3. 检查是模型相关问题（provider issue）还是普遍性问题
4. 必要时回滚（rollback），然后再进一步调查

我还会维护一套黄金测试集（golden test set），并在每次部署时运行，以便在生产前捕获回归（regressions）。”

---

## 参考资料

- OpenTelemetry: https://opentelemetry.io/
- Langfuse: https://langfuse.com/docs
- LangSmith: https://docs.smith.langchain.com/

---

*下一篇：[基准测试与排行榜](03-benchmarks-and-leaderboards.md)*
