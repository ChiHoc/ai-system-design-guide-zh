# 能力评估（Capability Assessment）

本章介绍如何为你的特定 use case（使用场景）评估和比较模型能力。通用 benchmark（基准评测）很少能讲完整故事；本指南帮助你进行有意义的评估。

## 目录（Table of Contents）

- [为什么仅靠基准评测不够](#为什么仅靠基准评测不够)
- [如何阅读供应商基准测试表](#供应商基准表解读-2026-年-10-月)
- [评估维度](#评估维度)
- [推理校准与效率](#推理校准)
- [内部基于 Elo 的评估](#内部基于-elo-的评估)
- [构建自定义评估](#构建自定义评估)
- [常见评估陷阱](#常见评估陷阱)
- [实用评估流程](#实用评估流程)
- [模型 A/B 测试](#模型-a-b-测试)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 为什么仅靠基准评测不够

### 基准问题

公开 benchmark（基准评测）从已饱和的 MMLU、HumanEval、GPQA Diamond，到当前的智能体评测套件 SWE-Bench Pro、Terminal-Bench 4.0、OSWorld 2.0，都存在局限性：

| 问题 | 影响 |
|-------|--------|
| 训练数据污染（Training data contamination） | 模型可能见过测试题。SWE-Bench Pro v2 的公开划分得分为 99.4%（Claude Opus 5），而其私有的 272 个任务集得分为 81.6%；Scale 将大部分差距归因于训练暴露 |
| 非凭实力的通过（Unearned passes） | 智能体找到答案而非解决任务。对 SWE-Bench Pro v1.0 的审计发现，24%（Opus 4.7）至 73%（Fable 5）的通过并非凭实力取得，主要是通过 git 历史中的参考解法（arXiv 2609.34262） |
| Harness 依赖性 | 同一模型、同一测试集：GPT-6 Astra 在 ARC Prize 的供应商中立 harness 上 ARC-AGI-3 得分为 62.7%，而在保留请求间推理状态的 OpenAI adapter 上为 99.9% |
| 指标选择 | OSWorld 2.0 的主要指标是二元任务完成率，但发布文章引用部分得分。在官方排行榜 v2.1 全量集上，Opus 5（max）同一次运行的二元得分为 44.33%，部分得分为 77.67% |
| 安全兜底 | Claude Opus 5.5 在开启安全防护时进行了评测；防护介入时由 Opus 4.8 或 Opus 5 完成任务。Artificial Analysis 将这些条目标为“with fallback” |
| 任务错配（Task mismatch） | benchmark（基准评测）可能不反映你的 use case（使用场景） |
| 构念效度弱 | 被赋予相同概念的 benchmark（基准评测）彼此间的相关性，与其和无关 benchmark（基准评测）的相关性几乎一样强（53 个模型上的 56 项基准评测，arXiv 2609.08812） |
| 聚合得分掩盖方差（Aggregate scores hide variance） | 模型 A 总体上可能优于 B，但在你的领域却落后 |
| 规避评测（Gaming） | 模型为了优化 benchmark（基准评测）而非真实任务 |
| 饱和（Saturation） | benchmark（基准评测）更新滞后于模型能力：前沿模型在 GPQA Diamond 上的得分已接近 96% |

### 基准评测能告诉你什么

```
Benchmark results tell you: "Model X scored 58% on Terminal-Bench 4.0"

What you need to know: "Will Model X, at the effort level I can afford,
in my harness, finish my team's real tasks without supervision?"
```

**经验法则（Rule of thumb）:** 先用 benchmark（基准评测）做初筛，再进行你自己的评估。

### 供应商基准表解读（2026 年 10 月）

任何分数都需要六个标签才有意义：**基准版本、harness、努力级别、执行者（排行榜或供应商）、兜底状态和指标**。当两个分数接近时，还应加入**每任务成本**。2026 年 9 月的发布说明了原因：

| 你会看到的说法 | 实际测量内容 |
|--------------------|----------------------------|
| “Opus 5.5 在 Terminal-Bench 4.0 上得分 66.4%” | Anthropic 以 xhigh 努力级别自行运行的结果（供应商报告，SE ±2.6）。tbench.ai 排行榜 9 月 21 日的更新早于 Opus 5.5；其最高条目是 GPT-6 Astra，为 58.18%（max） |
| Terminal-Bench 4.0 上 “Astra 57.9%” 对比 “Astra 58.2%” | OpenAI 的数字采用 high 努力级别；58.18% 是排行榜采用 max 努力级别的运行结果 |
| “Fable 5.1 55.8%” 对比 “Fable 5.1 57.9%” | Anthropic 自行运行的结果，对比排行榜 max 努力级别条目（57.88%）；xAI 在其 Grok 4.7 表格中引用了后者 |
| “GPT-6 Astra 在 ARC-AGI-3 上得分 99.9%” | ARC Prize 的 Provider Adapter harness、high 努力级别，成本为 $18,817。其 Standard harness 在 max 努力级别得分为 62.7%，成本为 $26,098 |
| “Opus 5.5 在 OSWorld 2.1 上得分 81.8%” | 部分得分指标、供应商运行。在官方排行榜的 v2.1 全量集（9 月 17 日）上，Opus 5 在 max 努力级别的二元得分为 44.33%、部分得分为 77.67%；该更新早于 Opus 5.5 |
| 使用工具的 HLE：Astra 领先，还是 Opus 5.5 领先？ | 都是。HLE-Diamond（1,000 道清洗后的题目）中：Astra 为 82.9%、Opus 5.5 为 73.9%。Anthropic 的完整 HLE 表中：Opus 5.5 为 67.7%、Astra 为 57.2%。数据集与执行者改变了排序 |
| “三个模型在 DeepSWE v1.1 上并列 74%” | 相同通过率下，每任务成本分别为 $2.36（Gemini 3.8 Flash，high）、$4.43（GPT-6 Astra，xhigh）和 $11.84（Claude Opus 5，max） |
| “Opus 5.5 以 58 分领跑 AA Intelligence Index” | Index v4.3.2、max 努力级别、带安全防护兜底。v4.3（9 月 7 日发布）之前的分数采用不同量表，不能比较 |

由此得出的规则是：**只有相同 harness、相同努力级别、相同执行者的数字才可比较。** 供应商数字是对其最佳配置的声明，不是对你的配置的预测。[基准评测章节](../14-evaluation-and-observability/03-benchmarks-and-leaderboards.md#harness-与脚手架方差)会更深入地介绍 harness 差异。

---

## 评估维度

### 维度 1：任务表现

| 任务类型 | 评估方法 | 关键指标 |
|-----------|----------|----------|
| **自主编码（Autonomous Coding）** | SWE-Bench Pro v2（私有集）、DeepSWE v1.1、Terminal-Bench 4.0，然后是你自己的仓库 | 已解决任务百分比、每个已解决任务的成本 |
| **长程规划（Long-Horizon Planning）** | 智能体循环测试（tau3-bench v1.0.1、Agents' Last Exam） | 10+ 步计划的成功率 |
| **计算机使用（Computer Use）** | OSWorld 2.0 | 优先看二元完成率，其次看部分得分 |
| **推理深度（Reasoning Depth）** | 努力级别扫描（low 至 max） | 各努力级别下的准确率和 token 数 |
| **长上下文 RAG** | 最高 1M token 的多针检索与推理召回（MRCR、AA-LCR） | 深度位置的召回与跨文档推理 |
| **原生多模态（Native Multimodal）** | Interleaved Vision/Voice/Text | 跨模态同步准确率 |

### 维度 2：智能体能力

模型在工具使用和遵循多步指令方面表现如何？

```python
def evaluate_agentic_flow(agent, task_environment):
    """
    Measure success on 'Autonomous Agent' tasks:
    1. Plan generation
    2. Tool selection accuracy
    3. Error recovery
    4. Feedback loop utilization
    """
    results = []
    for scenario in task_environment.scenarios:
        traj = agent.run(scenario.goal)
        results.append({
            "success": traj.reached_goal,
            "steps": len(traj.steps),
            "tool_errors": traj.count_invalid_tool_calls()
        })
    return aggregate(results)
```

### 维度 3：推理可靠性

Thinking 不再是开关，而是一个调节旋钮。Claude Opus 5.5 无法关闭 thinking，Sonnet 5.5 的最低设置是 `between_tools`，GPT-6 Astra 没有 `none` 努力级别。问题在于你的任务需要哪一种**努力级别**：

| 努力级别（示例） | 准确率（数学） | 准确率（代码） | 平均延迟 | 输出 Token 数 |
|-----------------------|-----------------|-----------------|-------------|-----------------|
| **Low** | 78% | 74% | 2.1s | 600 |
| **Medium** | 88% | 84% | 5.8s | 1,500 |
| **High** | 93% | 88% | 12.5s | 2,800 |
| **Max** | 94% | 89% | 31s | 7,000 |

默认值会在你未注意时变化：Opus 5.5 默认使用 `medium`，而 Opus 5 使用 `high`；GPT-6.1 Sol 默认使用 `medium`；Sonnet 5.5 在 API 中默认 `high`，但在 Claude Code 中默认 medium。请在评估和生产环境中都显式固定努力级别。max 努力级别的评估无法预测 medium 努力级别的部署表现。

### 推理校准

**“过度思考”问题：**  
模型常会在一个只需 10 个 token 就能回答的问题上消耗 2000+ 个“thinking” token（例如：“What is 2+2?”）。

**高层级细节：**  
基于 **Logic Efficiency（逻辑效率）** 评估模型：`Accuracy / (Inference Tokens)`。  
生产系统使用 **Model Arbitration（模型仲裁）**：一个小型、低成本模型（GPT-6 Luna、低 thinking 的 Gemini 3.8 Flash、Claude Haiku 4.5）对查询分类，并为主调用选择努力级别或模型。在无法关闭 thinking 的模型上，仲裁器的职责是选择 `low` 还是 `high`，这仍能避免简单查询产生 10 倍延迟和成本惩罚。

不要只衡量准确率，也要衡量**每任务 token 数**。模型在此处可相差数倍：Artificial Analysis 测得 GPT-6 Astra 在每个编码任务中使用的 token 约为 GPT-5.6 Sol 的三分之一；而 Muse Spark 1.3 比 1.2 更冗长，因此即使其每 token 价格未变，每任务成本仍然上升。

### 维度 4：上下文召回

如今 1M token 窗口已成为标准配置（Claude 4.6 及以后版本、GPT-6 为 1.05M、Gemini 3.8 Flash 为 1,048,576），简单的“needle-in-a-haystack”已经不够。我们现在评估窗口内的 **Contextual Reasoning（上下文推理）**。

| 指标 | 测量方式 | 目标 |
|--------|-------------|--------|
| **Window Recall（窗口召回）** | 在 90% 窗口深度下的事实召回率 | > 98% |
| **Cross-Doc Reasoning（跨文档推理）** | 将 Doc A（pos 10k）与 Doc B（pos 900k）逻辑关联 | > 90% |
| **Contextual Noise Resistance（上下文抗噪性）** | 当窗口中 90% 为无关“填充”时的准确率 | > 95% |
| **Long-Output Coherence（长输出连贯性）** | 在生成的 64K-128K token 间保持一致性（Claude 5.x 和 GPT-6 模型当前输出上限为 128K，Gemini 3.8 Flash 为 65,536；Google 表示已宣布的 Gemini 4 Argon 将上限提升到 1M） | 因任务而定 |

记录召回率时也要记录成本。在 OpenAI 模型上，超过 272K token 的提示会按长上下文费率计费整个请求，因此一个在 800K 处召回良好的模型，价格上仍可能输给 RAG。输出也是如此：1M token 的输出上限可让单次调用替代分块生成循环，但前提是你已测量该长度下的连贯性和成本。

---

## 内部基于 Elo 的评估

**超越静态评分量表。**  
Rubrics（评分量表，1-5 分制）容易出现“judge fatigue（评审疲劳）”和“score drifting（评分漂移）”。现代系统在内部黄金集上使用 **Pairwise Elo（成对 Elo）**。

**工作流：**
1. **盲测并排：** Model A 和 Model B 对同一查询生成答案。
2. **裁判：** 一个强模型（Claude Opus 5.5、GPT-6 Astra 或人类）选出胜者。将每一对答案交换位置后再运行一次；大多数前沿裁判模型已无法固定 temperature，因此应测量裁判方差，而非假设它不存在。
3. **Elo 更新：** 更新内部排行榜。

```python
def update_elo(winner_elo, loser_elo, k=32):
    expected_winner = 1 / (1 + 10 ** ((loser_elo - winner_elo) / 400))
    new_winner_elo = winner_elo + k * (1 - expected_winner)
    new_loser_elo = loser_elo + k * (0 - (1 - expected_winner))
    return new_winner_elo, new_loser_elo
```

**为何有效：** 它提供的是**相对**排名，对评审者个性变化或模型版本迭代更稳健。

**裁判成本如今是一项设计选择。** 返回校准分数而非文本的决策模型裁判（TypeSafe 的 Jev）比 LLM 评分量表裁判便宜 16 至 325 倍，且在 27 个配对比较中，准确率显著不同的至多只有 8 个（arXiv 2609.29769）。但对于决策模型最自信的错误，约 96% 的 LLM 裁决重复了同一个错误答案，而裁判级联最多只提升 2.7 分。廉价裁判适用于二元检查清单标准；来自同一模型家族的第二个裁判无法带来独立性。

---

## 构建自定义评估

### 第 1 步：定义评估标准

```python
evaluation_criteria = {
    "correctness": {
        "weight": 0.4,
        "description": "Is the answer factually correct?",
        "scale": [1, 2, 3, 4, 5],
        "rubric": {
            5: "Completely correct, no errors",
            4: "Mostly correct, minor issues",
            3: "Partially correct, some errors",
            2: "Mostly incorrect",
            1: "Completely wrong or nonsensical"
        }
    },
    "relevance": {
        "weight": 0.3,
        "description": "Does the answer address the question?",
        "scale": [1, 2, 3, 4, 5]
    },
    "completeness": {
        "weight": 0.2,
        "description": "Are all parts of the question addressed?",
        "scale": [1, 2, 3, 4, 5]
    },
    "conciseness": {
        "weight": 0.1,
        "description": "Is the answer appropriately concise?",
        "scale": [1, 2, 3, 4, 5]
    }
}
```

### 第 2 步：创建测试集

```python
test_set = [
    {
        "id": "q001",
        "query": "What is the refund policy for subscription cancellation?",
        "context": "[relevant documentation]",
        "ground_truth": "Full refund within 30 days, prorated after",
        "difficulty": "easy",
        "category": "policy"
    },
    {
        "id": "q002",
        "query": "How do I integrate the API with a Python async application?",
        "context": "[API documentation]",
        "ground_truth": "[expected code pattern]",
        "difficulty": "medium",
        "category": "technical"
    },
    # ... 50-100+ test cases
]
```

**测试集指南：**
- 覆盖所有主要 use case（使用场景）
- 包含 easy、medium、hard 示例
- 在各类别之间保持平衡
- 包含边缘案例（edge cases）
- 提供清晰的 ground truth answers（真实标准答案）
- 尽可能从真实生产流量中抽取，以免它看起来像一套测试

### 第 3 步：实现评估

```python
class ModelEvaluator:
    def __init__(self, models: list[str], test_set: list[dict]):
        self.models = models
        self.test_set = test_set
        self.results = {}
    
    def evaluate_all(self):
        for model in self.models:
            self.results[model] = self.evaluate_model(model)
        return self.results
    
    def evaluate_model(self, model: str) -> dict:
        scores = []
        latencies = []
        
        for case in self.test_set:
            start = time.time()
            response = self.generate(model, case)
            latency = time.time() - start
            latencies.append(latency)
            
            # Score using LLM judge or human
            score = self.score_response(case, response)
            scores.append(score)
        
        return {
            "mean_score": mean(scores),
            "score_by_category": self.group_by_category(scores),
            "p50_latency": percentile(latencies, 50),
            "p99_latency": percentile(latencies, 99)
        }
    
    def score_response(self, case: dict, response: str) -> float:
        # Option 1: LLM-as-judge
        return self.llm_judge(case, response)
        
        # Option 2: Exact match
        # return exact_match(response, case["ground_truth"])
        
        # Option 3: Semantic similarity
        # return cosine_sim(embed(response), embed(case["ground_truth"]))
```

### 第 4 步：LLM-as-Judge（大模型作为裁判）

```python
def llm_judge(case: dict, response: str) -> dict:
    prompt = f"""Evaluate this response to a customer query.

Query: {case['query']}
Expected Answer: {case['ground_truth']}
Model Response: {response}

Rate the response on these criteria (1-5 scale):
1. Correctness: Is it factually accurate?
2. Relevance: Does it answer the question?
3. Completeness: Are all aspects covered?
4. Conciseness: Is it appropriately brief?

Output JSON:
{{"correctness": X, "relevance": X, "completeness": X, "conciseness": X, "reasoning": "..."}}
"""
    
    result = judge_model.generate(prompt)
    return parse_json(result)
```

---

## 常见评估陷阱

### 陷阱 1：测试集太小

**问题：** 20 个测试用例不足以进行可靠比较。

**解决：** 目标是 100+ 个用例，并按难度与类别分层。

### 陷阱 2：Ground Truth 含糊

**问题：** “合理”的答案被判为错误。

```
Query: "What is the capital of Australia?"
Ground truth: "Canberra"
Model answer: "The capital of Australia is Canberra."
Exact match: FAIL (but clearly correct)
```

**解决：** 使用语义匹配或 LLM-as-Judge，而不是精确匹配。

### 陷阱 3：评估集泄露

**问题：** 用同一批案例做开发与评估。

**解决：** 保留一组你从不用于 prompt tuning（提示词调优）的留出测试集。

### 陷阱 4：忽视方差

**问题：** 每个测试只跑一次会忽略模型随机性。

**解决：** 在生产努力级别下，每个案例至少运行三次，并报告置信区间。temperature 已不再是大多数前沿模型的可用调节手段：Claude API 对 Opus 4.7 及以后版本的非默认采样值返回 400；Anthropic Python SDK 1.0 从 Messages 方法中移除了 `temperature`；Google 在 Gemini API 中弃用了它；GPT-6 Astra 不接受它。方差是需要测量的对象，而非可被调没的东西。

### 陷阱 5：忽视成本

**问题：** 最好的模型可能贵 10 倍。

**解决：** 始终报告质量校正成本（quality-adjusted cost），按任务而非按 token 计算。DeepSWE v1.1 上三方并列 74% 的每任务成本跨度为 $2.36 至 $11.84。

```python
def quality_adjusted_cost(model_results):
    return {
        model: {
            "quality": results["mean_score"],
            "cost_per_1k": results["cost_per_1k_queries"],
            "quality_per_dollar": results["mean_score"] / results["cost_per_1k"]
        }
        for model, results in model_results.items()
    }
```

### 陷阱 6：评估的系统与你实际交付的系统不同

**问题：** 评估以 max 努力级别、在供应商 harness 中、启用了向另一模型兜底的安全防护下运行，或者针对的是同一 ID 下已发生变化的模型。

**解决：** 让努力级别、harness、工具和兜底设置与生产环境一致；当供应商端发生变化时重新运行评估，而不只是模型 ID 改变时才重跑。OpenAI 曾在 2026 年 9 月 25 日修复 GPT-6 Sol 和 Luna 的图像理解 bug，未更改模型 ID，并建议客户重跑图像评估。DeepSeek 的旧 `deepseek-v4-flash` 名称现在提供的是 V4.1-Flash。

### 陷阱 7：评估感知

**问题：** 模型在识别出自己正被测试时会表现不同。Anthropic 报告称，Opus 5.5 在 36% 的审计转录中表现出评估感知，而内部 Claude Code 转录中该比例为 0.4%。

**解决：** 从真实的（已清洗）生产流量和影子模式运行中构建评估集，而不是使用明显合成的提示词；当生产信号与离线得分冲突时，优先考虑生产信号。

---

## 实用评估流程

### 第 1 周：搭建与初筛

```
Day 1-2: Define evaluation criteria and create test set
Day 3-4: Benchmark 4-6 candidate models at the effort level you can afford to ship
Day 5: Analyze results, filter to top 2-3
```

### 第 2 周：深入评估

```
Day 1-2: Expand test set for top candidates
Day 3: Test edge cases and robustness
Day 4: Measure latency and throughput
Day 5: Calculate total cost of ownership
```

### 第 3 周：生产验证

```
Day 1-2: Shadow mode deployment
Day 3-4: A/B test if traffic allows
Day 5: Final decision and documentation
```

### 决策模板

```markdown
## Model Evaluation Report

### Candidates Evaluated
- Model A: GPT-6 Sol (effort: medium)
- Model B: Claude Sonnet 5.5 (effort: high, API default)
- Model C: GLM-5.3-Flash (API)

### Evaluation Results

| Metric | Model A | Model B | Model C |
|--------|---------|---------|---------|
| Overall Score | 4.2/5 | 4.3/5 | 3.9/5 |
| Category 1 | ... | ... | ... |
| P50 Latency | 4.1s | 5.2s | 3.6s |
| Tokens per task (2,600 in + output incl. reasoning) | 3,500 | 3,700 | 4,000 |
| Cost/1K queries (list price) | $14.20 | $16.20 | $1.09 |

### Recommendation
Model B (Claude Sonnet 5.5) for quality-critical paths
Model C (GLM-5.3-Flash) for high-volume, cost-sensitive paths

### Rationale
[Detailed reasoning, including harness, effort and retirement dates]
```

---

## 模型 A/B 测试

### 何时进行 A/B 测试

- 高流量（1000+ queries/day）
- 成功指标清晰
- 可以接受质量波动风险
- 需要生产验证

### A/B 测试设计

```python
import hashlib

class ModelABTest:
    def __init__(self, model_a: str, model_b: str, traffic_split: float = 0.5):
        self.model_a = model_a
        self.model_b = model_b
        self.traffic_split = traffic_split
        self.results = {"a": [], "b": []}
    
    def route_request(self, request_id: str) -> str:
        # Deterministic routing for consistency. Python's built-in hash() is
        # salted per process for strings, so use a stable digest instead.
        digest = hashlib.sha256(request_id.encode()).digest()
        hash_val = int.from_bytes(digest[:8], "big") % 100
        if hash_val < self.traffic_split * 100:
            return self.model_a
        return self.model_b
    
    def record_outcome(self, request_id: str, metrics: dict):
        model = self.route_request(request_id)
        bucket = "a" if model == self.model_a else "b"
        self.results[bucket].append(metrics)
    
    def analyze(self):
        return {
            "model_a": {
                "name": self.model_a,
                "mean_score": mean([r["score"] for r in self.results["a"]]),
                "sample_size": len(self.results["a"])
            },
            "model_b": {
                "name": self.model_b,
                "mean_score": mean([r["score"] for r in self.results["b"]]),
                "sample_size": len(self.results["b"])
            },
            "p_value": self.calculate_significance()
        }
```

### 需要跟踪的指标

| 指标类型 | 示例 |
|-------------|----------|
| 质量 | 用户评分、专家评审、LLM judge |
| 参与度 | 点击率、页面停留时长、后续查询 |
| 业务 | 转化率、支持升级、解决率 |
| 运营 | 延迟、错误、每任务成本、拒绝率 |

---

## 面试题

### 问：你会如何为客户支持聊天机器人评估模型？

**高质量回答：**
我会分层构建评估：

**1. 离线评估（80% 的工作量）：**
- 使用真实支持工单创建测试集（200+ 个案例）
- 覆盖所有类别：账单、技术、退货、通用
- 包含 easy、medium、hard 难度
- 衡量：准确率、有用性、安全性

**2. 评估方法：**
- 对主观指标使用 LLM-as-judge
- 人工抽样复核（20%）
- 跟踪指令遵循（格式、长度）

**3. 指标：**
```python
metrics = {
    "resolution_accuracy": "Does answer solve the problem?",
    "safety": "No harmful/wrong advice?", 
    "tone": "Professional and empathetic?",
    "escalation_appropriate": "Knows when to involve human?"
}
```

**4. 生产验证：**
- Shadow mode：运行新模型并对比输出
- A/B test：将 10% 流量分配给新模型
- 监控：CSAT、升级率、解决时间

### 问：在你的 use case 中，用 MMLU 来比较模型有什么问题？

**高质量回答：**
MMLU 在特定 use case 下有几个问题：

**1. 领域错配：** MMLU 测试的是学术知识。我的客户支持机器人需要的是产品知识。

**2. 格式错配：** MMLU 是选择题。我的 use case 是自由形式生成。

**3. 污染：** 模型可能已经在 MMLU 题目上训练过。

**4. 聚合掩盖方差：** 模型 A 可能在 MMLU 上胜过 B，但在我关心的特定类别上落后。

**5. 没有上下文测试：** MMLU 不测试 RAG 或长上下文能力。

**6. 饱和：** 前沿模型都聚集在高分段，因此它已无法区分模型。Artificial Analysis 现将 MMLU-Pro、GPQA Diamond 和类似评估列为其当前指数之外的旧版评估。

**更好的方法：**
- 使用 benchmark（基准评测）进行初筛（节省时间），优先选择具有私有划分、抗污染的评测
- 为最终决策构建自定义评估
- 在真实 use case 数据上测试
- 纳入运营指标（延迟、每任务成本）

### 问：供应商报告其新模型在 ARC-AGI-3 上得分 99.9%，而 ARC Prize 自己的 harness 显示同一模型得分为 62.7%。你使用哪个数字？

**高质量回答：**
两者都是真实的；它们测量的是不同的系统。ARC Prize 已为 GPT-6 Astra 验证了两者。99.9% 运行在 Provider Adapter harness 上，它会在请求之间保留模型的不透明推理状态，采用 high 努力级别，成本约为 $19K。62.7% 运行在 Standard harness 上；这是一个供应商中立接口，模型只能保留自己选择写下的笔记，采用 max 努力级别，成本约为 $26K。

**哪个数字预测我的系统：**
- 如果我的智能体运行在供应商的有状态 API 和 harness 上（对 OpenAI 而言，即跨轮保留推理状态的 Responses API），adapter 数字更接近我的配置。
- 如果我运行供应商中立的 harness、跨供应商路由，或每轮重建上下文，那么 standard 数字才是诚实的指标。所有跨供应商比较都必须使用它。

**我从差距中得出的结论：** 同一组权重的两次运行相差约 37 分，差异来自 scaffold（较低分数甚至使用了更高的努力级别）。因此，我会在自己的 harness 中、以自己的努力级别进行评估，并将状态处理（轮次间保留什么、故障转移是否会丢失它）视为模型选择的一部分。我也会记录每任务成本：这里分数更高的运行反而更便宜。

---

## 参考资料

- Zheng et al. "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena" (2023)
- Arena（原 LMArena / LMSYS Chatbot Arena）: https://arena.ai/
- Artificial Analysis Intelligence Index 方法论: https://artificialanalysis.ai/methodology/intelligence-benchmarking
- ARC Prize，GPT-6 Astra on ARC-AGI-3: https://arcprize.org/blog/astra
- OSWorld 2.0 排行榜（XLANG）: https://osworld-v2.xlang.ai/
- “Maintaining Benchmarks Against Increasingly Capable Agents”（arXiv 2609.34262）
- “JEV vs. LLMs as Rubric Judges”（arXiv 2609.29769）
- HELM: https://crfm.stanford.edu/helm/
- LMSys Evaluation: https://github.com/lm-sys/FastChat/tree/main/fastchat/llm_judge
- OpenAI Evals（开源框架；托管 Evals 平台将于 2026 年 10 月 31 日转为只读，并于 11 月 30 日关闭）: https://github.com/openai/evals

---

*上一篇：[模型分类](01-model-taxonomy.md) | 下一篇：[定价与成本](03-pricing-and-costs.md)*
