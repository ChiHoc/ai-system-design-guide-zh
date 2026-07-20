# 能力评估（Capability Assessment）

本章介绍如何为你的特定 use case（使用场景）评估和比较模型能力。通用 benchmark（基准评测）很少能讲完整故事；本指南帮助你进行有意义的评估。

## 目录（Table of Contents）

- [为什么仅靠基准评测不够](#为什么仅靠基准评测不够)
- [评估维度](#评估维度)
- [构建自定义评估](#构建自定义评估)
- [常见评估陷阱](#常见评估陷阱)
- [实用评估流程](#实用评估流程)
- [内部基于 Elo 的评估](#内部基于-elo-的评估)
- [推理校准与效率](#推理校准)
- [模型 A/B 测试](#模型-a-b-测试)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 为什么仅靠基准评测不够

### 基准问题

公开 benchmark（基准评测）如 MMLU、HumanEval、GSM8K 有局限性：

| 问题 | 影响 |
|-------|--------|
| 训练数据污染（Training data contamination） | 模型可能见过测试题 |
| 任务错配（Task mismatch） | benchmark（基准评测）可能不反映你的 use case（使用场景） |
| 聚合得分掩盖方差（Aggregate scores hide variance） | 模型 A 总体上可能优于 B，但在你的领域却落后 |
| 规避评测（Gaming） | 模型为了优化 benchmark（基准评测）而非真实任务 |
| 过时（Outdated） | benchmark（基准评测）更新滞后于模型能力 |

### 基准评测能告诉你什么

```
Benchmark results tell you: "Model X scored 88% on MMLU"

What you need to know: "Will Model X correctly answer my 
customers' questions about our product documentation?"
```

**经验法则（Rule of thumb）:** 先用 benchmark（基准评测）做初筛，再进行你自己的评估。

---

## 评估维度

### 维度 1：任务表现

| 任务类型 | 评估方法 | 关键指标 |
|-----------|----------|----------|
| **自主编码（Autonomous Coding）** | CWE/SWE-bench（Verified） | 自主解决问题的百分比 |
| **长程规划（Long-Horizon Planning）** | Agentic Loop testing（智能体循环测试） | 10+ 步计划的成功率 |
| **推理深度（Reasoning Depth）** | Thinking mode（推理模式）analysis | CoT（Chain of Thought，思维链）步骤间的一致性 |
| **长上下文 RAG** | Needle-in-a-Haystack（2M+） | 大规模下的召回效率 |
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

“Thinking” 模式是否比 standard generation（标准生成）提升输出准确率？

| 模式 | 准确率（数学） | 准确率（代码） | 平均延迟 | 输出 Token 数 |
|------|-----------------|-----------------|-------------|-----------------|
| **Standard** | 72% | 68% | 1.2s | 400 |
| **Thinking** | 94% | 89% | 12.5s | 2400 |
| **Hybrid** | 可变 | 可变 | 用户自定义 | 可配置 |

### 推理校准

**“过度思考”问题：**  
模型常会在一个只需 10 个 token 就能回答的问题上消耗 2000+ 个“thinking” token（例如：“What is 2+2?”）。

**高层级细节：**  
基于 **Logic Efficiency（逻辑效率）** 评估模型：`Accuracy / (Inference Tokens)`。  
生产系统使用 **Model Arbitration（模型仲裁）**：一个小模型（Gemini 3.1 Flash、Claude Haiku 4.5、GPT-5.5-mini）判断查询是否需要 “Thinking” 模式。这样可避免简单查询出现 10 倍延迟和成本惩罚。

---

## 内部基于 Elo 的评估

**超越静态评分量表。**  
Rubrics（评分量表，1-5 分制）容易出现“judge fatigue（评审疲劳）”和“score drifting（评分漂移）”。现代系统在内部黄金集上使用 **Pairwise Elo（成对 Elo）**。

**工作流：**
1. **盲测并排：** Model A 和 Model B 对同一查询生成答案。
2. **裁判：** 一个 “Ultra” 模型（Claude Opus 4.7、GPT-5.5 reasoning、或人类）选出胜者。
3. **Elo 更新：** 更新内部排行榜。

```python
def update_elo(winner_elo, loser_elo, k=32):
    expected_winner = 1 / (1 + 10 ** ((loser_elo - winner_elo) / 400))
    new_winner_elo = winner_elo + k * (1 - expected_winner)
    new_loser_elo = loser_elo + k * (0 - (1 - expected_winner))
    return new_winner_elo, new_loser_elo
```

**为何有效：** 它提供的是**相对**排名，对评审者个性变化或模型版本迭代更稳健。

### 维度 4：上下文召回

在 2M+ 上下文窗口下，简单的“needle-in-a-haystack”已经不够。我们现在评估窗口内的 **Contextual Reasoning（上下文推理）**。

| 指标 | 测量方式 | 目标 |
|--------|-------------|--------|
| **Window Recall（窗口召回）** | 在 90% 窗口深度下的事实召回率 | > 98% |
| **Cross-Doc Reasoning（跨文档推理）** | 将 Doc A（pos 10k）与 Doc B（pos 1M）逻辑关联 | > 90% |
| **Contextual Noise Resistance（上下文抗噪性）** | 当窗口中 90% 为无关“填充”时的准确率 | > 95% |

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

**解决：** 用 temperature > 0 重复运行，报告置信区间。

### 陷阱 5：忽视成本

**问题：** 最好的模型可能贵 10 倍。

**解决：** 始终报告质量校正成本（quality-adjusted cost）。

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

---

## 实用评估流程

### 第 1 周：搭建与初筛

```
Day 1-2: Define evaluation criteria and create test set
Day 3-4: Benchmark 4-6 candidate models
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
- Model A: GPT-4o
- Model B: Claude 3.5 Sonnet
- Model C: Llama 3.1 70B

### Evaluation Results

| Metric | Model A | Model B | Model C |
|--------|---------|---------|---------|
| Overall Score | 4.2/5 | 4.3/5 | 3.9/5 |
| Category 1 | ... | ... | ... |
| P50 Latency | 450ms | 520ms | 180ms |
| Cost/1K queries | $0.85 | $1.10 | $0.25 |

### Recommendation
Model B (Claude 3.5 Sonnet) for quality-critical paths
Model C (Llama 3.1 70B) for high-volume, cost-sensitive paths

### Rationale
[Detailed reasoning]
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
class ModelABTest:
    def __init__(self, model_a: str, model_b: str, traffic_split: float = 0.5):
        self.model_a = model_a
        self.model_b = model_b
        self.traffic_split = traffic_split
        self.results = {"a": [], "b": []}
    
    def route_request(self, request_id: str) -> str:
        # Deterministic routing for consistency
        hash_val = hash(request_id) % 100
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
| 运营 | 延迟、错误、成本 |

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

**更好的方法：**
- 将 MMLU 用于初筛（节省时间）
- 为最终决策构建自定义评估
- 在真实 use case 数据上测试
- 纳入运营指标（延迟、成本）

---

## 参考资料

- Zheng et al. "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena" (2023)
- LMSYS Chatbot Arena: https://chat.lmsys.org/
- HELM: https://crfm.stanford.edu/helm/
- LMSys Evaluation: https://github.com/lm-sys/FastChat/tree/main/fastchat/llm_judge
- OpenAI Evals: https://github.com/openai/evals

---

*上一篇：[模型分类](01-model-taxonomy.md) | 下一篇：[定价与成本](03-pricing-and-costs.md)*
