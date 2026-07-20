# 大语言模型应用的 CI/CD（持续集成/持续交付）

部署 LLM（Large Language Model，大型语言模型）应用需要将传统的 CI/CD 实践调整为适配 AI 特有问题，例如模型评估、提示词测试和质量门禁（Quality Gates）。

## 目录

- [LLM CI/CD Challenges](#llm-ci-cd-的挑战)
- [Pipeline Architecture](#流水线架构)
- [Testing Stages](#测试阶段)
- [Quality Gates](#质量门禁)
- [Deployment Strategies](#部署策略)
- [Rollback Procedures](#回滚流程)
- [Interview Questions](#面试题)
- [References](#参考资料)

---

## LLM CI/CD 的挑战

### LLM 部署有何不同

| 传统 CI/CD | LLM CI/CD |
|-------------------|-----------|
| 二元测试（通过/失败） | 概率性评估 |
| 快速测试 | 缓慢且昂贵的评估 |
| 确定性输出 | 非确定性输出 |
| 仅代码变更 | 提示词 + 模型 + 数据变更 |
| 版本控制显而易见 | 提示词版本管理复杂 |

### 变更类型

| 变更类型 | 风险 | 所需测试 |
|-------------|------|------------------|
| 提示词文本 | 中等 | 回归测试 + 质量评估 |
| 系统提示词 | 高 | 全量评估套件 |
| 模型版本 | 高 | 全面基准测试（benchmark） |
| RAG 索引 | 中等 | 检索 + 质量评估 |
| 参数（temperature 等） | 低-中 | 质量抽样 |

---

## 流水线架构

### 完整流水线

```
┌─────────────────────────────────────────────────────────────────┐
│                       LLM CI/CD PIPELINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                                               │
│  │   Commit     │                                               │
│  │   Trigger    │                                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │   Validate   │ ─── Prompt syntax, config validation         │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │ Unit Tests   │ ─── Fast, deterministic tests                │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │  Golden Set  │ ─── Known input/output pairs                 │
│  │    Tests     │                                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │   LLM Eval   │ ─── Quality scoring, regression detection    │
│  │   (Sampled)  │                                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │ Quality Gate │ ─── Pass/fail based on thresholds            │
│  └──────┬───────┘                                               │
│         │                                                        │
│    ┌────┴────┐                                                  │
│    ▼         ▼                                                  │
│ ┌──────┐ ┌───────┐                                             │
│ │Canary│ │Blocked│                                             │
│ │Deploy│ │       │                                             │
│ └──┬───┘ └───────┘                                             │
│    │                                                            │
│    ▼                                                            │
│ ┌──────────────┐                                               │
│ │  Production  │                                               │
│ │  Monitoring  │                                               │
│ └──────────────┘                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 测试阶段

### 第 1 阶段：静态验证

```python
class PromptValidator:
    def validate(self, prompt_config: dict) -> ValidationResult:
        errors = []
        
        # Required fields
        if not prompt_config.get("system_prompt"):
            errors.append("Missing system_prompt")
        
        # Template syntax
        try:
            Template(prompt_config["user_template"]).substitute({})
        except KeyError:
            pass  # Expected for templates with variables
        except ValueError as e:
            errors.append(f"Invalid template syntax: {e}")
        
        # Token limits
        system_tokens = count_tokens(prompt_config.get("system_prompt", ""))
        if system_tokens > 4000:
            errors.append(f"System prompt too long: {system_tokens} tokens")
        
        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors
        )
```

### 第 2 阶段：单元测试

```python
class PromptUnitTests:
    def test_template_rendering(self):
        prompt = PromptTemplate(SYSTEM_PROMPT, USER_TEMPLATE)
        
        rendered = prompt.render(
            query="test query",
            context="test context"
        )
        
        assert "test query" in rendered
        assert "test context" in rendered
        assert len(rendered) < 10000  # Token limit
    
    def test_output_parsing(self):
        parser = OutputParser()
        
        valid_output = '{"answer": "test", "confidence": 0.9}'
        result = parser.parse(valid_output)
        assert result["answer"] == "test"
        
        invalid_output = "not json"
        with pytest.raises(ParseError):
            parser.parse(invalid_output)
```

### 第 3 阶段：黄金集测试

```python
class GoldenSetRunner:
    def __init__(self, golden_set: list[dict]):
        self.golden_set = golden_set
    
    async def run(self, llm_client) -> TestResults:
        results = []
        
        for example in self.golden_set:
            response = await llm_client.generate(example["input"])
            
            # Exact match for deterministic outputs
            if example.get("exact_match"):
                passed = response == example["expected"]
            # Contains check for flexible outputs
            elif example.get("must_contain"):
                passed = all(
                    phrase in response 
                    for phrase in example["must_contain"]
                )
            # LLM judge for quality
            else:
                passed = await self.judge_quality(
                    response, example["expected"]
                )
            
            results.append(TestResult(
                input=example["input"],
                expected=example["expected"],
                actual=response,
                passed=passed
            ))
        
        return TestResults(
            total=len(results),
            passed=sum(1 for r in results if r.passed),
            failed=[r for r in results if not r.passed]
        )
```

### 第 4 阶段：LLM 评估

```python
class LLMEvaluationStage:
    def __init__(self, eval_set: list[dict], sample_rate: float = 0.1):
        self.eval_set = eval_set
        self.sample_rate = sample_rate
        self.evaluator = LLMEvaluator()
    
    async def run(self, llm_client) -> EvalResults:
        # Sample for cost efficiency
        sample = random.sample(
            self.eval_set,
            int(len(self.eval_set) * self.sample_rate)
        )
        
        scores = []
        for example in sample:
            response = await llm_client.generate(example["input"])
            
            score = await self.evaluator.evaluate(
                query=example["input"],
                response=response,
                reference=example.get("reference"),
                criteria=["relevance", "accuracy", "helpfulness"]
            )
            scores.append(score)
        
        return EvalResults(
            sample_size=len(sample),
            avg_relevance=np.mean([s["relevance"] for s in scores]),
            avg_accuracy=np.mean([s["accuracy"] for s in scores]),
            avg_helpfulness=np.mean([s["helpfulness"] for s in scores])
        )
```

---

## 质量门禁

### 门禁配置

```python
class QualityGate:
    def __init__(self, thresholds: dict):
        self.thresholds = thresholds
    
    def evaluate(self, results: dict) -> GateResult:
        failures = []
        
        # Golden set pass rate
        if results["golden_pass_rate"] < self.thresholds["golden_pass_rate"]:
            failures.append({
                "metric": "golden_pass_rate",
                "actual": results["golden_pass_rate"],
                "threshold": self.thresholds["golden_pass_rate"]
            })
        
        # Quality scores
        for metric in ["relevance", "accuracy", "helpfulness"]:
            if results.get(f"avg_{metric}", 0) < self.thresholds.get(metric, 0):
                failures.append({
                    "metric": metric,
                    "actual": results.get(f"avg_{metric}"),
                    "threshold": self.thresholds[metric]
                })
        
        # Regression detection
        if results.get("regression_detected"):
            failures.append({
                "metric": "regression",
                "details": results["regression_details"]
            })
        
        return GateResult(
            passed=len(failures) == 0,
            failures=failures
        )

# Example thresholds
QUALITY_THRESHOLDS = {
    "golden_pass_rate": 0.95,  # 95% of golden tests must pass
    "relevance": 4.0,          # Average score >= 4.0/5.0
    "accuracy": 4.0,
    "helpfulness": 3.5
}
```

---

## 部署策略

### 金丝雀部署

```python
class CanaryDeployer:
    def __init__(
        self,
        initial_percentage: int = 5,
        increment: int = 10,
        bake_time_minutes: int = 30
    ):
        self.initial_percentage = initial_percentage
        self.increment = increment
        self.bake_time = bake_time_minutes
    
    async def deploy(self, new_version: str):
        # Start canary
        await self.router.set_canary(new_version, self.initial_percentage)
        
        percentage = self.initial_percentage
        while percentage < 100:
            # Wait for bake time
            await asyncio.sleep(self.bake_time * 60)
            
            # Check canary health
            metrics = await self.get_canary_metrics(new_version)
            
            if not self.is_healthy(metrics):
                await self.rollback(new_version)
                raise CanaryFailedError(metrics)
            
            # Increment traffic
            percentage = min(100, percentage + self.increment)
            await self.router.set_canary(new_version, percentage)
        
        # Full rollout
        await self.router.promote_canary(new_version)
```

### 影子部署

```python
class ShadowDeployer:
    async def shadow_test(
        self,
        new_version: str,
        duration_hours: int = 24
    ):
        # Run new version in shadow mode
        await self.enable_shadow(new_version)
        
        # Collect comparison data
        start = datetime.now()
        while datetime.now() - start < timedelta(hours=duration_hours):
            await asyncio.sleep(60)
            
            comparison = await self.compare_outputs()
            if comparison["divergence_rate"] > 0.1:
                await self.alert("High divergence in shadow test", comparison)
        
        # Analyze results
        return await self.generate_comparison_report(new_version)
```

---

## 回滚流程

### 自动回滚

```python
class AutoRollback:
    def __init__(self, rollback_thresholds: dict):
        self.thresholds = rollback_thresholds
    
    async def monitor_and_rollback(self, version: str):
        while True:
            metrics = await self.get_live_metrics(version)
            
            # Check error rate
            if metrics["error_rate"] > self.thresholds["error_rate"]:
                await self.trigger_rollback(version, "error_rate_exceeded")
                return
            
            # Check latency
            if metrics["p99_latency"] > self.thresholds["p99_latency"]:
                await self.trigger_rollback(version, "latency_exceeded")
                return
            
            # Check quality (sampled)
            if metrics.get("quality_score", 5) < self.thresholds["quality_score"]:
                await self.trigger_rollback(version, "quality_degradation")
                return
            
            await asyncio.sleep(60)
    
    async def trigger_rollback(self, version: str, reason: str):
        previous = await self.get_previous_version()
        await self.router.rollback_to(previous)
        await self.alert(f"Auto-rollback from {version}: {reason}")
```

---

## 面试题

### 问：你如何在生产前测试提示词变更？

**有力回答：**

“我会使用一个多阶段测试流水线：

**第 1 阶段：静态验证。** 语法检查、token 限制、模板错误。快速且便宜。

**第 2 阶段：单元测试。** 模板渲染、输出解析、确定性行为。仍然快速。

**第 3 阶段：黄金集测试。** 必须通过的已知输入/输出对。可捕获明显回归。

**第 4 阶段：LLM 评估。** 使用 LLM-as-judge 进行抽样评估。衡量质量维度（相关性、准确性）。更昂贵，但可捕获细微问题。

**质量门禁：** 所有阶段都必须通过阈值。黄金集通过率 > 95%，质量分数 > 4.0/5.0。

**部署：** 以 5% 流量进行金丝雀部署，烘烤（bake）30 分钟，监控指标，逐步增加流量。

关键洞察是 LLM 输出是非确定性的，因此测试必须是统计性的。我不能保证 100% 正确，但可以确保质量维持在可接受范围内。”

### 问：哪些触发器应当导致自动回滚？

**有力回答：**

“我会配置多个回滚触发器：

**错误率：** 如果错误率在连续 5 分钟内超过 5%，则回滚。这可以捕获直接故障。

**延迟：** 如果 P99 延迟在 10 分钟内超过 SLA（例如 10 秒），则回滚。这可以捕获性能回归。

**质量分数：** 如果抽样质量分数低于 3.5/5.0，则回滚。这可以捕获细微的质量下降。

**用户信号：** 如果负面反馈率相对基线激增 2 倍，则调查并可能回滚。

**实施：**
- Prometheus 告警触发回滚脚本
- 自动通知团队
- 回滚到上一个已知良好版本（last known good version）
- 在调查完成前阻止进一步部署

关键是快速检测和快速行动。生产环境中的坏提示词运行 10 分钟是可接受的，运行 10 小时则不行。”

---

## 参考资料

- ML Ops: https://ml-ops.org/
- LangSmith: https://docs.smith.langchain.com/

---

*Previous: [LLM Infrastructure](01-llm-infrastructure.md) · Next: [AI Gateways and Model Routing](03-ai-gateways-and-model-routing.md)*
