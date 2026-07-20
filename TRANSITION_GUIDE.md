# 🔄 转向 AI 工程岗位

> 一份具体且按岗位划分的指南，面向正在转向 AI 重点岗位的工程师、产品经理、QA 和管理者。
> **没有泛泛而谈的建议。每条路径都映射到真实技能、真实仓库章节和真实课程。**

---

## 本指南适合谁

你目前是软件工程师、QA、产品经理、工程经理或数据工程师，并且想转向 AI 重点岗位。本指南会把你的**现有技能**映射到具体的 AI 岗位，告诉你**究竟需要补齐哪些差距**，并指向本仓库中合适的章节和课程来帮助你补齐这些能力。

---

## AI 岗位版图

在选择路径之前，先理解目标岗位到底是什么：

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI ROLE LANDSCAPE                            │
│                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────────────┐  │
│  │   APPLICATION LAYER  │    │     INFRASTRUCTURE LAYER     │  │
│  │                      │    │                              │  │
│  │  LLM App Engineer    │    │  MLOps / AI Infra Engineer   │  │
│  │  AI Product Engineer │    │  AI Platform Engineer        │  │
│  │  Agentic Systems Eng │    │  AI Reliability Engineer     │  │
│  └──────────────────────┘    └──────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────────────┐  │
│  │    QUALITY LAYER     │    │     LEADERSHIP LAYER         │  │
│  │                      │    │                              │  │
│  │  AI Eval Engineer    │    │  AI Product Manager          │  │
│  │  AI Quality Engineer │    │  AI Engineering Manager      │  │
│  │  Red Team Analyst    │    │  AI Program Manager          │  │
│  └──────────────────────┘    └──────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────────────┐  │
│  │    RESEARCH LAYER    │    │     SPECIALIST LAYER         │  │
│  │                      │    │                              │  │
│  │  Applied AI Scientist│    │  Agentic Coding Specialist   │  │
│  │  Fine-tuning Engineer│    │  RAG Architect               │  │
│  │  Alignment Researcher│    │  AI Safety Engineer          │  │
│  └──────────────────────┘    └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 按当前岗位划分的转型路径

---

### 1. 🖥️ 后端工程师 → AI 工程

**为什么后端是最佳起点：** 你已经理解 API、延迟、数据库、分布式系统和生产可靠性。AI 应用需要所有这些能力。差距主要在领域知识，而不是工程基本功。

#### 目标岗位

```
Backend Engineer
      │
      ├──► LLM Application Engineer       (most common transition, 3–6 months)
      ├──► Agentic Systems Engineer        (3–9 months)
      ├──► AI Infrastructure / MLOps Eng  (6–12 months, needs GPU/serving knowledge)
      └──► RAG Architect                  (4–8 months)
```

#### 技能差距分析

| 你已经具备 | 需要补齐的差距 | 优先级 |
|-----------------|--------------|----------|
| REST API 设计 | LLM（大语言模型）API 集成模式 | 🔴 高 |
| 数据库设计 | 向量数据库（Qdrant、Pinecone、Weaviate） | 🔴 高 |
| 异步/流式处理 | 流式 LLM 响应、token（词元）流式输出 | 🔴 高 |
| 认证与多租户 | 多租户 RAG（检索增强生成）隔离 | 🔴 高 |
| 缓存（Redis、CDN） | Prompt（提示词）缓存、语义缓存 | 🟡 中 |
| 监控（Prometheus） | LLM 可观测性（追踪、评估） | 🟡 中 |
| CI/CD | LLMOps（大语言模型运维）流水线、模型版本管理 | 🟡 中 |
| 不适用 | Embedding（嵌入）模型和向量数学 | 🟡 中 |
| 不适用 | Prompt engineering（提示词工程）基础 | 🟡 中 |
| 不适用 | RAG 流水线架构 | 🟡 中 |
| 不适用 | Agent（智能体）框架（LangGraph、CrewAI） | 🟢 较低 |
| 不适用 | 微调概念（LoRA、RLHF） | 🟢 较低 |

#### 你的 90 天计划

**第 1 个月：LLM 集成**
- 学习 OpenAI / Anthropic API（流式处理、函数调用、结构化输出）
- 构建一个简单的 RAG 系统：PDF 摄取 → Qdrant → LLM 响应
- 阅读本仓库：[01-foundations](01-foundations/)、[02-model-landscape](02-model-landscape/)、[05-prompting-and-context](05-prompting-and-context/)
- 课程：*面向开发者的 ChatGPT 提示词工程*（DeepLearning.AI，免费）

**第 2 个月：生产模式**
- 为你的 RAG 系统添加多租户隔离
- 添加 LangSmith 或 Langfuse 追踪  
- 实现提示词缓存以节省成本
- 阅读本仓库：[06-retrieval-systems](06-retrieval-systems/)、[12-security-and-access](12-security-and-access/)、[08-memory-and-state](08-memory-and-state/)
- 课程：*构建与评估高级 RAG*（DeepLearning.AI，免费）

**第 3 个月：智能体系统**
- 构建一个带工具的 LangGraph 智能体（网页搜索、代码执行）
- 使用 RAGAS 或 Phoenix 添加评估流水线
- 部署时配置适当的成本控制和速率限制
- 阅读本仓库：[07-agentic-systems](07-agentic-systems/)、[09-frameworks-and-tools](09-frameworks-and-tools/)、[14-evaluation-and-observability](14-evaluation-and-observability/)
- 课程：*LangGraph 中的 AI 智能体*（DeepLearning.AI，免费）

#### 作品集项目想法
- 带访问控制的多租户文档问答服务
- 能发布 GitHub PR 评论的智能体代码审查器
- 带评估流水线的 RAG 驱动内部知识库

---

### 2. 🎨 前端工程师 → AI 产品工程

**为什么这种转型可行：** 前端工程师理解 UX（用户体验）、实时 UI 更新和用户行为。AI 产品的成败取决于 UX：流式响应、渐进式渲染、加载状态、反馈收集。你的技能比你想象的更有价值。

#### 目标岗位

```
Frontend Engineer
      │
      ├──► AI Product Engineer         (3–6 months — highest demand)
      ├──► AI UX Engineer              (3–6 months, UX focus)
      └──► Full-Stack LLM Engineer     (6–9 months, add backend LLM skills)
```

#### 技能差距分析

| 你已经具备 | 需要补齐的差距 | 优先级 |
|-----------------|--------------|----------|
| 流式 UI（SSE、WebSocket） | LLM token 流式集成 | 🔴 高 |
| 状态管理 | 对话状态、会话记忆 | 🔴 高 |
| 用户反馈模式 | AI 反馈收集（点赞/点踩、评分） | 🔴 高 |
| 表单校验 | 提示词输入校验和清理 | 🟡 中 |
| 异步错误处理 | LLM 超时、降级、重试模式 | 🟡 中 |
| A/B 测试 | LLM A/B 测试和变体追踪 | 🟡 中 |
| 不适用 | 基础提示词工程 | 🟡 中 |
| 不适用 | LLM API 集成（至少一个提供商） | 🟡 中 |
| 不适用 | 理解上下文窗口 | 🟡 中 |
| 不适用 | 基础 RAG 概念（它是什么以及为什么需要它） | 🟢 较低 |

#### 你的 90 天计划

**第 1 个月：将 LLM 集成到 UI 中**
- 构建一个流式聊天界面（Next.js + Vercel AI SDK）
- 实现合适的加载状态、逐 token 渲染、错误边界
- 添加反馈组件（点赞/点踩、重新生成按钮）
- 课程：*面向开发者的 ChatGPT 提示词工程*（DeepLearning.AI，免费）

**第 2 个月：AI 的 UX 模式**
- 使用会话状态实现对话记忆
- 为 RAG 响应添加引用渲染
- 为你的团队构建一个提示词游乐场 UI
- 阅读本仓库：[08-memory-and-state](08-memory-and-state/)、[05-prompting-and-context](05-prompting-and-context/)

**第 3 个月：评估集成**
- 为你的 UI 埋点以收集反馈信号
- 将反馈连接到 Langfuse 或 LangSmith 项目
- 在两个提示词变体之间运行基础 A/B 测试
- 阅读本仓库：[14-evaluation-and-observability](14-evaluation-and-observability/)
- 课程：*评估与调试生成式 AI*（DeepLearning.AI + W&B，免费）

#### 作品集项目创意
- 带有 AI 建议和行内引用的流式文档编辑器
- 具有持久上下文的多步骤 AI 表单向导
- 展示各功能质量指标的 AI 反馈仪表盘

---

### 3. 🧪 QA 工程师 → AI 评估工程师

**为什么 QA 是最被低估的路径：** AI 评估本质上是一种新的 QA 形式。手工测试用例设计、边界情况思维、回归预防——这些正是 AI 系统所需要的能力。但工具不同，而且对非确定性输出的思维方式也需要转变。

#### 目标角色

```
QA Engineer
      │
      ├──► AI Eval Engineer            (3–6 months — best fit, fast transition)
      ├──► AI Quality Engineer         (3–6 months)
      └──► Red Team Analyst            (6–9 months, security focus)
```

#### 技能差距分析

| 你已经具备 | 需要补齐的差距 | 优先级 |
|-----------------|--------------|----------|
| 测试用例设计 | 评估数据集创建（维度采样） | 🔴 高 |
| 回归测试思维 | 将评估套件作为 CI 质量门禁 | 🔴 高 |
| 缺陷报告 | 错误分析方法论（开放编码/轴心编码） | 🔴 高 |
| 测试自动化 | LLM-as-judge（以大语言模型作为裁判）评估器自动化 | 🔴 高 |
| 非功能测试 | 幻觉、偏见、毒性检测 | 🟡 中 |
| 用户验收测试 | 人工标注工作流 | 🟡 中 |
| N/A | 追踪与可观测性设置 | 🟡 中 |
| N/A | RAGAS 指标（忠实度、相关性、召回率） | 🟡 中 |
| N/A | 基础提示词工程 | 🟢 较低 |
| N/A | 用于评估流水线的 Python 脚本编写 | 🟢 较低 |

#### 你的 90 天计划

**第 1 个月：错误分析基础**
- 在任意 LLM 应用（你自己的或开源的）上设置 Langfuse 或 Phoenix 追踪
- 进行 3 轮手工错误分析：审查 50 条追踪记录、写笔记、分类
- 阅读该仓库的评估配套指南：
  - [AI 评估：综合学习指南](ai_evals_comprehensive_study_guide.md)
  - [AI 评估：LangWatch + Langfuse 指南](ai_evals_complete_guide_langwatch_langfuse.md)
- 要阅读的课程章节：*错误分析：秘密武器*（在评估指南内，第 3 章）

**第 2 个月：构建评估器**
- 编写 3 个基于代码的评估器（JSON schema 检查、格式验证器、基于正则表达式的评估器）
- 编写 1 个 LLM-as-judge 评估器，并进行 Train/Dev/Test 校准
- 引入 `judgy` 进行统计偏差校正
- 阅读这个仓库：[14-evaluation-and-observability](14-evaluation-and-observability/)
- 课程：*Quality and Safety for LLM Applications*（DeepLearning.AI + WhyLabs，免费）

**第 3 个月：CI/CD 集成**
- 将评估器接入 GitHub Actions 工作流——每个 PR 都运行评估
- 定义质量门禁（忠实度 > 0.85，格式通过率 > 0.99）
- 创建每周评估报告仪表盘
- 课程：*Evals for AI*（Maven，Hamel + Shreya——付费，但对职业转型值得）

#### 作品集项目创意
- 面向公共 LLM 应用的开源评估套件
- 博客文章：“我是如何应用 QA 方法论捕捉 LLM 失败的”
- 使用 LangSmith + GitHub Actions 的评估流水线模板仓库

---

### 4. 📋 产品经理 → AI 产品经理

**为什么 PM 处于独特优势位置：** AI 产品失败不是因为模型差，而是因为产品决策差（问题选错、评估标准错误、成功指标错误）。理解 AI 失败模式的 PM 极其少见，也非常有价值。

#### 目标角色

```
Product Manager
      │
      ├──► AI Product Manager           (3–6 months — direct analog)
      ├──► AI Program Manager           (3–6 months, coordination focus)
      └──► Head of AI Product           (9–18 months, leadership path)
```

#### 技能差距分析

| 你已经具备 | 需要补齐的差距 | 优先级 |
|-----------------|--------------|----------|
| 用户研究 | 将错误分析作为客户之声 | 🔴 高 |
| 成功指标定义 | AI 专用指标（忠实度、完成率） | 🔴 高 |
| 路线图优先级排序 | 基于评估数据进行失败模式优先级排序 | 🔴 高 |
| A/B 测试 | LLM A/B 测试设计（提示词变体、模型） | 🔴 高 |
| 干系人沟通 | 向合作伙伴解释 AI 局限性 | 🟡 中 |
| PRD 编写 | AI 系统能力文档和约束文档 | 🟡 中 |
| N/A | LLM 如何在高层次上工作（无需代码） | 🟡 中 |
| N/A | RAG 流水线概念 | 🟡 中 |
| N/A | 追踪 / 可观测性工具（Langfuse UI） | 🟡 中 |
| N/A | 提示词工程基础 | 🟢 较低 |

#### 你的 90 天计划

**第 1 个月：建立技术词汇**
- 阅读该仓库的基础内容，不要跳到代码：
  - [01-foundations](01-foundations/)——从概念上理解 transformer（变换器）
  - [02-model-landscape](02-model-landscape/)——了解有哪些模型以及它们的成本
  - [GLOSSARY.md](GLOSSARY.md)——学习词汇
- 课程：*AI for Everyone*（Coursera，Andrew Ng，免费）——为非技术角色设计

**第 2 个月：主导错误分析**
- 请你的工程团队设置 Langfuse 或 LangSmith
- 亲自审查你产品中的 100+ 条追踪记录——做笔记、找模式
- 和团队一起开展错误分析会议；主导失败模式分类
- 阅读这个仓库：[14-evaluation-and-observability](14-evaluation-and-observability/)
- 阅读：[AI 评估综合学习指南](ai_evals_comprehensive_study_guide.md)中的第 3 章（错误分析）

**第 3 个月：定义你的评估策略**
- 为你的产品编写一份“AI 质量规范”：定义每个功能的优秀标准
- 与工程师合作，为这些标准接入评估
- 为下个季度设定包含 AI 质量门禁的成功指标（不只是用户增长）
- 课程：*Evals for AI*（Maven，Hamel + Shreya——明确为 PM 设计）

#### 让你作为 AI PM 脱颖而出的技能
- 你亲自审查过追踪记录（大多数 PM 会委托他人）
- 你可以定量定义失败模式，而不只是定性描述
- 你可以沟通质量改进的成本（提示词修改 vs. 模型升级 vs. 微调）
- 你理解 RAG、微调和提示词工程之间的区别，以及各自适用的场景

---

### 5. 👨‍💼 工程经理 → AI 工程经理

**EM 转型关乎领导力演进：** AI 方面的技术素养是必要的，但还不够。关键转变在于管理非确定性系统，管理在没有标准答案情况下评估质量的团队，以及应对每 3–6 个月就变化一次的领域。

#### 目标角色

```
Engineering Manager
      │
      ├──► AI Engineering Manager       (6–12 months)
      ├──► Director of AI Engineering   (12–24 months)
      └──► VP of AI / Head of AI        (18–36 months)
```

#### AI EM 会发生什么变化

| 传统 EM | AI EM 新增内容 |
|----------------|-----------------|
| Sprint 规划 | 由评估驱动的迭代周期 |
| PR 审查标准 | 将评估套件作为新的“测试通过”门槛 |
| 招聘后端/前端 | 招聘具备 LLM、向量搜索、评估专业能力的人才 |
| 面向故障的事件响应 | 面向质量回归的事件响应 |
| 带功能开关的路线图 | 带模型升级风险的路线图 |
| 基于交付的绩效评估 | 包含 AI 质量归属的绩效评估 |

#### 你的 90 天计划

**第 1 个月：技术深度**
- 阅读完整的 [09-frameworks-and-tools](09-frameworks-and-tools/)，理解工具生态
- 阅读 [09-claude-code.md](09-frameworks-and-tools/09-claude-code.md) 和 [10-opencoderguide.md](09-frameworks-and-tools/10-opencoderguide.md)——你将管理使用这些工具的团队
- 理解成本：阅读 [02-model-landscape/03-pricing-and-costs.md](02-model-landscape/03-pricing-and-costs.md)
- 课程：*Generative AI with LLMs*（使用 LLM 的生成式 AI，Coursera，DeepLearning.AI）——为你提供足够深度来主导技术讨论

**第 2 个月：流程和团队设计**
- 重新设计你团队对“完成”的定义，加入 eval（评测）门禁
- 建立 eval（评测）文化：每周 trace（追踪记录）评审、在复盘中纳入质量指标
- 定义你的 AI 事故 runbook（运行手册）：当 hallucination（幻觉）率飙升时会发生什么？
- 阅读此仓库：[13-reliability-and-safety](13-reliability-and-safety/)、[14-evaluation-and-observability](14-evaluation-and-observability/)

**第 3 个月：战略和招聘**
- 为你的团队定义 AI 技能矩阵：谁具备什么能力，缺少什么能力
- 为 AI 工程师构建面试 rubric（评分量规）（使用 [00-interview-prep](00-interview-prep/) 作为来源）
- 为下个季度设定团队级 AI 质量 OKR（目标与关键结果）
- 课程：*CS294 LLM Agents*（CS294 LLM 智能体，Berkeley，免费）——为你提供足够深度来进行战略对话

---

### 6. 🛠️ DevOps / 平台工程师 → MLOps / AI 基础设施工程师

**为什么平台工程师能在这里发挥优势：** Kubernetes、CI/CD、observability（可观测性）、成本管理、SLA（服务级别协议）——这些你都做过。AI 特有的新增内容是 GPU 调度、模型服务和 LLMOps（大语言模型运维）流水线。

#### 目标岗位

```
DevOps / Platform Engineer
      │
      ├──► MLOps Engineer               (3–6 months)
      ├──► AI Infrastructure Engineer   (6–9 months)
      └──► AI Platform Engineer         (9–12 months)
```

#### 技能差距分析

| 你已经具备 | 需要补齐的差距 | 优先级 |
|-----------------|--------------|----------|
| 容器编排（K8s） | GPU 节点池、NVIDIA 设备插件 | 🔴 高 |
| CI/CD 流水线 | LLMOps 流水线（模型 eval、部署门禁） | 🔴 高 |
| 可观测性技术栈 | LLM 特定指标（token 吞吐量、TTFT） | 🔴 高 |
| 成本管理 | GPU 成本优化、用于训练的 spot instances（竞价实例） | 🔴 高 |
| 密钥管理 | 多个 LLM provider（提供商）的 API key 轮换 | 🟡 中 |
| N/A | 用于自托管模型服务的 vLLM / TGI | 🟡 中 |
| N/A | 模型版本管理和 registry（注册表） | 🟡 中 |
| N/A | quantization（量化）基础（GPTQ、AWQ、GGUF） | 🟡 中 |
| N/A | 基础 prompt engineering（提示词工程），用于理解你正在服务的内容 | 🟢 较低 |

#### 你的 90 天计划

**第 1 个月：LLM 服务**
- 在本地部署 vLLM，为 Llama 3.3 7B 或 Qwen2.5-Coder 提供服务
- 添加 Prometheus 指标：tokens/sec、延迟 P50/P95/P99、队列深度
- 基于请求队列设置 auto-scaling（自动扩缩容）
- 阅读此仓库：[04-inference-optimization](04-inference-optimization/)、[11-infrastructure-and-mlops](11-infrastructure-and-mlops/)
- 课程：*Efficiently Serving LLMs*（高效服务 LLM，DeepLearning.AI + Predibase，免费）

**第 2 个月：LLMOps 流水线**
- 设置 LangSmith 或 Langfuse 进行 trace（追踪记录）收集
- 构建 CI/CD 质量门禁：eval suite（评测套件）在模型部署前运行
- 实现 prompt（提示词）版本控制（Langfuse prompt registry 或 DSPy）
- 阅读此仓库：[14-evaluation-and-observability](14-evaluation-and-observability/)

**第 3 个月：规模和成本**
- 在目标流量下比较自托管与 API 成本（使用仓库中的定价指南）
- 按模型、团队、功能设置成本仪表盘
- 实现优雅的多 provider（提供商）failover（故障转移）
- 课程：*ML Engineering for Production (MLOps)*（面向生产的机器学习工程，Coursera，DeepLearning.AI）

---

### 7. 📊 数据工程师 → AI 数据 / 特征工程师

**为什么数据工程师至关重要：** 训练数据是 AI 系统的竞争护城河。数据流水线、质量和新鲜度比架构更能决定模型性能。你的技能可以立即应用。

#### 目标岗位

```
Data Engineer
      │
      ├──► AI Data Engineer             (2–4 months — fastest transition)
      ├──► Embedding Pipeline Engineer  (3–6 months)
      └──► Fine-tuning Data Specialist  (4–8 months)
```

#### 技能差距分析

| 你已经具备 | 需要补齐的差距 | 优先级 |
|-----------------|--------------|----------|
| ETL 流水线 | 用于 RAG 的文档 ingest（摄取）流水线 | 🔴 高 |
| 数据质量检查 | eval 数据集质量验证 | 🔴 高 |
| Schema（模式）设计 | 向量数据库的 metadata schema（元数据模式） | 🔴 高 |
| 流式流水线 | 实时 embedding（嵌入）和索引更新 | 🟡 中 |
| N/A | embedding 模型选择和 batching（批处理） | 🟡 中 |
| N/A | 向量数据库操作（upsert、filter、ANN search） | 🟡 中 |
| N/A | 面向文档类型的 chunking（分块）策略 | 🟡 中 |
| N/A | 用于 fine-tuning（微调）的 annotation（标注）流水线设计 | 🟢 较低 |
| N/A | RLHF（基于人类反馈的强化学习）偏好数据格式 | 🟢 较低 |

#### 你的 90 天计划

**第 1 个月：RAG 数据流水线**
- 构建 ingest（摄取）流水线：PDF/HTML/DOCX → chunked（分块）→ embedded（嵌入）→ Qdrant
- 添加数据质量门禁：最小 chunk 大小、去重、语言检测
- 实现增量同步：只重新 embedding 已变更的文档
- 阅读此仓库：[06-retrieval-systems/02-chunking-strategies.md](06-retrieval-systems/02-chunking-strategies.md)、[10-document-processing](10-document-processing/)

**第 2 个月：Eval 数据集工程**
- 使用 dimensional sampling（维度采样）构建测试数据集（见 evals 指南）
- 使用 Label Studio 或 Argilla 设置人工 annotation（标注）流水线
- 跟踪 inter-annotator agreement（标注者间一致性）；拒绝低质量标签
- 阅读：[AI Evals Comprehensive Study Guide](ai_evals_comprehensive_study_guide.md)，第 12 章（人工标注）
- 课程：*Finetuning Large Language Models*（微调大型语言模型，DeepLearning.AI，免费）

**第 3 个月：高级数据工程**
- 构建将生产 trace（追踪记录）转化为 fine-tuning（微调）样本的流水线
- 实现 embedding drift（嵌入漂移）检测：当文档分布发生变化时告警
- 在你的领域数据上 benchmark（基准测试）3 个 embedding 模型
- 阅读此仓库：[03-training-and-adaptation](03-training-and-adaptation/)

---

## 📊 岗位对比概览

```
Role            Months to   Avg Salary    Best Suited For
                First Role   (US, 2026)
────────────────────────────────────────────────────────
Backend         3–6 mo       $170–220K    LLM App / Agentic Engineering
Frontend        3–6 mo       $150–190K    AI Product / UX Engineering
QA              3–6 mo       $140–180K    AI Eval / Quality Engineering
PM              3–6 mo       $160–200K    AI Product Management
DevOps          3–6 mo       $170–220K    MLOps / AI Platform
Data Eng        2–4 mo       $165–210K    RAG Data, Fine-tuning Data
EM              6–12 mo      $200–280K    AI Engineering Manager
```

*薪资是基于 Levels.fyi 和 LinkedIn 数据的美国市场估算，2026 年 5 月。范围会因公司、地点和经验水平而显著不同。*

---

## 🗺️ 仓库章节对应内容

当你准备深入学习时使用此表：

| 主题 | 仓库章节 | 原因 |
|-------|-------------|-----|
| LLM 如何工作 | [01-foundations](01-foundations/) | 其他一切的基础 |
| 使用哪个模型 | [02-model-landscape](02-model-landscape/) | 模型选择是日常决策 |
| Fine-tuning（微调） | [03-training-and-adaptation](03-training-and-adaptation/) | 适用于微调数据专家路径 |
| GPU 服务 / vLLM | [04-inference-optimization](04-inference-optimization/) | MLOps / 平台路径 |
| Prompt engineering（提示词工程） | [05-prompting-and-context](05-prompting-and-context/) | 每个人都需要 |
| RAG 流水线 | [06-retrieval-systems](06-retrieval-systems/) | 后端 / 数据工程路径 |
| Agentic systems（智能体系统） | [07-agentic-systems](07-agentic-systems/) | 后端 / 高级 AI 工程路径 |
| Memory & state（记忆与状态） | [08-memory-and-state](08-memory-and-state/) | 所有构建智能体的工程师 |
| LangGraph、CrewAI、Claude Code | [09-frameworks-and-tools](09-frameworks-and-tools/) | 实用工具选择 |
| 文档解析 | [10-document-processing](10-document-processing/) | 数据工程 / RAG 路径 |
| GPU 基础设施、LLMOps | [11-infrastructure-and-mlops](11-infrastructure-and-mlops/) | DevOps / 平台路径 |
| 多租户安全 | [12-security-and-access](12-security-and-access/) | 后端 / PM 路径 |
| Guardrails（护栏）、red teaming（红队测试） | [13-reliability-and-safety](13-reliability-and-safety/) | QA / 红队路径 |
| RAGAS、LangSmith、evals | [14-evaluation-and-observability](14-evaluation-and-observability/) | QA / PM / 所有角色 |
| 设计模式 | [15-ai-design-patterns](15-ai-design-patterns/) | 高级岗位准备 |
| 案例研究 | [16-case-studies](16-case-studies/) | 面试准备、参考设计 |
| Evals 深入解析 | [AI Evals Comprehensive Guide](ai_evals_comprehensive_study_guide.md) | QA / PM 路径 |
| AI Evals（LangWatch） | [AI Evals LangWatch Guide](ai_evals_complete_guide_langwatch_langfuse.md) | QA / Eval 工程路径 |
| 面试准备 | [00-interview-prep](00-interview-prep/) | 所有角色 |
| 课程 | [COURSES.md](COURSES.md) | 所有角色 |

---

## 📚 按角色推荐的入门课程

> 完整详情见 [COURSES.md](COURSES.md)

| 你的角色 | 第一门课程 | 第二门课程 | 第三门课程 |
|-----------|-------------|---------------|--------------|
| **后端** | 面向开发者的 ChatGPT Prompt Engineering（提示工程）（DL.AI，免费） | 构建与评估 RAG（检索增强生成）（DL.AI，免费） | LangGraph 中的 AI Agents（AI 智能体）（DL.AI，免费） |
| **前端** | 面向开发者的 ChatGPT Prompt Engineering（提示工程）（DL.AI，免费） | 使用 ChatGPT API 构建系统（DL.AI，免费） | 评估与调试 GenAI（生成式 AI）（DL.AI + W&B，免费） |
| **QA** | 本仓库中的 AI Evals Guide（AI 评估指南）（免费） | LLM Apps（大语言模型应用）的质量与安全（DL.AI，免费） | AI 评估 - Maven（Hamel + Shreya，付费） |
| **PM** | 面向所有人的 AI（Coursera，免费） | AI 评估指南第 3 章（免费） | AI 评估 - Maven（Hamel + Shreya，付费） |
| **DevOps** | 高效服务 LLMs（大语言模型）（DL.AI，免费） | 评估与调试 GenAI（生成式 AI）（DL.AI + W&B，免费） | 面向生产的 ML Engineering（机器学习工程）（Coursera） |
| **数据工程** | 构建与评估 RAG（检索增强生成）（DL.AI，免费） | 微调 LLMs（大语言模型）（DL.AI，免费） | 本仓库中的 AI 评估指南（免费） |
| **EM** | 使用 LLMs（大语言模型）的生成式 AI（Coursera） | LangGraph 中的 AI Agents（AI 智能体）（DL.AI，免费） | CS294 LLM 智能体（伯克利，免费） |

*DL.AI = DeepLearning.AI*

---

## 应避免的常见错误

1. **跳过基础知识** — 在理解 embedding（嵌入）是什么之前就直接使用 LangChain，会导致你写出无法调试的照搬式代码。

2. **先构建，后评估** — 没有衡量质量的方法就不要发布任何东西。在写第一个 prompt（提示词）之前，先定义你的 eval（评估）标准。

3. **复制提示词却不理解它们** — 提示词是工程决策。要理解每个元素为什么在那里。

4. **直到为时已晚才关注成本** — 每次 API 调用都有价格。从第一天起就构建成本跟踪。见 [02-model-landscape/03-pricing-and-costs.md](02-model-landscape/03-pricing-and-costs.md)。

5. **假设模型是瓶颈** — 在大多数生产级 AI 系统中，瓶颈是检索质量、提示词设计或数据质量。模型很少是真正的问题。

6. **在生产环境的模型版本字符串中使用 "latest"** — 固定精确版本。无声的模型更新会破坏你的产品。

7. **过度智能体化** — 当一次精心设计提示词的调用就能工作时，却从 5 智能体系统开始。先从简单做起，只在需要时增加复杂度。

---

## 如何获得录用

**公开构建。** AI 工程岗位市场奖励可展示的工作成果：

1. **GitHub 作品集** — 一个打磨完善的端到端项目胜过 10 个玩具项目
2. **写一篇博客文章** — 描述你解决过的一个真实问题以及解决方式（错误分析、评估流水线、RAG 延迟修复）
3. **为开源做贡献** — OpenHands、LlamaIndex、DSPy、RAGAS。即使是文档 PR 也能让你被注意到。
4. **使用本仓库的面试准备材料** — [00-interview-prep/01-question-bank.md](00-interview-prep/01-question-bank.md) 包含 80 道题，并配有高质量答案

**面试中该说什么：**
- 说出具体决策："我选择 Qdrant 而不是 Pinecone，是因为 X"（不要只说"我构建了一个 RAG 系统"）
- 引用你遇到过的 failure modes（故障模式）以及你如何修复它们
- 至少熟记一个 benchmark（基准测试）（SWE-bench、RAGAS 分数、你的服务部署配置的 TTFT）
- 展示你会思考评估和成本，而不只是功能

---

*属于 [AI 系统设计指南](README.md) 的一部分 — 由 [ombharatiya](https://github.com/ombharatiya) 维护*
