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
| 模型版本（包括被迫迁移） | 高 | 全面基准测试（benchmark）+ API 契约测试 |
| RAG 索引 | 中等 | 检索 + 质量评估 |
| 参数（effort、thinking、最大 token 数） | 中等 | 质量与成本抽样 |
| 同一模型 ID 下的供应商侧变更 | 中高 | 针对生产模型 ID 的定期评估 |
| SDK 或框架主版本 | 中等 | 针对实际发出请求的契约测试 |
| 仓库内的智能体、编辑器或 VCS 配置 | 高 | 安全审查；视为可执行代码 |

2026 年使最后四行变得不可省略。智能体与 VCS 配置在[第 5 阶段](#第-5-阶段-供应链与智能体配置门禁)设置独立门禁；另外三项如下：

- **采样参数正在退出。** Claude API 对 Opus 4.7 及以后模型的非默认采样值已返回 400；Anthropic Python SDK 1.0（2026 年 8 月 20 日）从 Messages 方法中移除了 `temperature`、`top_p` 和 `top_k`（传入即抛出 `TypeError`）。Google 于 7 月 21 日在 Gemini API 中将它们标为弃用，GPT-6 Astra 则拒绝自定义 temperature、`top_p` 和 logprobs。“把 temperature 设为 0 以保证 CI 可复现”已不再适用；推理 effort 成为主要控制项，其默认值也会随版本改变（Claude Opus 5.5 默认 `medium`，Opus 5 默认 `high`）。应断言结构化字段并做语义检查，而非比较完全相同的字符串。
- **固定 ID 下的模型也可能变化。** OpenAI 于 2026 年 9 月 25 日修复 `gpt-6-sol` 和 `gpt-6-luna` 的图像编码缺陷，但未更改 ID，因此该日期之前的图像评估不再代表这些端点的当前行为。编码智能体 CLI 也会在小版本中更换默认模型（Codex CLI 在 rust-v0.159.1 改用 GPT-6.1 Sol；Claude Code 在 2.1.280 改用 Opus 5.5）。应定期针对生产环境使用的精确 ID 运行评估套件，而不只在自己的提交后运行。
- **SDK 主版本可能悄然破坏测试工具。** Anthropic SDK 1.0 和 OpenAI SDK 3.0（8 月 12 日）转向 `httpx2`。根据 Anthropic 的迁移指南，除非调用 `httpx2.alias_httpx()`，OpenTelemetry 埋点、`respx` 和 `vcrpy` 可能漏掉调用，使录制响应测试触及真实 API，或在完全没有追踪的情况下依旧通过。

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

保持评估工具的可迁移性。托管评估产品同样会更迭：OpenAI Evals 将于 2026 年 10 月 31 日变为只读，11 月 30 日关闭；OpenAI 推荐 Promptfoo（MIT 许可，OpenAI 于 3 月同意收购）。应在仓库中以工具无关的格式保存数据集、评分器和阈值，使门禁在更换供应商后仍然可用。完整门禁示例见[评估门禁 CI/CD 案例研究](../16-case-studies/18-eval-gated-cicd.md)。

### 第 5 阶段：供应链与智能体配置门禁

AI 仓库如今包含容易在普通代码审查中被忽略的可执行配置，攻击者也会有针对性地利用它们：

| 接触面 | 2026 年事件 | 门禁 |
|---------|---------------|------|
| 智能体和编辑器自动执行配置（`.claude/settings.json` 钩子、`.vscode/tasks.json` 打开文件夹任务） | Mini Shai-Hulud 截至 4 月 30 日已利用这些钩子；8 月 4 日的 ChainDrop npm 蠕虫在 444 个包、2,212 个版本中重用它们（StepSecurity），窃取 OpenAI、Anthropic、Cursor、Codex 和 Gemini token | 对这些路径实施 CODEOWNERS 审查；新增钩子或自动执行任务时让 CI 失败 |
| 仓库 `.git/config`（`core.fsmonitor`、`core.hooksPath`、过滤器） | GitSpawn（Manifold，9 月 2 日）：七种 CLI 编码智能体在后台 git 调用中，于沙箱外执行了攻击者命令 | 智能体发起的 git 调用使用 `-c core.fsmonitor=false`；绝不信任从 clone 之外带来的 `.git` 目录 |
| 以 SHA 固定的智能体插件 | Plugin4Shell（AIR Security，9 月 17 日）：一个名称伪装为固定 SHA 的分支替换了已批准代码；在 Claude Code 2.1.179 和 Codex 0.146.0 修复 | 检出后验证实际文件树与固定版本一致 |
| 上游静默修复的依赖 | Hacktron（9 月 13 日披露）：7 月末，Claude Opus 5 在约 3 小时内把一个已由上游修复、但没有 CVE 的 libheif 溢出变成可用漏洞；结合 SSO 错误配置，获得 OpenAI 社区论坛的远程代码执行权限 | 上游修复发布后即打补丁，不等待 CVE 公告；定期重建基础镜像 |

如今漏洞利用窗口以小时计。Google 于 2026 年 9 月 8 日以 AI 驱动的补丁量为由，将 Chrome 发布周期从 4 周缩短到 2 周。对 CI 的含义是：依赖和基础镜像的新鲜度要有带 SLA 的门禁；智能体配置应按代码同等审查，因为它就是代码。

应明确决定谁能批准这些路径。2026 年 9 月 1 日，GitHub 以公开预览形式允许 Copilot 代码审查的批准计入必需审查（默认关闭），管理员可指定 Copilot 能批准的文件路径。AI 审查可以是额外门禁，但智能体配置、CI 工作流和依赖清单应排除 AI 批准，并要求人工 CODEOWNER，因为这些正是受注入或被攻破的智能体最想修改的文件。[智能体安全章节](../07-agentic-systems/09-agentic-security-and-sandboxing.md)介绍运行时侧的防护。

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

### 模型迁移也是部署

模型变更如今按供应商的日程到来，而非你的日程。Claude Sonnet 4.5 将于 2026 年 11 月 30 日在 Claude API 和 Foundry 退役（Anthropic 建议迁至 Sonnet 5.5）；OpenAI 将于 12 月 11 日退役 `gpt-5-2025-08-07` 和 `o3-2025-04-16` 快照；Bedrock 上的 Claude Sonnet 4 则于 10 月 14 日结束服务。Anthropic 提前 60 天通知。OpenAI 对正式发布模型声称提前 6 个月，对专用变体提前 3 个月，对预览模型可能仅提前 2 周；而 `gpt-5.4-cyber` 上线仅 20 天便于 10 月 1 日退役，因此应按短于公告最小值的窗口规划。

最新模型还会改变 API 契约，迁移可能在质量评估开始前就因请求格式失败：

- Claude Fable 5.1、Opus 5.5 和 Sonnet 5.5 对 `tool_choice` 的 `any` 或 `tool` 值返回 400；应使用 `auto` 加严格工具或结构化输出。
- Opus 5.5 的思考无法关闭；Sonnet 5.5 上的 `thinking: {"type": "disabled"}` 返回 400（最低设置为 `between_tools`）。
- 思考块绑定模型和对话：其他模型无法读取的块会被静默丢弃；对于 2026 年 8 月 31 日及之后创建的账户，在思考块前编辑历史会返回 400。旧模型录制的对话记录不能直接作为新模型的有效测试。
- GPT-6 Astra 不支持 temperature、`top_p` 和 logprobs，工具调用需要 Responses API。

应像代码部署一样对待模型升级：在新 ID 上运行完整评估套件，对客户端实际发送的请求做契约测试，使用生产流量进行影子测试，然后以常规回滚触发条件做金丝雀发布。在旧模型退役前保留它作为回滚目标，并将退役日期写入部署日历。

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

### 问：供应商将在 60 天后退役产品正在使用的模型。如何安全迁移？

**标准答案：**

“我把它当成有硬期限的计划部署，分四步进行。

**1. 先核对契约。** 测质量之前先检查请求仍能成功。最新 Claude 模型（Fable 5.1、Opus 5.5、Sonnet 5.5）拒绝强制 `tool_choice`，Sonnet 5.5 拒绝 `thinking: disabled`，GPT-6 Astra 拒绝 temperature。我对客户端实际发出的请求运行契约测试，并调整请求格式（以严格工具或结构化输出替代强制工具调用，以 effort 替代 temperature）。

**2. 在新 ID 上评估。** 运行完整黄金集和抽样的 LLM 裁决评估，记录成本与延迟，因为默认 effort 和思考行为随版本变化，影响账单的程度可能与质量一样大。我不把旧模型生成的对话记录复用为多轮测试样例，因为新版 Claude 模型会丢弃或拒绝其他模型的思考块。

**3. 影子测试，然后金丝雀发布。** 对真实流量做影子测试，观察差异，再按常规回滚触发条件进行金丝雀发布。旧模型在退役日期前保持为回滚目标。

**4. 修复流程。** 在按模型和平台索引的登记表中记录退役日期，因为同一模型在不同云平台的退役时间可能相差数月；定期针对生产模型 ID 运行评估，以便发现供应商侧的静默变更。

若流水线已建好，60 天足够；若迁移期间还要从零搭建评估套件，就不够。”

---

## 参考资料

- ML Ops: https://ml-ops.org/
- LangSmith: https://docs.smith.langchain.com/
- Promptfoo: https://www.promptfoo.dev/
- OpenAI 弃用公告：https://developers.openai.com/api/docs/deprecations
- Anthropic 模型弃用公告：https://platform.claude.com/docs/en/about-claude/model-deprecations
- StepSecurity，ChainDrop npm 蠕虫：https://www.stepsecurity.io/blog/chaindrop-npm-worm
- AIR Security，Plugin4Shell：https://www.air.security/blog-posts/plugin4shell

---

*Previous: [LLM Infrastructure](01-llm-infrastructure.md) · Next: [AI Gateways and Model Routing](03-ai-gateways-and-model-routing.md)*
