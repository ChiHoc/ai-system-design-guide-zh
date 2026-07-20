# RAG 评估模式

评估是 RAG 中最棘手、尚未解决的问题。你可以在一天内搭建出检索流水线；但要判断它是否真的有效，往往需要几周。业界已经收敛到一种分层评估策略：用于正确性的 RAG Triad（三元组）、用于调试的组件级指标，以及用于生产安全的自动化回归测试。Langfuse、LangWatch、Braintrust 和 Arize Phoenix 都提供原生的 RAG 评估方案；可根据部署模式（自托管 vs SaaS）以及是否需要由评估门禁阻断 CI/CD 来选择。

## 目录

- [RAG Triad（三元组）](#rag-triad-三元组)
- [RAGAS 框架与指标](#ragas-框架与指标)
- [组件级评估](#组件级评估)
- [用于 RAG 的 LLM-as-Judge（以大语言模型充当评审）](#用于-rag-的-llm-as-judge)
- [构建金标准测试集](#构建黄金测试集)
- [自动化回归测试](#自动化回归测试)
- [生产监控](#生产监控)
- [大规模评估成本](#大规模评估成本)
- [工具对比](#工具对比)
- [系统设计面试视角](#系统设计面试角度)
- [参考资料](#参考资料)

---

## RAG Triad（三元组）

RAG Triad 是评估 RAG 系统的基础框架。它将正确性分解为三个相互独立的维度，每个维度都能捕捉一种不同的失败模式。

```
                          User Query
                              |
                              v
                    +-------------------+
                    |    RETRIEVER      |
                    +-------------------+
                              |
                   (1) Context Relevance
                    "Did we retrieve the
                     right documents?"
                              |
                              v
                    +-------------------+
                    |    GENERATOR      |
                    +-------------------+
                         /         \
            (2) Groundedness      (3) Answer Relevance
            "Is the answer         "Does the answer
             supported by           address the actual
             the context?"          question?"
                  |                       |
                  v                       v
             No hallucination       No tangential answers
```

### 维度 1：上下文相关性

**问题**：每个检索到的分块是否真的与用户查询相关？

**它能捕捉什么**：错误检索 - 向量搜索返回了关于错误主题的文档，或者查询有歧义，检索器猜错了。

**如何度量**：
- 对每个检索到的分块询问：“这个分块是否与回答查询相关？”
- 得分：相关分块数量 / 检索到的分块总数
- 得分为 0.3 表示检索到的上下文中有 70% 是噪声，迫使 LLM 在无关信息里大海捞针。

**为什么重要**：上下文相关性低是大多数 RAG 失败的根因。即使生成器再完美，也无法仅凭无关上下文产出好答案。

### 维度 2：依据性（忠实性）

**问题**：生成答案中的每一个断言是否都由检索到的上下文支持？

**它能捕捉什么**：幻觉 - LLM 生成了看似合理、但在检索文档中并不存在的断言。

**如何度量**：
- 将答案拆解为单个断言/陈述。
- 对每个断言，在检索到的上下文中搜索支持证据。
- 得分：受支持断言数量 / 断言总数
- 得分为 0.7 表示答案中有 30% 是幻觉。

**为什么重要**：这是企业客户最关心的指标。不忠实的 RAG 系统甚至比不用 RAG 更糟，因为它会带着自信口吻输出错误答案，还附上伪造引用。

### 维度 3：答案相关性

**问题**：最终答案是否真正回应了用户提出的问题？

**它能捕捉什么**：跑题答案 - 检索是好的，答案也有依据，但没有回答问题。常见于检索器找到了相关但不匹配的内容。

**如何度量**：
- 生成 N 个假设问题，看看该答案适合回答哪些问题。
- 测量这些假设问题与原始查询之间的语义相似度。
- 高相似度表示答案切题。

**为什么重要**：系统可以检索到相关上下文并忠实总结，但仍然答非所问。答案相关性可以捕捉这一点。

### 三元组失败模式

| 失败模式 | 上下文相关性 | 依据性 | 答案相关性 | 根因 |
|----------------|-------------------|-------------|-----------------|------------|
| 良好 RAG | 高 | 高 | 高 | 系统运行正确 |
| 错误检索 | **低** | 高 | 低 | 向量嵌入或搜索配置错误 |
| 幻觉 | 高 | **低** | 高 | LLM 忽略上下文，提示词有问题 |
| 跑题答案 | 高 | 高 | **低** | 查询歧义，索引错误 |
| 全面失败 | **低** | **低** | **低** | 流水线根本性问题 |

---

## RAGAS 框架与指标

RAGAS（Retrieval Augmented Generation Assessment，检索增强生成评估）是目前采用最广泛的开源 RAG 评估框架，提供无需参考答案的参考无关（reference-free）指标。

### 核心 RAGAS 指标

```
  RAGAS Metric Suite (v0.2+)
  |
  +-- Retrieval Metrics
  |     +-- Context Precision: Are relevant docs ranked higher?
  |     +-- Context Recall: Did we find all relevant docs?
  |     +-- Context Entities Recall: Did we capture key entities?
  |     +-- Context Relevance: Is retrieved context pertinent?
  |
  +-- Generation Metrics
  |     +-- Faithfulness: Are claims supported by context?
  |     +-- Answer Relevance: Does the answer address the query?
  |     +-- Answer Correctness: Does the answer match ground truth?
  |     +-- Answer Similarity: Semantic overlap with reference answer
  |
  +-- Noise & Robustness
  |     +-- Noise Sensitivity: How much does irrelevant context hurt?
  |
  +-- Multi-Modal (2025+)
        +-- Multimodal Faithfulness: Claims supported by images + text?
        +-- Multimodal Relevance: Are retrieved images relevant?
```

### RAGAS 的忠实性如何工作（内部机制）

```
Step 1: Claim Extraction
  Answer: "Revenue grew 15% in Q3, driven by APAC expansion
           and the new enterprise tier launched in July."

  Claims:
    c1: "Revenue grew 15% in Q3"
    c2: "Growth was driven by APAC expansion"
    c3: "Growth was driven by the new enterprise tier"
    c4: "The enterprise tier was launched in July"

Step 2: Evidence Matching (per claim)
  c1: Found in Context chunk 3 --> SUPPORTED
  c2: Found in Context chunk 1 --> SUPPORTED
  c3: Not found in any context --> UNSUPPORTED
  c4: Context says "August" not "July" --> CONTRADICTED

Step 3: Score Calculation
  Faithfulness = supported / total = 2/4 = 0.50
```

### RAGAS 的上下文精度如何工作

```
  Retrieved chunks ranked by retriever score:
    Rank 1: Chunk about Q3 revenue    --> Relevant (v_1 = 1)
    Rank 2: Chunk about company history --> Not relevant (v_2 = 0)
    Rank 3: Chunk about Q3 expenses   --> Relevant (v_3 = 1)
    Rank 4: Chunk about office locations --> Not relevant (v_4 = 0)

  Context Precision@K:
    Precision@1 = 1/1 = 1.0
    Precision@2 = 1/2 = 0.5
    Precision@3 = 2/3 = 0.67
    Precision@4 = 2/4 = 0.5

  Average Precision = (1.0*1 + 0.5*0 + 0.67*1 + 0.5*0) / 2
                    = (1.0 + 0.67) / 2 = 0.835
```

### RAGAS 与有标准答案指标对比

| 指标 | 需要标准答案吗？ | 它衡量什么 |
|--------|-------------------|------------------|
| 忠实性（Faithfulness） | 否 | 由上下文支持的断言 |
| 上下文相关性 | 否 | 检索分块的相关性 |
| 答案相关性 | 否 | 答案是否回应查询 |
| 上下文召回率 | **是** | 对参考答案的覆盖 |
| 答案正确性 | **是** | 与参考答案的匹配程度 |
| 答案相似度 | **是** | 与参考答案的语义重叠 |

**洞察**：先从参考无关指标（忠实性、上下文相关性、答案相关性）开始，便于快速迭代；等你有了用于回归测试的金标准测试集后，再加入有标准答案指标。

---

## 组件级评估

RAG Triad 评估的是端到端系统。组件级评估则会隔离每个阶段，以精准定位失败点。

### 检索器评估

```
  Query Set (100+ queries with known relevant documents)
        |
        v
  Run Retriever --> Retrieved docs per query
        |
        v
  Compare against ground truth relevance labels
        |
        v
  Metrics:
    +-- Recall@K: What fraction of relevant docs are in the top K?
    +-- MRR (Mean Reciprocal Rank): How high is the first relevant doc?
    +-- NDCG@K: Quality-weighted ranking metric
    +-- Precision@K: What fraction of top K are relevant?
```

**关键检索器基准**：

| 指标 | 最低阈值 | 良好 | 优秀 |
|--------|------------------|------|-----------|
| Recall@10 | 0.70 | 0.85 | 0.95+ |
| MRR | 0.50 | 0.70 | 0.85+ |
| NDCG@10 | 0.50 | 0.70 | 0.85+ |
| Precision@5 | 0.40 | 0.60 | 0.80+ |

### 生成器评估

通过固定检索上下文，仅变化生成部分，来隔离生成器。

```
  Fixed Context (known relevant chunks)
  + Query
        |
        v
  Run Generator --> Answer
        |
        v
  Metrics:
    +-- Faithfulness (RAGAS): Does it stay grounded?
    +-- Completeness: Does it cover all relevant info in context?
    +-- Conciseness: Is it appropriately brief?
    +-- Format Compliance: Does it follow the expected output format?
    +-- Citation Accuracy: Do citations point to the right chunks?
```

### 重排序器评估

```
  Query + Initial retrieval results (e.g., top 100 from BM25)
        |
        v
  Run Reranker --> Reranked results
        |
        v
  Metrics:
    +-- NDCG improvement: Did reranking move relevant docs up?
    +-- Recall preservation: Did reranking lose any relevant docs?
    +-- Latency: What did reranking add to query time?
```

---

## 用于 RAG 的 LLM-as-Judge

使用一个 LLM 来评估另一个 LLM 的输出，是主导性的评估范式。它能扩展到人工评估无法覆盖的规模，但也有已知偏差。

### 工作方式

```
  Evaluation Prompt Template:
  +------------------------------------------------------------------+
  | You are evaluating a RAG system. Given:                           |
  | - User Query: {query}                                             |
  | - Retrieved Context: {context}                                    |
  | - Generated Answer: {answer}                                      |
  |                                                                    |
  | Rate the following on a scale of 1-5:                             |
  | 1. Faithfulness: Are all claims in the answer supported by        |
  |    the context? (1=hallucinated, 5=fully grounded)                |
  | 2. Relevance: Does the answer address the user's question?        |
  |    (1=off-topic, 5=directly answers)                              |
  | 3. Completeness: Does the answer cover all relevant info?         |
  |    (1=missing key info, 5=comprehensive)                          |
  |                                                                    |
  | Provide scores and brief justifications in JSON.                  |
  +------------------------------------------------------------------+
```

### 已知偏差与缓解方法

| 偏差 | 描述 | 缓解 |
|------|-------------|------------|
| **冗长偏好** | LLM 评审更偏爱更长的答案 | 按答案长度归一化分数；增加简洁性惩罚 |
| **自我偏好** | GPT-4 给 GPT-4 的答案打分更高 | 评审模型与生成模型使用不同模型 |
| **位置偏差** | A/B 对比中排在第一个的选项得分更高 | 随机化展示顺序 |
| **谄媚性** | 评审倾向于同意被评估的系统 | 使用带具体标准的结构化评分规则 |
| **宽松性** | LLM 很少给出低于 3/5 的分数 | 使用二元（通过/不通过）而非李克特量表 |

### LLM-as-Judge 最佳实践

1. **使用二元判断而不是量表**：“这个断言是否有依据？是/否”比“按 1-5 评分依据程度”更可靠。
2. **拆解为原子级评估**：一次只评估一个断言或一个维度。
3. **要求证据**：强制评审引用支持或反驳每个断言的具体上下文片段。
4. **用人工一致性做校准**：将 100+ 个样例同时交给 LLM 和人工评审。计算 Cohen's Kappa（科恩卡帕）。目标值 > 0.7。
5. **使用最强可用模型**：评审时用 Claude Opus 或 GPT-4o；绝不要用生成答案的同一个模型。

---

## 构建黄金测试集

黄金测试集是一个经过精选、带版本管理的集合，由 `(query, expected_context, expected_answer)` 三元组组成，作为回归测试的真实基准。

### 构建流程

```
  Step 1: Seed Collection
  +-------------------------------------------------------+
  | Source production queries (logs, support tickets)       |
  | Target: 200-500 diverse queries                        |
  | Coverage: all topics, question types, difficulty levels |
  +-------------------------------------------------------+
            |
            v
  Step 2: Synthetic Augmentation
  +-------------------------------------------------------+
  | Use RAGAS or DataMorgana to generate additional queries |
  | from your corpus:                                       |
  |   - Simple factual questions (40%)                     |
  |   - Multi-hop reasoning questions (25%)                |
  |   - Conditional/comparative questions (20%)            |
  |   - Adversarial/edge cases (15%)                       |
  +-------------------------------------------------------+
            |
            v
  Step 3: Human Annotation
  +-------------------------------------------------------+
  | For each query, annotate:                               |
  |   - Expected relevant document IDs (for retrieval eval) |
  |   - Reference answer (for generation eval)              |
  |   - Difficulty label (easy / medium / hard)             |
  |   - Category tags (topic, question type)                |
  +-------------------------------------------------------+
            |
            v
  Step 4: Versioning and Freezing
  +-------------------------------------------------------+
  | Store in version control (golden_set_v3.json)           |
  | FREEZE the set for each evaluation cycle                |
  | Never modify a frozen set -- create a new version       |
  +-------------------------------------------------------+
```

### 黄金集组成指南

| 问题类型 | 百分比 | 目的 |
|--------------|-----------|---------|
| 简单事实型 | 40% | 基线：应始终通过 |
| 多跳推理 | 25% | 测试跨文档检索 |
| 比较型 | 15% | 测试多个相关文档的检索 |
| 时间型 | 10% | 测试对版本化/带日期内容的处理 |
| 对抗型 | 10% | 测试鲁棒性（无法回答、超出范围） |

### 使用 RAGAS 生成合成测试

```python
# Pseudocode: Generate synthetic test queries from your corpus
from ragas.testset.generator import TestsetGenerator
from ragas.testset.evolutions import simple, reasoning, multi_context

generator = TestsetGenerator.from_langchain(
    generator_llm=ChatOpenAI(model="gpt-4o"),
    critic_llm=ChatOpenAI(model="gpt-4o"),
)
testset = generator.generate_with_langchain_docs(
    documents=load_documents("./knowledge_base/"),
    test_size=200,
    distributions={simple: 0.4, reasoning: 0.35, multi_context: 0.25}
)
# CRITICAL: Always human-review synthetic data before using as ground truth
testset.to_pandas().to_csv("golden_set_draft_v4.csv")
```

**警告**：合成测试集只是起点，不是终点。务必通过人工审查验证，避免在生成模型的产物上进行测试。

---

## 自动化回归测试

每次 RAG（检索增强生成）流水线变更，包括新 embedding（向量表示）、chunk size（分块大小）、prompt 编辑、reranker（重排序器）替换，都需要在部署前进行自动化回归测试。

### CI/CD 集成

```
  PR (RAG change) --> CI: Load golden set --> Run pipeline --> Compute metrics
                          --> Compare vs. baseline --> FAIL if drop > 5%, WARN if > 2%
                          --> Post metrics table as PR comment
```

### 质量门槛

| 指标 | 绝对最低值 | 回归阈值 |
|--------|-----------------|---------------------|
| Recall@10 | 0.85 | 相比基线下降 5% |
| MRR（Mean Reciprocal Rank，平均倒数排名） | 0.70 | 下降 5% |
| Faithfulness（忠实性） | 0.80 | 下降 3% |
| Answer Relevance（答案相关性） | 0.75 | 下降 5% |
| Answer Correctness（答案正确性） | 0.70 | 下降 5% |

任何低于绝对最低值的指标都会阻止 PR。任何超过阈值的回归都会触发警告，并标记出具体退化的查询。

---

## 生产监控

离线评估是必要的，但不充分。生产中的查询与测试集不同，而且随着语料库变化，检索质量会随时间退化。

### 关键生产信号

| 信号 | 检测什么 | 如何衡量 |
|--------|----------------|----------------|
| **空检索率** | 没有相关结果的查询 | 顶部 1 相似度低于阈值的查询占比 |
| **相似度分数漂移** | embedding 或语料库退化 | 跟踪平均相似度随时间的变化；在下降时告警 |
| **忠实性抽样** | 生产中的幻觉率 | 在 5-10% 的随机样本上运行 LLM-as-judge（作为评判器的大语言模型） |
| **用户反馈相关性** | 指标是否匹配真实质量 | 将点赞/点踩与自动评分进行对比 |
| **P99 延迟** | 性能退化 | 跟踪检索 + 生成延迟 |
| **Token 用量** | 成本漂移 | 监控每个查询的平均上下文 token 数 |

### 检索质量漂移

当语料库发生变化，但 embedding、分块或 prompt 没有跟上时，就会发生漂移。四种常见场景：（1）新文档使用不同词汇导致 embedding 空间不匹配 -- 通过对受影响集合重新做 embedding 修复；（2）用户查询模式转向没有内容覆盖的话题 -- 通过空检索率监控检测；（3）过时内容返回了过期答案 -- 添加新鲜度元数据并优先使用较新的文档；（4）embedding 模型更新改变了相似度分布 -- 在模型变更后重新校准所有阈值。

---

## 大规模评估成本

LLM-as-judge 评估很强大，但也很昂贵。理解成本结构对于预算规划至关重要。

### 每个查询的成本（完整 RAG 三元组）

| 指标 | LLM 调用次数 | Token | GPT-4o 成本 | Claude Haiku 成本 |
|--------|-----------|--------|-------------|-------------------|
| Faithfulness（忠实性） | ~3（提取 + 验证） | ~3k | $0.0075 | $0.00075 |
| Context Relevance（上下文相关性） | ~5（每个 chunk） | ~2.5k | $0.00625 | $0.000625 |
| Answer Relevance（答案相关性） | ~2（生成问题） | ~1.6k | $0.004 | $0.0004 |
| **完整三元组** | **~10** | **~7k** | **~$0.018** | **~$0.002** |

### 扩展策略

| 评估类型 | 频率 | 规模 | 评判模型 | 月成本（每天 10k 查询） |
|----------------|-----------|--------|-------------|-------------------------------|
| **CI 回归** | 每个 PR | 黄金集（500 个查询） | GPT-4o | ~$/9/次 |
| **夜间批处理** | 每日 | 随机 1k 生产查询 | Claude Haiku | ~$60/月 |
| **生产抽样** | 实时 | 流量的 5% | Claude Haiku | ~$300/月 |
| **深度审计** | 每周 | 完整黄金集 + 分析 | GPT-4o | ~$36/月 |

**洞见**：对高吞吐量的生产抽样，使用 Claude Haiku 4.5 或 GPT-5.5-mini。将 Claude Opus 4.7 或 GPT-5.5 保留给 CI 回归测试和深度审计，因为这些场景里准确性比成本更重要。

---

## 工具对比

### 框架概览

| 工具 | 最适合 | 开源 | 核心优势 | 核心劣势 |
|------|----------|------------|--------------|--------------|
| **RAGAS** | 快速 RAG 评估、合成数据 | 是 | 无需参考答案的指标、社区强 | 指标结果缺少解释 |
| **DeepEval** | CI/CD 集成、面向 LLM 的 TDD（测试驱动开发） | 是 | 兼容 pytest、自解释评分 | 配置更重 |
| **TruLens** | RAG 三元组评估、可观测性 | 是 | 提出了 RAG Triad，追踪能力好 | 维护活跃度较低 |
| **UpTrain** | 生产监控、漂移检测 | 是 | 混合评估（LLM + 启发式）、漂移告警 | 排序准确率较低 |
| **Braintrust** | 团队协作、实验跟踪 | 商业 | 最佳 UI/UX、实验对比 | 高级功能付费 |
| **LangSmith** | LangChain 生态、追踪 | 商业 | 与 LangChain 深度集成、追踪能力强 | 绑定 LangChain 生态 |

### 何时使用什么

```
  Starting a new RAG project?
    --> RAGAS for quick baseline metrics + synthetic test generation

  Adding RAG eval to CI/CD?
    --> DeepEval (pytest integration, quality gates as assertions)

  Need production monitoring?
    --> UpTrain or Braintrust (drift detection, alerting)

  Want end-to-end observability?
    --> LangSmith (if LangChain) or Braintrust (if framework-agnostic)

  Building custom eval pipeline?
    --> Roll your own with LLM-as-judge + the RAG Triad structure
```

### 自定义评估器模式

自定义评估器的核心模式很简单：对每个三元组维度，使用二元的 LLM-as-judge 调用并进行聚合。

```python
# Pseudocode: Core faithfulness evaluator (other dimensions follow the same pattern)

def evaluate_faithfulness(answer: str, context: str, judge) -> float:
    # Step 1: Extract atomic claims from the answer
    claims = judge.generate(f"List every factual claim as a JSON array:\n{answer}")

    # Step 2: Verify each claim against context (binary YES/NO)
    supported = sum(
        1 for claim in json.loads(claims)
        if "YES" in judge.generate(
            f"Is this claim supported by the context? YES or NO.\n"
            f"Claim: {claim}\nContext: {context}"
        ).upper()
    )
    return supported / max(len(json.loads(claims)), 1)
```

对上下文相关性（按 chunk：“这和查询相关吗？”）以及答案相关性（生成假设问题，并与原始查询计算相似度）也应用同样的“先拆解、再评判”模式。

---

## 系统设计面试角度

### 问：你部署了一个 RAG 系统，用户反馈答案有时是错的。你会如何系统地诊断并修复这个问题？

**强答案：**

我会使用 RAG Triad（RAG 三元组）来定位失败模式：

1. **采样失败查询**：收集用户标记为错误答案的 50-100 个查询，并按失败类型分类。

2. **运行三元组评估**：
   - **Context Relevance 低？** --> 检索问题。系统抓取了错误文档。修复方式：检查 embedding 相似度分数，确认查询语言是否与文档语言匹配，尝试混合检索（BM25 + dense），添加 reranker。
   - **Groundedness 低？** --> 幻觉问题。尽管上下文不错，LLM 还是在编造。修复方式：加强系统 prompt（“只能基于提供的上下文回答”）、降低 temperature、切换到更擅长遵循指令的模型，或增加引用要求。
   - **Answer Relevance 低？** --> 系统检索到了相关内容并且忠实总结了它，但没有命中真实问题。修复方式：改进查询理解（query rewriting、HyDE），增加查询分类，把请求路由到正确的索引。

3. **构建回归测试**：取出 50 个失败查询，标注期望答案，并加入黄金测试集。今后每次流水线变更都必须通过这些用例。

4. **建立持续监控**：从生产流量中抽样 5% 用于自动评估。当忠实性低于 0.80 或上下文相关性低于 0.60 时告警。

关键洞见是：“答案是错的”不是诊断结果，而是症状。RAG Triad 把含糊的抱怨转化为具体、可执行的根因。

### 问：在没有真实答案的情况下，如何评估一个 RAG 系统？

**强答案：**

这是最常见的真实场景。我会采用三层方法：

**第 1 层：无参考答案指标（第 1 天）**。RAGAS 的 faithfulness 和 context relevance 不需要真实答案。它们告诉你系统是否在幻觉，以及检索是否正常。你可以立即在任何查询上运行这些指标。

**第 2 层：合成黄金集（第 1 周）**。使用 RAGAS TestsetGenerator 从语料库中生成合成的 `(query, answer)` 对。这会给你近似的真实答案，用于答案正确性和上下文召回。对样本进行人工复核以验证质量。

**第 3 层：生产派生黄金集（第 1 月）**。从生产日志中挖掘高用户满意度的查询（点赞、没有后续追问）。让标注人员为这些查询标注参考答案。这样可以创建一个反映真实使用模式而非合成分布的黄金集。

取舍在于准确性与速度之间。第 1 层能在数小时内给你信号，但只是近似值。第 3 层能给你真实基准，但需要数周。应并行运行三层方法，从第 1 层开始以获得即时反馈。

### 问：你的 RAG（检索增强生成）评估流水线每天在 LLM judge 调用上花费 $500。你如何降低它？

**强回答：**

按影响从大到小，有四种策略：

1. **分层 judge 模型**：生产采样使用 Claude Haiku（每次查询 $0.002）；覆盖 90% 的流量。把 GPT-4o（每次查询 $0.018）保留给 CI（持续集成）回归测试和每周深度审计。仅这一项就能把成本降低 80%。

2. **智能采样**：不要评估每个查询。只对生产流量抽样 5%，并按查询类型和用户分群做分层抽样。对于 CI，只运行 golden set（黄金集，500 个查询），而不是完整的 synthetic set（合成集）。

3. **缓存**：很多生产查询是相似的。对 (query, context, answer) 元组做哈希并缓存评估结果。完全相同或近似相同的输入直接复用缓存分数。

4. **启发式预过滤**：在调用 LLM judge 之前先运行廉价的启发式检查。如果答案包含 “I don't know” 或与上下文完全没有重叠（ROUGE-L < 0.1），就跳过昂贵的 faithfulness evaluation（忠实度评估）并直接赋分。

目标是把评估预算花在最有信号的地方：那些模糊、临界的案例上，因为这时 LLM judge 的细致推理最有价值。

---

## 参考资料

- Es 等人。《RAGAS：检索增强生成的自动化评估》（2023，arXiv:2309.15217）
- TruLens。《RAG 三元组》（2024）
- DeepEval。《在 RAG 评估中使用 RAG 三元组》（2025）
- Confident AI。《RAG 评估指标》（2025）
- Microsoft。《通往黄金数据集之路》（2025）
- Prem AI。《RAG 评估：指标、框架与测试》（2026）

---

*上一篇：[多模态 RAG](12-multimodal-rag.md) | 下一篇：即将推出*
