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
| 限流 | 超出配额 | 请求被拒绝 |
| 超时 | 生成时间过长、网络问题 | 响应缓慢或失败 |
| 供应商故障 | 基础设施问题 | 完全失败 |
| 质量下降 | 模型更新、负载 | 输出更差 |
| 上下文溢出 | 输入过大 | 请求失败 |
| 格式错误输出 | 生成错误 | 解析失败 |

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

```python
class LLMRetryPolicy:
    RETRYABLE = [
        RateLimitError,
        TimeoutError,
        ServiceUnavailableError,
        ConnectionError
    ]
    
    NOT_RETRYABLE = [
        AuthenticationError,
        InvalidRequestError,
        ContentPolicyViolation,
        ContextLengthExceeded
    ]
    
    @classmethod
    def should_retry(cls, error: Exception) -> bool:
        for retryable_type in cls.RETRYABLE:
            if isinstance(error, retryable_type):
                return True
        return False
    
    @classmethod
    def get_retry_after(cls, error: Exception) -> float | None:
        # Some rate limit errors include retry-after header
        if hasattr(error, "retry_after"):
            return error.retry_after
        return None
```

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
                return True
            return False
        
        if self.state == CircuitState.HALF_OPEN:
            # Allow limited calls in half-open state
            return self.half_open_calls < self.config.half_open_max_calls
        
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
        read_timeout: float = 30.0,
        total_timeout: float = 60.0
    ):
        self.connection_timeout = connection_timeout
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
        # RAG + frontier model + ensemble verification
        context = await self.retrieve(query)
        response = await self.generate(query, context, model="gpt-4o")
        verified = await self.verify(response)
        return verified
    
    async def reduced_pipeline(self, query: str) -> str:
        # RAG + smaller model, no verification
        context = await self.retrieve(query)
        return await self.generate(query, context, model="gpt-4o-mini")
    
    async def minimal_pipeline(self, query: str) -> str:
        # Direct generation with smallest model
        return await self.generate(query, None, model="gpt-4o-mini")
```

---

## 多供应商故障转移

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
    Send parallel requests to multiple providers, use first response.
    """
    
    def __init__(self, providers: list, hedge_delay: float = 2.0):
        self.providers = providers
        self.hedge_delay = hedge_delay
    
    async def generate(self, request: dict) -> str:
        # Start primary request
        tasks = [asyncio.create_task(self.providers[0].generate(request))]
        
        try:
            # Wait for primary with hedge delay
            result = await asyncio.wait_for(tasks[0], timeout=self.hedge_delay)
            return result
        except asyncio.TimeoutError:
            # Primary slow, start hedged requests
            for provider in self.providers[1:]:
                tasks.append(asyncio.create_task(provider.generate(request)))
            
            # Return first successful result
            done, pending = await asyncio.wait(
                tasks,
                return_when=asyncio.FIRST_COMPLETED
            )
            
            # Cancel pending
            for task in pending:
                task.cancel()
            
            # Get result from completed task
            for task in done:
                if task.exception() is None:
                    return task.result()
            
            # All failed
            raise AllProvidersFailedError()
```

---

## 面试题

### 问：你如何为 LLM 系统设计高可用性？

**标准答案：**

“我会使用多层可靠性设计：

**带退避的重试（Retry with backoff）：** 对瞬时故障使用带抖动（jitter）的指数退避（exponential backoff）。关键是区分可重试（retryable，如速率限制、超时）和不可重试（non-retryable，如认证错误、错误请求）错误。

**熔断器（Circuit breaker）：** 如果某个提供商连续失败，就在一段冷却期内停止重试。这可以避免在一个失效的提供商上浪费延迟，并给它恢复时间。

**多提供商故障转移（Multi-provider failover）：** 永远不要依赖单一提供商。我会配置主/备/三级（primary/secondary/tertiary）并启用自动故障转移。每个提供商都有自己的熔断器。

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

---

## 参考资料

- Microsoft Resilience Patterns: https://learn.microsoft.com/en-us/azure/architecture/patterns/
- Netflix Hystrix: https://github.com/Netflix/Hystrix

---

*上一页: [集成方法](02-ensemble-methods.md) · 下一页: [AI 治理与合规](04-ai-governance-and-compliance.md)*
