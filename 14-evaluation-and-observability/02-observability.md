# 大语言模型可观察性（LLM Observability）

LLM（大语言模型）系统的可观察性（observability）需要根据 AI 应用的独特特性，对日志（logs）、指标（metrics）和调用链（traces）这三大支柱进行适配。

## 目录

- [为什么 LLM 可观察性不同](#为什么-llm-可观察性不同)
- [三大支柱](#三大支柱)
  - [追踪 LLM 流水线](#调用链-traces)
  - [埋点悄然失效时](#埋点悄然失效时)
- [关键指标](#关键指标)
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
- 模型和参数，包括 effort 级别，以及响应声明实际提供服务的模型 ID（默认值和路由会在你不知情时改变）
- 分列未缓存输入、缓存读取、缓存写入、输出和推理 token 数量（推理按输出计费，但通常不会出现在响应文本中）
- 延迟（TTFT 和总时延）
- SDK 和提示词版本，以便将回归与变更关联
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
    ["model", "direction"]  # direction: uncached_input, cache_read, cache_write, output
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
    ["model", "criterion"]
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

属性名应遵循 OpenTelemetry GenAI 语义约定（`gen_ai.*`），不要自创命名；LLM 专用后端会依赖这些属性展示视图，Langfuse v`4` SDK 默认也只导出 Langfuse、`gen_ai.*` 和已知 LLM 埋点作用域的 span。

### 埋点悄然失效时

最危险的可观测性故障，是看起来健康却已安静下来的仪表盘。`2026` 年 8 月，两家主要 Python 提供方 SDK 都更改了追踪与测试工具所挂接的 HTTP 层：OpenAI Python SDK `3.0.0`（8 月 12 日）默认使用 `httpx2`，不再安装 `httpx`；Anthropic Python SDK `1.0.0`（8 月 20 日）也迁移至 `httpx2`。Anthropic 的迁移指南警告，如果没有在任何代码导入 `httpx` 前运行 `httpx2.alias_httpx()`，OpenTelemetry HTTPX 埋点器、Sentry 的 httpx 集成、`respx`、`pytest-httpx` 和 `vcrpy` 可能悄然漏掉 SDK 请求。结果是生产环境缺少 span、测试中的真实调用未被模拟，却没有任何报错。

两项控制可以发现这类故障：

- **CI 中的遥测金丝雀。** 一项测试通过生产客户端发起真实（或录制）的模型调用，并断言预期 span、token 数量与成本指标均已发出。每次依赖升级都运行它。
- **每日对账。** 将遥测中的 token 和金额与提供方使用量或账单导出对比。差距超过几个百分点意味着有数据停止上报。

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
| 每个已解决任务的成本 | 总支出除以实际成功的任务数 | 按代理和模型 |
| 缓存命中率 | 已缓存输入 token／全部输入 token | 按模型和提示词模板 |
| Token 效率 | 每个 token 带来的价值 | 按使用场景 |

---

## 质量监控

### 采样策略（Sampling Strategy）

```python
class QualitySampler:
    def __init__(self, model: str, sample_rate: float = 0.05):
        self.model = model
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
from dataclasses import dataclass

@dataclass(frozen=True)
class Rate:
    """USD per 1M tokens."""
    input: float        # uncached input
    output: float       # output, including reasoning tokens
    cache_read: float   # input served from the prompt cache
    cache_write: float  # input written to the cache (Anthropic 5-minute tier; OpenAI bills 1.25x input)

class CostTracker:
    # Standard-tier list prices, October 2026. Load these from config in production:
    # promotions, long-context tiers, speed tiers, and residency premiums change monthly.
    PRICING = {
        "claude-opus-5-5":   Rate(input=4.00, output=20.00, cache_read=0.20, cache_write=5.00),
        "claude-sonnet-5-5": Rate(input=2.00, output=10.00, cache_read=0.20, cache_write=2.50),
        "gpt-6-sol":         Rate(input=2.00, output=10.00, cache_read=0.20, cache_write=2.50),
        "gpt-6-luna":        Rate(input=0.10, output=0.50,  cache_read=0.01, cache_write=0.125),
    }

    BUCKETS = ("uncached_input", "cache_read", "cache_write", "output")

    def track(self, model: str, usage: dict, request_id: str) -> float:
        # `usage` must already be split into the four disjoint BUCKETS. Providers
        # disagree on whether cached tokens are counted inside the input total,
        # so normalize per provider upstream or you will double-count.
        rate = self.PRICING.get(model)
        if rate is None:
            # Never price an unknown model at $0: that hides the most expensive mistakes.
            raise KeyError(f"No price configured for {model!r}")

        total_cost = (
            usage["uncached_input"] * rate.input
            + usage["cache_read"] * rate.cache_read
            + usage["cache_write"] * rate.cache_write
            + usage["output"] * rate.output
        ) / 1_000_000

        # Record metrics
        llm_cost_dollars.labels(model=model).inc(total_cost)
        for bucket in self.BUCKETS:
            tokens_used_total.labels(model=model, direction=bucket).inc(usage[bucket])

        # Log for analysis
        self.log_cost(request_id, model, usage, total_cost)

        return total_cost
```

四条计费规则会让简单的按 token 计算失准：

- **缓存读取主导代理账单。** Anthropic 于 `2026` 年 9 月 24 日发布的 Claude Code 汇总用量数据（供应商报告）显示，输入与输出 token 之比为 `324:1`，3 月时为 `189:1`。在这个比例下，缓存输入价格和命中率对成本的影响远大于输出价格。缓存读取折扣也因模型而异：大多数 Claude 模型按输入价的 `0.1` 倍计费，Opus `5.5` 为 `0.05` 倍，Fable `5.1` 为 `0.025` 倍。
- **长上下文层级会重新定价整个请求。** OpenAI 在输入超过 `272K` token 后按长上下文费率计算整个请求（GPT-`6` Sol 从 `$2/$10` 变为 `$4/$15`）；xAI 对达到 `200K` token 的 Grok `4.7` 提示词按 `2` 倍计收每个 token。Anthropic 的 `4.6` 及之后模型直到 `1M` token 都采用统一价格。
- **速度与数据驻留层级会成倍提高费率。** OpenAI Fast 层级为 `2` 倍（GPT-`6` Astra 的 Ultrafast 为 `6` 倍），数据驻留选项比标价约高 `10%`（Anthropic 的 `inference_geo: "us"` 为 `1.1` 倍）。
- **促销会到期。** Gemini `3.8` Flash 的优惠价 `$0.75/$3.75` 持续到 `2026` 年 12 月 31 日，`2027` 年 1 月 1 日变为 `$1.50/$7.50`。预算应按标价制定。

因此，应为每条成本记录标明层级、区域和缓存分桶，并在支出仪表盘上同时展示缓存命中率。

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
    runbook: "Check provider status, verify API keys, review recent changes, fail over to a different vendor"
    
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

  - name: cache_hit_rate_drop
    condition: cache_hit_rate < baseline_cache_hit_rate - 0.15
    for: 1h
    severity: warning
    runbook: "Diff the prompt prefix (tool order, timestamps, injected IDs), check for a model or SDK change"

  - name: served_model_changed
    condition: served_model != pinned_model
    for: 5m
    severity: warning
    runbook: "Check provider changelog and gateway routing; re-run the regression suite before accepting"
    
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

严重级别的规划应考虑供应商全局故障，而不只是单个模型故障。`2026` 年 8 月 16 日至 9 月 29 日，Anthropic 状态信息至少记录了 `12` 次重大或严重事件；OpenAI 9 月 29 日的事件则使 API、ChatGPT 与 Codex 同时降级约 `5` 小时 `20` 分钟。当供应商的 API 和编码代理同时中断时，仍留在同一供应商内部的回退链没有帮助；应跨供应商路由，并对回退率告警，以便知道系统何时运行在备用方案上。

---

## 可观察性工具

### LLM 专用工具

| 工具 | 重点 | 最适合 | 留意事项 |
|------|------|----------|----------|
| LangSmith | 追踪与评测；轨迹转微调自 `2026` 年 9 月 24 日起公开测试 | LangChain 和 LangGraph 应用 | 自 `2026` 年 9 月 14 日起，SaaS 轨迹的延长留存最多为 `180` 天；自托管和 BYOC 不变 |
| Langfuse | 基于 OpenTelemetry 的开源追踪与评测 | 自托管、隐私保护 | 自 `2026` 年 1 月起成为 ClickHouse 一部分；Python SDK v`4` 修改了 API，默认只导出 LLM 作用域的 span |
| Weights & Biases | 实验跟踪；Weave 用于 LLM 追踪与评测 | 同时跟踪训练和微调运行的 ML 团队 | 自 `2025` 年起成为 CoreWeave 一部分 |
| Arize Phoenix | LLM 追踪与评测 | 生产环境监控 | Elastic-`2.0` 许可证（源码可用，非 OSI 开源）；Dynatrace 于 `2026` 年 8 月同意以 `$915M` 收购 Arize，并表示 Phoenix 继续可用 |
| Helicone | API 代理日志 | 简单集成 | 被 Mintlify 收购（`2026` 年 3 月宣布）；采用前确认产品路线图 |

**选择时考虑退出能力，不只看功能。** 这一层正在快速整合，因此供应商风险也是选择标准。应从自己的代码发出带 `gen_ai.*` 属性的 OpenTelemetry 数据，以便切换后端；需要审计或合规的轨迹应保留在自己控制的存储中（留存上限 `180` 天的 SaaS 追踪存储不是审计日志）；评测数据集与裁判提示词也应导出为自己掌控的格式。

### 集成示例：Langfuse（Python SDK v`4`）

Langfuse Python SDK 自 v`3` 重写（`2025` 年 6 月）起就基于 OpenTelemetry，到 `2026` 年 9 月底版本为 `4.16.0`。旧教程中的 v`2` 模式（`langfuse.trace()`、`trace.span()`、`trace.generation()`、`span.end()`）已过时；应使用 `@observe()` 装饰器和 `start_as_current_observation()`：

```python
from langfuse import get_client, observe, propagate_attributes

langfuse = get_client()  # credentials from the LANGFUSE_* environment variables

@observe(name="rag_query")  # root observation; captures input and return value
async def traced_rag_query(query: str, user_id: str, session_id: str) -> str:
    with propagate_attributes(user_id=user_id, session_id=session_id):
        with langfuse.start_as_current_observation(as_type="span", name="retrieve") as span:
            embedding = await embed(query)
            results = await vector_db.search(embedding, top_k=10)
            span.update(output={"count": len(results), "ids": [r.id for r in results]})

        context = results[:5]
        with langfuse.start_as_current_observation(
            as_type="generation",
            name="generate",
            model="claude-sonnet-5-5",
            input={"query": query, "context": [r.text for r in context]},
        ) as gen:
            response = await llm.generate(query, context=context)
            gen.update(
                output=response.text,
                usage_details={  # Langfuse's own keys; flat buckets must not overlap
                    "input": response.usage.input_tokens,
                    "output": response.usage.output_tokens,
                },
            )

    return response.text
```

v`4` 的两个行为值得注意。被装饰的函数会记录参数与返回值，因此不要在可观测函数的签名中放入嵌入向量、原始文档和敏感字段，或应对其脱敏。v`4` 默认只导出 Langfuse、`gen_ai.*` 和已知 LLM 埋点的 span，因此除非扩展过滤器，否则同一进程的数据库和 HTTP span 不会出现。

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
- 使用蒸馏或决策模型裁判对全部流量进行二元检查（违反政策、缺少引用）；成本如今足够低，可覆盖 `100%` 流量
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

### 问：常规依赖升级后，LLM 仪表盘变安静了：span 变少，token 数量下降，但流量和提供方账单不变。发生了什么？怎样防止重演？

**强回答：**

“账单不变而遥测下降，说明埋点出了问题，而非流量下降。我首先怀疑 HTTP 传输层。`2026` 年 8 月，OpenAI Python SDK `3.0` 和 Anthropic Python SDK `1.0` 都改用 `httpx2`；挂接 `httpx` 的埋点（OpenTelemetry HTTPX 埋点器、Sentry 集成，以及 `respx` 和 `vcrpy` 等模拟库）可能悄然看不到 SDK 调用，除非在任何代码导入 `httpx` 之前运行 `httpx2.alias_httpx()`。其他会产生同样症状的原因包括：追踪 SDK 主版本改变了 API 或默认 span 过滤器，或者升级时一并交付了采样配置。

确认方法是将一天的提供方使用量导出与本地 token 指标比较，再在预发环境发起一次调用，检查其 span 是否出现。

防止重演：
1. **CI 中的遥测金丝雀**：通过生产客户端发起一次模型调用，并断言 span、token 数量和成本指标均已发出。每次依赖升级都运行。
2. **每日对账**：用提供方账单导出对照遥测中的 token 和金额，差距超过几个百分点时告警。
3. **成组升级**：提供方 SDK、HTTP 客户端和埋点包一起固定版本、一起升级。

一般教训是，可观测性本身也需要测试。只有证实仪表盘会显示错误，仪表盘没有报错才算好消息。”

---

## 参考资料

- OpenTelemetry: https://opentelemetry.io/
- OpenTelemetry GenAI 语义约定：https://opentelemetry.io/docs/specs/semconv/gen-ai/
- Langfuse: https://langfuse.com/docs
- Langfuse Python SDK v`3` 至 v`4` 升级指南：https://langfuse.com/docs/observability/sdk/upgrade-path/python-v3-to-v4
- LangSmith: https://docs.smith.langchain.com/
- OpenAI Python SDK `httpx2` 说明：https://github.com/openai/openai-python/blob/main/httpx2.md

---

*下一篇：[基准测试与排行榜](03-benchmarks-and-leaderboards.md)*
