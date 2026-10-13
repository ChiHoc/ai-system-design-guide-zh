# 可靠性模式

生产环境中的 LLM 系统需要超出基本重试逻辑之外的稳健可靠性模式。本章介绍构建弹性 AI 应用的高级模式。

## 目录

- [可靠性挑战](#可靠性挑战)
- [重试模式](#重试模式)
- [断路器](#断路器)
- [舱壁模式](#舱壁模式)
- [超时策略](#超时策略)
- [优雅降级](#优雅降级)
- [多供应商故障转移](#多供应商故障转移)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 可靠性挑战

### LLM 特有故障模式

| 故障模式 | 原因 | 影响 |
|--------------|-------|--------|
| 限流 | 超出配额、流量增长过快 | 请求被拒绝 |
| 消费上限 | 达到月度预算上限 | 返回 429；在额度重置或提高前，重试无法解决 |
| 超时 | 生成时间过长、网络问题 | 响应缓慢或失败 |
| 供应商故障 | 基础设施问题 | 完全失败 |
| 质量下降 | 模型更新（有时模型 ID 不变）、SDK 默认模型变化、负载 | 不报错但输出更差 |
| 模型退役 | 模型 ID 按计划关闭（如 `claude-sonnet-4-5-20250929` 于 2026 年 11 月 30 日退役） | 提前宣布的日期出现硬故障（Anthropic 至少提前 60 天通知；OpenAI 正式可用模型提前 6 个月，预览模型可能仅提前两周） |
| 安全拒绝 | 提供方分类器拒绝请求 | HTTP 200 且内容为空，看似成功 |
| 上下文溢出 | 输入过大 | 请求失败 |
| 格式错误输出 | 生成错误 | 解析失败 |

其中两类故障容易漏掉，因为不会抛异常。**静默质量变化**可以发生在稳定的模型 ID 下：GPT-6 Sol 和 GPT-6 Luna 于 2026 年 9 月 22 日发布时存在图像编码缺陷，降低了图像理解和计算机操作能力；OpenAI 于 9 月 25 日在没有新快照的情况下修复，并要求使用图像输入的客户重跑评估。固定模型 ID 只固定了名字，不固定服务栈。默认值也会变化：openai-agents 0.20.0（2026 年 8 月 11 日）将 `gpt-5.6-luna` 设为隐式默认模型，于是从未指定模型的智能体在例行依赖升级后换了模型。应在所有位置显式指定模型。最新 Claude 模型的**安全拒绝**以成功响应返回，`stop_reason: "refusal"`；只按异常触发的重试逻辑看不到它（见下方[处理安全拒绝](#处理安全拒绝)）。

### 可靠性目标

| 等级 | 可用性 | p99 延迟 | 示例 |
|------|--------------|-------------|----------|
| 关键 | 99.99% | < 3s | 支付处理 |
| 标准 | 99.9% | < 10s | 客户支持 |
| 尽力而为 | 99% | < 30s | 后台任务 |

---

## 重试模式

### 带抖动的指数退避

```python
import random
import asyncio
from typing import TypeVar, Callable

T = TypeVar("T")

class RetryConfig:
    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        jitter: float = 0.5
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter
    
    def get_delay(self, attempt: int) -> float:
        delay = min(
            self.base_delay * (self.exponential_base ** attempt),
            self.max_delay
        )
        # Add jitter to prevent thundering herd
        jitter_range = delay * self.jitter
        delay += random.uniform(-jitter_range, jitter_range)
        return max(0, delay)


async def retry_with_backoff(
    func: Callable[[], T],
    config: RetryConfig,
    retryable_exceptions: tuple = (Exception,)
) -> T:
    last_exception = None
    
    for attempt in range(config.max_retries + 1):
        try:
            return await func()
        except retryable_exceptions as e:
            last_exception = e
            
            if attempt == config.max_retries:
                break
            
            delay = config.get_delay(attempt)
            await asyncio.sleep(delay)
    
    raise last_exception
```

### 可重试与不可重试错误

应按状态码**和**错误代码分类。同一状态码现在有不同含义：自 2026 年 9 月 2 日起，OpenAI 在流量爬升过快时返回代码为 `slow_down` 的 429，在模型临时过载时返回 503，两者可能都带 `Retry-After`。Anthropic 的加速限制也返回 429，但月度消费上限返回 `error_code: enforced_spend_limit_reached` 且没有 `retry-after`，只有额度重置或管理员提高上限才能解决。自行设置的更低消费限额又是另一种情况：它返回 400 `invalid_request_error`，消息提示已达到指定使用限制；下方这样的分类器会把组织级停用误判为普通错误请求。因此除了 429 和 5xx，也应对 400 突增告警。

```python
from enum import Enum

class RetryAction(Enum):
    BACKOFF = "backoff"                      # same provider, exponential backoff + jitter
    FAILOVER = "failover"                    # next provider in the chain
    FAILOVER_AND_PAGE = "failover_and_page"  # will not clear on its own; a human must act
    DO_NOT_RETRY = "do_not_retry"            # fix the request

class LLMRetryPolicy:
    @staticmethod
    def classify(status: int, code: str | None) -> RetryAction:
        if status == 429 and code == "enforced_spend_limit_reached":
            return RetryAction.FAILOVER_AND_PAGE   # Anthropic spend cap
        if status == 429:
            return RetryAction.BACKOFF             # includes OpenAI "slow_down": ramp gently
        if status in (500, 502, 503, 504, 529):
            return RetryAction.BACKOFF             # overload or server error; fail over if it persists
        if status == 404:
            return RetryAction.FAILOVER            # retired or wrong model ID; then fix the registry
        return RetryAction.DO_NOT_RETRY            # auth, bad request, context too long

    @staticmethod
    def delay(retry_after_header: str | None, computed_backoff: float) -> float:
        # Never retry sooner than the provider asked
        if retry_after_header:
            return max(float(retry_after_header), computed_backoff)
        return computed_backoff
```

超时和连接错误映射到 `BACKOFF`。忽略 `Retry-After` 是最常见的退避错误；将所有 429 一视同仁则是第二种。

### 处理安全拒绝

拒绝不是传输错误，因此上述重试机制不会捕捉。在 Claude Fable 5.1、Fable 5、Opus 5.5、Opus 5 和 Sonnet 5.5 上，安全分类器拒绝请求时返回 HTTP 200、`stop_reason: "refusal"` 和空内容，并给出 `stop_details.category`（`cyber`、`bio`、`frontier_llm`、`reasoning_extraction`、`general_harms` 或 `null`）。在同一模型上重试同一请求只会浪费成本，应改为路由：

- **服务端回退**（Claude API 测试版）：配合 `server-side-fallback-2026-07-01` 请求头设置 `fallbacks: "default"`，会使用 Anthropic 为该类别推荐的模型重试；也可从允许列表中指定最多三个目标（Fable 5.1 允许 Opus 4.8 和 Opus 5）。它只在分类器拒绝时触发；限流和过载照原样返回。Bedrock、Google Cloud 和 Foundry 不提供此功能，需通过 Anthropic SDK 的拒绝回退中间件在客户端重试。Message Batches 项若设置 `fallbacks` 会得到错误结果，因此需要自行重试被拒绝的批处理项。
- **为回退模型准备限流额度。** 如果回退模型限流或过载，API 会跳过该尝试并返回原始拒绝，在 `stop_details.recommended_model` 中提示可直接重试的模型。每次尝试都计入各自模型的限额，因此拒绝流量会转移到回退模型的配额上。
- **预期路由粘性。** 某个对话一旦回退，之后仍带 `fallbacks` 的请求会直接进入回退模型（路由约保留一小时且尽力而为，请求模型也可能随时被再次尝试）。逐模型流量与质量看板会相应变化，因此要读取响应中的 `model` 和 `usage.iterations`，不能假定由请求的模型作答。
- **`reasoning_extraction` 没有推荐回退模型。** 当提示词要求模型写出推理过程（`<thinking>` 段落或 JSON 中的 `reasoning` 字段）时会触发。应修改提示词，不要重试。
- **拒绝也消耗费用和配额。** 自 2026 年 9 月 24 日起，`bio`、`frontier_llm` 和 `reasoning_extraction` 类别中尚未输出内容就拒绝的请求也会计费，所有拒绝都计入限流。

拒绝不代表供应商健康状况，因此不能触发断路器。应按类别单独监控；激增通常意味着提示词、流量构成或供应商防护变化，而非故障。[护栏](01-guardrails.md#供应商防护措施与拒绝响应) 讨论防护层；[网关章节](../11-infrastructure-and-mlops/03-ai-gateways-and-model-routing.md#回退与可靠性) 给出完整响应分类流程。

---

## 断路器

### 实现

```python
from enum import Enum
from dataclasses import dataclass
from datetime import datetime, timedelta

class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing recovery

@dataclass
class CircuitBreakerConfig:
    failure_threshold: int = 5
    recovery_timeout: timedelta = timedelta(seconds=30)
    half_open_max_calls: int = 3
    success_threshold: int = 2  # Successes needed to close

class CircuitBreaker:
    def __init__(self, name: str, config: CircuitBreakerConfig):
        self.name = name
        self.config = config
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: datetime | None = None
        self.half_open_calls = 0
    
    def can_execute(self) -> bool:
        if self.state == CircuitState.CLOSED:
            return True
        
        if self.state == CircuitState.OPEN:
            # Check if recovery timeout has passed
            if self._recovery_timeout_elapsed():
                self._transition_to_half_open()
                self.half_open_calls += 1
                return True
            return False
        
        if self.state == CircuitState.HALF_OPEN:
            # Allow a limited number of probe calls in half-open state
            if self.half_open_calls < self.config.half_open_max_calls:
                self.half_open_calls += 1
                return True
            return False
        
        return False
    
    def record_success(self):
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.config.success_threshold:
                self._transition_to_closed()
        else:
            self.failure_count = 0
    
    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        
        if self.state == CircuitState.HALF_OPEN:
            self._transition_to_open()
        elif self.failure_count >= self.config.failure_threshold:
            self._transition_to_open()
    
    def _transition_to_open(self):
        self.state = CircuitState.OPEN
        self.success_count = 0
    
    def _transition_to_half_open(self):
        self.state = CircuitState.HALF_OPEN
        self.half_open_calls = 0
        self.success_count = 0
    
    def _transition_to_closed(self):
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
    
    def _recovery_timeout_elapsed(self) -> bool:
        if self.last_failure_time is None:
            return True
        return datetime.now() - self.last_failure_time >= self.config.recovery_timeout
```

### 在 LLM 客户端中的用法

```python
class ResilientLLMClient:
    def __init__(self):
        self.circuit_breakers = {
            "openai": CircuitBreaker("openai", CircuitBreakerConfig()),
            "anthropic": CircuitBreaker("anthropic", CircuitBreakerConfig()),
        }
    
    async def generate(self, prompt: str, provider: str = "openai") -> str:
        cb = self.circuit_breakers[provider]
        
        if not cb.can_execute():
            raise CircuitOpenError(f"Circuit breaker open for {provider}")
        
        try:
            result = await self._call_provider(provider, prompt)
            cb.record_success()
            return result
        except RetryableError as e:
            cb.record_failure()
            raise
```

**要明确哪些情况算作失败。** 将 5xx、过载、超时，以及经过退避仍持续出现的 429 计为失败。400 类错误和安全拒绝不应计入：它们描述的是请求，而非供应商健康状况；若计入，一个错误提示词模板就可能为所有人打开断路器。消费上限 429 则是相反方向的例外：应强制打开断路器，直到额度重置或提高，而不是每 30 秒试探一次。

---

## 舱壁模式

### 资源隔离

```python
import asyncio
from contextlib import asynccontextmanager

class Bulkhead:
    """
    Isolate resources to prevent cascade failures.
    """
    
    def __init__(
        self,
        name: str,
        max_concurrent: int,
        max_queued: int = 100
    ):
        self.name = name
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.queue_semaphore = asyncio.Semaphore(max_queued)
    
    @asynccontextmanager
    async def acquire(self, timeout: float = 30.0):
        # Check queue capacity
        if not self.queue_semaphore.locked():
            await self.queue_semaphore.acquire()
        else:
            raise BulkheadFullError(f"Bulkhead {self.name} queue full")
        
        try:
            # Wait for execution slot
            acquired = await asyncio.wait_for(
                self.semaphore.acquire(),
                timeout=timeout
            )
            self.queue_semaphore.release()
            
            try:
                yield
            finally:
                self.semaphore.release()
        except asyncio.TimeoutError:
            self.queue_semaphore.release()
            raise BulkheadTimeoutError(f"Bulkhead {self.name} timeout")


class BulkheadedLLMClient:
    def __init__(self):
        # Separate bulkheads for different workloads
        self.bulkheads = {
            "realtime": Bulkhead("realtime", max_concurrent=50),
            "batch": Bulkhead("batch", max_concurrent=200),
            "critical": Bulkhead("critical", max_concurrent=10)
        }
    
    async def generate(
        self,
        prompt: str,
        priority: str = "realtime"
    ) -> str:
        bulkhead = self.bulkheads[priority]
        
        async with bulkhead.acquire():
            return await self._call_llm(prompt)
```

---

## 超时策略

### 分层超时

```python
class TimeoutConfig:
    def __init__(
        self,
        connection_timeout: float = 5.0,
        first_token_timeout: float = 15.0,  # set per model and effort level
        read_timeout: float = 30.0,
        total_timeout: float = 60.0
    ):
        self.connection_timeout = connection_timeout
        self.first_token_timeout = first_token_timeout
        self.read_timeout = read_timeout
        self.total_timeout = total_timeout


class TimeoutManager:
    def __init__(self, config: TimeoutConfig):
        self.config = config
    
    async def execute_with_timeout(self, func, *args, **kwargs):
        try:
            return await asyncio.wait_for(
                func(*args, **kwargs),
                timeout=self.config.total_timeout
            )
        except asyncio.TimeoutError:
            raise LLMTimeoutError(
                f"Request timed out after {self.config.total_timeout}s"
            )
```

**首 token 时间需要单独设超时。** 对流式响应，首 token 截止时间是故障转移的关键：首 token 之前可以无缝转到其他后端，之后则必须从头重放或向用户暴露错误。网关现已直接支持这一点（Envoy AI Gateway 1.1 新增 `streamIdleTimeout`，流在首 token 前停滞时可转移到下一后端，中途停滞则返回 504）。应按模型和 effort 设置：高强度推理请求可能长时间没有可见输出；按快速模型调出的 TTFT 截止时间会无端触发故障转移。

### 自适应超时

```python
class AdaptiveTimeout:
    """
    Adjust timeouts based on observed latency.
    """
    
    def __init__(
        self,
        initial_timeout: float = 30.0,
        min_timeout: float = 10.0,
        max_timeout: float = 120.0,
        percentile: float = 0.99
    ):
        self.min_timeout = min_timeout
        self.max_timeout = max_timeout
        self.percentile = percentile
        self.latencies: list[float] = []
        self.current_timeout = initial_timeout
    
    def record_latency(self, latency: float):
        self.latencies.append(latency)
        
        # Keep last 1000 observations
        if len(self.latencies) > 1000:
            self.latencies = self.latencies[-1000:]
        
        # Update timeout to percentile + buffer
        if len(self.latencies) >= 10:
            sorted_latencies = sorted(self.latencies)
            idx = int(len(sorted_latencies) * self.percentile)
            p99_latency = sorted_latencies[idx]
            
            # Add 20% buffer
            new_timeout = p99_latency * 1.2
            self.current_timeout = max(
                self.min_timeout,
                min(self.max_timeout, new_timeout)
            )
    
    def get_timeout(self) -> float:
        return self.current_timeout
```

---

## 优雅降级

### 降级级别

```python
class DegradationLevel(Enum):
    FULL = "full"           # All features
    REDUCED = "reduced"     # Fewer features
    MINIMAL = "minimal"     # Core only
    CACHED = "cached"       # Cached responses only
    OFFLINE = "offline"     # Error message

class GracefulDegrader:
    def __init__(self):
        self.current_level = DegradationLevel.FULL
        self.health_checker = HealthChecker()
    
    async def get_response(self, query: str) -> str:
        level = await self.health_checker.get_degradation_level()
        
        if level == DegradationLevel.FULL:
            return await self.full_pipeline(query)
        
        elif level == DegradationLevel.REDUCED:
            # Skip expensive operations
            return await self.reduced_pipeline(query)
        
        elif level == DegradationLevel.MINIMAL:
            # Simpler model, no retrieval
            return await self.minimal_pipeline(query)
        
        elif level == DegradationLevel.CACHED:
            # Only return cached responses
            cached = await self.cache.get_similar(query)
            if cached:
                return cached
            return "I'm experiencing issues. Please try again later."
        
        else:
            return "Service temporarily unavailable."
    
    async def full_pipeline(self, query: str) -> str:
        # RAG + primary model + ensemble verification
        context = await self.retrieve(query)
        response = await self.generate(query, context, model="gpt-6.1-sol")
        verified = await self.verify(response)
        return verified
    
    async def reduced_pipeline(self, query: str) -> str:
        # RAG + smaller model, no verification
        context = await self.retrieve(query)
        return await self.generate(query, context, model="gpt-6-luna")
    
    async def minimal_pipeline(self, query: str) -> str:
        # Direct generation with smallest model, no retrieval
        return await self.generate(query, None, model="gpt-6-luna")
```

---

## 多供应商故障转移

**应跨供应商故障转移，而非只切换同一家供应商的模型。** 故障可能同时影响一家供应商的全部服务。Anthropic 状态记录显示，2026 年 8 月 16 日至 9 月 29 日间至少有 12 次重大或严重事故，多次同时波及 API、Claude Code 和 claude.ai。OpenAI 9 月 29 日的事故使 API（包括 Agents API）、ChatGPT 和 Codex 退化约 5 小时 20 分钟。云厂商也会故障：Google Cloud us-west1 在 8 月 20 日的一次事故影响客户约 2 小时 22 分钟。在同一供应商的模型之间逐级切换，无法应对这些问题。

**故障转移不能直接替换调用。** 回退目标必须能接受请求、承接对话、满足相同数据条款，并且胜任任务：

| 可能失败的方面 | 示例（2026 年 10 月） | 修复方式 |
|-------------|------------------------|-----|
| 请求形式 | Claude Fable 5.1、Opus 5.5 和 Sonnet 5.5 对强制 `tool_choice` 返回 400；GPT-6 Astra 拒绝自定义 `temperature`、`top_p` 和 `logprobs` | 根据目标能力档案转换参数，不能盲目透传 |
| 对话状态 | 最新 Claude 模型的思考块绑定模型和对话 | 在轮次边界故障转移，并发送可见对话记录和工具结果 |
| 数据条款 | Fable 5.1 需要保留 30 天数据，除非获批零数据保留；OpenAI Agents API 测试版不支持零数据保留 | 在模型注册表中保存逐模型的数据保留和驻留条件，并在路由时强制执行 |
| 输出质量 | 从未针对任务评估过回退模型 | 定期在每一条回退路径上运行评估套件 |

[网关章节](../11-infrastructure-and-mlops/03-ai-gateways-and-model-routing.md#回退与可靠性) 介绍路由机制；下方代码展示核心循环。

### 供应商管理器

```python
class ProviderManager:
    def __init__(self):
        self.providers = {
            "primary": OpenAIProvider(),
            "secondary": AnthropicProvider(),
            "tertiary": GoogleProvider()
        }
        self.health = {name: True for name in self.providers}
        self.priority_order = ["primary", "secondary", "tertiary"]
    
    async def generate(self, request: dict) -> str:
        for provider_name in self.priority_order:
            if not self.health[provider_name]:
                continue
            
            provider = self.providers[provider_name]
            
            try:
                result = await provider.generate(request)
                return result
            except RetryableError as e:
                # Mark unhealthy but continue to next provider
                self.health[provider_name] = False
                asyncio.create_task(
                    self._health_check_later(provider_name)
                )
                continue
        
        raise AllProvidersUnavailableError()
    
    async def _health_check_later(self, provider_name: str):
        await asyncio.sleep(30)  # Wait before retrying
        try:
            await self.providers[provider_name].health_check()
            self.health[provider_name] = True
        except:
            # Schedule another check
            asyncio.create_task(self._health_check_later(provider_name))
```

### 请求对冲

```python
class HedgedRequest:
    """
    Start the primary; if it is slow or fails, race the other providers
    against it and keep the first successful response.
    """
    
    def __init__(self, providers: list, hedge_delay: float = 2.0):
        self.providers = providers
        self.hedge_delay = hedge_delay
    
    async def generate(self, request: dict) -> str:
        primary = asyncio.create_task(self.providers[0].generate(request))

        # asyncio.wait, unlike wait_for, does not cancel the primary on timeout
        done, _ = await asyncio.wait({primary}, timeout=self.hedge_delay)
        if primary in done and primary.exception() is None:
            return primary.result()

        # Primary is slow or failed: hedge to the others, keeping a slow primary in the race
        pending = set() if primary in done else {primary}
        pending |= {
            asyncio.create_task(provider.generate(request))
            for provider in self.providers[1:]
        }
        
        try:
            while pending:
                done, pending = await asyncio.wait(
                    pending, return_when=asyncio.FIRST_COMPLETED
                )
                for task in done:
                    if task.exception() is None:
                        return task.result()  # first success wins, not first finisher
            raise AllProvidersFailedError()
        finally:
            for task in pending:
                task.cancel()  # stop paying for the losers
```

仅对幂等请求做对冲（不能包含具有副作用的工具调用），`hedge_delay` 应接近主模型在相应 effort 下的 p95 延迟（流式对冲看首 token 时间），并为额外成本预留预算：失败的一路至少要支付输入 token，通常还会产生更多费用，因为客户端取消并不保证供应商停止生成。

---

## 面试题

### 问：你如何为 LLM 系统设计高可用性？

**标准答案：**

“我会使用多层可靠性设计：

**带退避的重试（Retry with backoff）：** 对瞬时故障使用带抖动的指数退避，并遵守 `Retry-After`。关键是区分可重试（多数限流、过载、超时）和不可重试（认证、错误请求），还要结合错误代码而不只看状态码：消费上限 429 看似限流，实际需要故障转移和人工处理，而非退避。

**熔断器（Circuit breaker）：** 如果某个提供商连续失败，就在一段冷却期内停止重试。这可以避免在一个失效的提供商上浪费延迟，并给它恢复时间。

**多提供商故障转移（Multi-provider failover）：** 不依赖单一供应商。我会跨不同供应商配置主/备/三级自动故障转移，因为一家供应商故障通常会影响它的所有模型。每家都有自己的断路器，且每条回退路径都针对任务做过评估；未经测试的回退是另一场待发生的故障。

**拒绝处理：** 最新 Claude 模型的安全拒绝会以 HTTP 200 和 `stop_reason: "refusal"` 返回，因此我会将其路由到已批准的回退模型，而不把它计为错误或成功。

**优雅降级（Graceful degradation）：** 预先定义当没有可用提供商时会发生什么。与其彻底失败，不如返回一个降级响应（更简单的模型、缓存结果）。

**舱壁隔离（Bulkheading）：** 隔离不同工作负载。批处理流量激增不应拖垮实时查询。

关键洞察是要默认考虑失败。LLM API 比传统 API 更不稳定。设计时应当假设提供商会宕机，因为它确实会。”

### 问：熔断器和重试有什么区别？

**标准答案：**

“它们解决的是不同问题：

**重试（Retry）** 处理瞬时故障。如果单个请求失败，就再试一次。它假设故障彼此独立，下一次尝试可能成功。

**熔断器（Circuit breaker）** 处理系统性故障。如果很多请求都在失败，就彻底停止尝试。它假设下游系统处于不健康状态，反复尝试只会浪费资源并拖慢恢复。

**它们如何协同工作：**
1. 请求失败 → 带退避重试（attempt 1, 2, 3）
2. 如果所有重试都失败 → 熔断器记录一次失败
3. 达到 N 次失败后 → 熔断器打开（open），立即拒绝请求
4. 超时后 → 熔断器半开（half-open），允许少量测试请求
5. 如果测试成功 → 熔断器关闭（close），恢复正常运行

没有熔断器时：在故障期间，每个请求都会先经历全部重试才失败，延迟飙升，资源被耗尽。

有熔断器时：在检测到故障后，请求会快速失败。系统仍能保持响应，并可以切换到替代方案。”

### 问：供应商在模型 ID 不变的情况下发布修复，质量指标随之变化。如何检测和处理静默模型变化？

**标准答案：**

“我假设一个 ID 背后的模型行为可能变化，因为确实如此。GPT-6 Sol 和 Luna 于 2026 年 9 月 22 日发布时存在图像编码缺陷；OpenAI 于 9 月 25 日在 ID 不变的情况下修复，并要求使用图像输入的客户重跑评估。任何在发布首周就按图像或计算机操作评估结果完成迁移的团队，可能测量的是有缺陷的路径。

**检测：**
- 定期针对生产端点运行小型金丝雀评估套件（关键路径可每小时运行），而不只在 CI 中运行。
- 监控廉价信号的分布：输出长度、逐类别拒绝率、工具调用率、Schema 验证失败率，以及流量样本上的评审分数。
- 将供应商更新日志和状态页接入与自身部署相同的告警通道。

**处理：**
- 如果供应商提供日期快照，则固定它，但要知道这只固定了名称，不能固定服务栈。
- 迁移时，在发布后一两周再做第二次评估，并让旧模型保持可用，直到新模型稳定。
- 供应商宣布修复后，重跑受影响的评估子集，与最后一次已知良好的基线比较，再信任任一分数。

原则是：模型行为是一项可能不升版本就变化的依赖，因此要像其他外部服务一样持续验证。”

---

## 参考资料

- Microsoft Resilience Patterns: https://learn.microsoft.com/en-us/azure/architecture/patterns/
- Netflix Hystrix: https://github.com/Netflix/Hystrix
- OpenAI API 更新日志（2026 年 9 月 2 日的 `slow_down` 429 与 503 过载；9 月 25 日 GPT-6 Sol/Luna 图像编码修复）：https://developers.openai.com/api/docs/changelog
- Anthropic，拒绝与回退：https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback
- Anthropic，限流：https://platform.claude.com/docs/en/api/rate-limits
- Anthropic 状态历史：https://status.claude.com/history

---

*上一页: [集成方法](02-ensemble-methods.md) · 下一页: [AI 治理与合规](04-ai-governance-and-compliance.md)*
