# 🎓 推荐 AI 课程与学习路径

一份为 AI 工程师、ML（机器学习）从业者和产品团队精选的**可靠、可信且保持更新**的线上课程清单。这里的每门课程都已在**2026 年 5 月**验证，去掉了鸡汤内容，也去掉了过时的 MOOC 课程。

> **代码陈旧性说明（Code staleness）**：这些课程按其*概念*进行筛选。它们所使用的框架 API（如 LlamaIndex、LangChain）更新很快，任何录制课程中的 notebook 代码都会迅速过时，在全新安装环境中可能运行失败。复制粘贴前，请先在 [Navigating Framework Churn](09-frameworks-and-tools/12-navigating-framework-churn.md) 中完成 30 秒的时效性检查，并学习原语（primitives），而不是导入路径。

---

## 目录

- [基础：LLM 与 Transformers](#基础-llm-与-transformers)
- [RAG 流程](#rag-流程)
- [Agentic AI 与多智能体系统](#agentic-ai-与多智能体系统)
- [上下文与记忆管理](#上下文与记忆管理)
- [AI 评估与可观测性](#ai-评估与可观测性)
- [提示工程与上下文工程](#提示工程与上下文工程)
- [微调与适配](#微调与适配)
- [推理优化与 MLOps](#推理优化与-mlops)
- [AI 安全与护栏（Guardrails）](#ai-安全与护栏-guardrails)
- [编程代理与开发者 AI 工具](#编程代理与开发者-ai-工具)
- [面向 PM 与非工程师](#面向-pm-与非工程师)
- [YouTube 频道与免费内容](#youtube-频道与免费内容)
- [学习路径建议](#学习路径建议)

---

## 基础：LLM 与 Transformers <a name="foundation"></a>

| 课程 | 机构 | 费用 | 可信原因 |
|--------|----------|------|-----------------|
| **[Neural Networks: Zero to Hero（神经网络：从零到英雄）](https://www.youtube.com/playlist?list=PLAqhIrjkxbuWI23v9cThsA9GvCAUhRvKZ)** | Andrej Karpathy（YouTube） | 免费 | OpenAI/Tesla 传奇人物打造的从零开始系列，直接构建 GPT。 |
| **[CS324：Large Language Models（大语言模型）](https://stanford-cs324.github.io/winter2022/)** | Stanford | 免费 | 斯坦福级别课程笔记，覆盖 LLM 基础、扩展律（scaling laws）与对齐（alignment）。 |
| **[Generative AI with LLMs（基于 LLM 的生成式 AI）](https://www.coursera.org/learn/generative-ai-with-llms)** | DeepLearning.AI + AWS（Coursera） | ~\$50 | 面向 LLM 的实操入门，涵盖训练、微调、RLHF（来自人类反馈的强化学习）。由 Andrew Ng 团队提供。 |
| **[Practical Deep Learning for Coders（面向开发者的实用深度学习）](https://course.fast.ai/)** | fast.ai | 免费 | 自底向上、代码优先的方法。最适合通过动手实践学习的工程师。 |

---

## RAG 流程 <a name="rag"></a>

| 课程 | 机构 | 费用 | 可信原因 |
|--------|----------|------|-----------------|
| **[Building and Evaluating Advanced RAG（构建与评估高级 RAG）](https://www.deeplearning.ai/short-courses/building-evaluating-advanced-rag/)** | DeepLearning.AI + LlamaIndex | 免费 | 涵盖 sentence-window retrieval、auto-merging，以及结合 TruLens 的 RAG 评估。 |
| **[Vector Databases: from Embeddings to Applications（向量数据库：从 Embeddings 到应用）](https://www.deeplearning.ai/short-courses/vector-databases-embeddings-applications/)** | DeepLearning.AI + Weaviate | 免费 | 对 embeddings、向量存储和混合检索（hybrid search）的实操讲解。 |
| **[Building RAG Agents with LLMs（使用 LLM 构建 RAG Agents）](https://courses.nvidia.com/courses/course-v1:DLI+S-FX-15+V1/)** | NVIDIA Deep Learning Institute | 免费 | 企业级 RAG，使用 NVIDIA NIM。涵盖分块（chunking）、重排序（reranking）与评估。 |
| **[LlamaIndex — Documentation: Learning（文档：学习）](https://docs.llamaindex.ai/en/stable/understanding/)** | LlamaIndex | 免费 | 官方 LlamaIndex 学习路径，是深入掌握 RAG 流水线的最佳入口。 |
| **[RAG Fundamentals (Haystack)](https://haystack.deepset.ai/tutorials)** | deepset / Haystack | 免费 | 基于 Haystack 框架的 pipeline 式 RAG 实操教程。 |

---

## Agentic AI 与多智能体系统 <a name="agents"></a>

| 课程 | 机构 | 费用 | 可信原因 |
|--------|----------|------|-----------------|
| **[AI Agents in LangGraph（LangGraph 中的 AI Agent）](https://www.deeplearning.ai/short-courses/ai-agents-in-langgraph/)** | DeepLearning.AI + LangChain | 免费 | 由创建者本人讲授的 LangGraph 课程。涵盖 ReAct、持久化、人类在环（human-in-the-loop）和多智能体。 |
| **[Multi AI Agent Systems with crewAI（crewAI 多智能体系统）](https://www.deeplearning.ai/short-courses/multi-ai-agent-systems-with-crewai/)** | DeepLearning.AI + crewAI | 免费 | 官方 CrewAI 课程。涵盖 Crews、Flows 以及真实世界的业务自动化。 |
| **[Building Agentic RAG with LlamaIndex（使用 LlamaIndex 构建 Agentic RAG）](https://www.deeplearning.ai/short-courses/building-agentic-rag-with-llamaindex/)** | DeepLearning.AI + LlamaIndex | 免费 | 路由、工具调用型 Agent，以及多文档 agentic 检索。 |
| **[Functions, Tools and Agents with LangChain（使用 LangChain 的函数、工具与 Agent）](https://www.deeplearning.ai/short-courses/functions-tools-agents-langchain/)** | DeepLearning.AI + LangChain | 免费 | 工具调用、OpenAI function calling（函数调用）以及从零构建。 |
| **[Developing AI Agents using AutoGen（使用 AutoGen 开发 AI Agent）](https://www.deeplearning.ai/short-courses/ai-agentic-design-patterns-with-autogen/)** | DeepLearning.AI + Microsoft | 免费 | AutoGen 多智能体模式。涵盖辩论（debate）、工具使用（tool-use）和代码执行 Agent。 |
| **[CS294/194-196：LLM Agents（Berkeley）](https://rdi.berkeley.edu/llm-agents/f24)** | UC Berkeley | 免费 | 研究生级别的 LLM Agent 课程。涵盖记忆、规划、安全与评估。 |

---

## 上下文与记忆管理 <a name="context-memory"></a>

| 课程 | 机构 | 费用 | 可信原因 |
|--------|----------|------|-----------------|
| **[Building Systems with the ChatGPT API（使用 ChatGPT API 构建系统）](https://www.deeplearning.ai/short-courses/building-systems-with-chatgpt/)** | DeepLearning.AI + OpenAI | 免费 | 涵盖多轮对话状态、上下文管理和审核链（moderation chains）。 |
| **[Prompt Engineering with Llama 2（基于 Llama 2 的提示工程）](https://www.deeplearning.ai/short-courses/prompt-engineering-with-llama-2/)** | DeepLearning.AI + Meta | 免费 | 展示上下文窗口权衡，以及 Llama 2 的 system prompt（系统提示词）管理。 |
| **[Reasoning with o1（使用 o1 推理）](https://www.deeplearning.ai/short-courses/reasoning-with-o1/)** | DeepLearning.AI + OpenAI | 免费 | 深入讲解 o1 推理、token 预算和 thinking modes。可直接迁移到 o3 与 Claude 3.7 Extended Thinking。 |
| **[Mem0 Documentation（Mem0 官方文档）](https://docs.mem0.ai/)** | Mem0（官方） | 免费 | 生产级多层记忆（multi-tier memory）Agent 的权威参考。 |

---

## AI 评估与可观测性 <a name="evals"></a>

| 课程 | 机构 | 费用 | 可信原因 |
|--------|----------|------|-----------------|
| **[Evals for AI：Maven 课程](https://maven.com/hamel-shreya/evals-for-ai)** | Hamel Husain & Shreya Shankar（Maven） | 付费（约 \$400） | AI 评估的行业金标准之一。已被数十家公司用于生产环境。本仓库的 Evals 指南基于这门课程。 |
| **[Evaluating and Debugging Generative AI（评估与调试生成式 AI）](https://www.deeplearning.ai/short-courses/evaluating-debugging-generative-ai/)** | DeepLearning.AI + W&B | 免费 | 涵盖追踪（tracing）、使用 W&B Weave 进行评估，以及实验追踪。 |
| **[Quality and Safety for LLM Applications（LLM 应用的质量与安全）](https://www.deeplearning.ai/short-courses/quality-safety-llm-applications/)** | DeepLearning.AI + WhyLabs | 免费 | 涵盖幻觉检测、毒性、偏差评估和漂移监控。 |
| **[LangSmith Evaluation Tutorials（LangSmith 评估教程）](https://docs.smith.langchain.com/evaluation)** | LangChain | 免费 | 如果你使用 LangChain 生态，官方 LangSmith 文档是最好的实操评估参考。 |
| **[Phoenix + Langfuse official docs](https://docs.arize.com/phoenix)** | Arize Phoenix | 免费 | 使用 Phoenix 的开源评估实操教程。 |

> 📖 另见本仓库的配套指南：
> - [AI Evals：Comprehensive Study Guide (Phoenix + Langfuse)](ai_evals_comprehensive_study_guide.md)
> - [AI Evals：LangWatch + Langfuse Guide](ai_evals_complete_guide_langwatch_langfuse.md)

---

## 提示工程与上下文工程 <a name="prompting"></a>

| 课程 | 机构 | 费用 | 可信原因 |
|--------|----------|------|-----------------|
| **[ChatGPT Prompt Engineering for Developers（面向开发者的 ChatGPT 提示工程）](https://www.deeplearning.ai/short-courses/chatgpt-prompt-engineering-for-developers/)** | DeepLearning.AI + OpenAI | 免费 | 提示工程的基础课程。由 Isa Fulford 与 Andrew Ng 共同制作。 |
| **[Prompting Fundamentals（Anthropic）](https://www.anthropic.com/learn)** | Anthropic | 免费 | 直接来自 Claude 团队。涵盖提示设计、XML 标签和 chain-of-thought（思维链）。 |
| **[DSPy: Building Optimizable Pipelines（DSPy：构建可优化流水线）](https://github.com/stanfordnlp/dspy)** | Stanford NLP（GitHub） | 免费 | 这不是传统课程，但 DSPy 仓库中的 notebooks 是学习程序化提示的最佳方式。 |
| **[Prompt Engineering Guide（提示工程指南）](https://www.promptingguide.ai/)** | DAIR.AI | 免费 | 全面、社区维护的参考资料，覆盖所有主流提示工程技术。 |

---

## 微调与适配 <a name="finetuning"></a>

| 课程 | 机构 | 费用 | 可信原因 |
|--------|----------|------|-----------------|
| **[Finetuning Large Language Models（大语言模型微调）](https://www.deeplearning.ai/short-courses/finetuning-large-language-models/)** | DeepLearning.AI + Lamini | 免费 | 涵盖 LoRA、全量微调、数据集准备和评估。简洁而实用。 |
| **[Reinforcement Learning from Human Feedback（来自人类反馈的强化学习）](https://www.deeplearning.ai/short-courses/reinforcement-learning-from-human-feedback/)** | DeepLearning.AI + AWS | 免费 | RLHF 深度剖析：奖励模型、PPO 和偏好数据集。 |
| **[Hugging Face NLP Course（Hugging Face NLP 课程）](https://huggingface.co/learn/nlp-course/chapter1/1)** | Hugging Face | 免费 | 在 Hugging Face 生态中微调 transformers 的最佳免费课程（Trainer、PEFT 等）。 |
| **[How Diffusion Models Work（扩散模型如何工作）](https://www.deeplearning.ai/short-courses/how-diffusion-models-work/)** | DeepLearning.AI | 免费 | 面向图像模型微调（Stable Diffusion、用于图像的 LoRA）。 |

---

## 推理优化与 MLOps <a name="mlops"></a>

| 课程 | 机构 | 费用 | 可信原因 |
|--------|----------|------|-----------------|
| **[ML Engineering for Production (MLOps)（面向生产环境的机器学习工程）](https://www.coursera.org/specializations/machine-learning-engineering-for-production-mlops)** | DeepLearning.AI（Coursera） | 付费 | 4 门课的生产级机器学习专项：部署、监控、流水线。 |
| **[Efficiently Serving LLMs（高效服务 LLM）](https://www.deeplearning.ai/short-courses/efficiently-serving-llms/)** | DeepLearning.AI + Predibase | 免费 | 涵盖 vLLM、PagedAttention、量化和 LoRA Serving。正是本指南关注的内容。 |
| **[vLLM Documentation & Tutorial（vLLM 文档与教程）](https://docs.vllm.ai/en/latest/)** | vLLM | 免费 | 官方 vLLM 文档是高吞吐服务的最及时参考。 |

---

## AI 安全与护栏（Guardrails）<a name="safety"></a>

| 课程 | 机构 | 费用 | 可信原因 |
|--------|----------|------|-----------------|
| **[Red Teaming LLM Applications（LLM 应用红队演练）](https://www.deeplearning.ai/short-courses/red-teaming-llm-applications/)** | DeepLearning.AI + Giskard | 免费 | 实操红队演练，涵盖提示注入、越狱检测、偏见测试。 |
| **[AI Safety Fundamentals（AI 安全基础）](https://aisafetyfundamentals.com/alignment-fast-track/)** | BlueDot Impact | 免费 | 最值得信赖的 AI 对齐与安全免费课程之一。被 Anthropic、DeepMind 等机构的从业者使用。 |
| **[NVIDIA AI Red Team (NEMO Guardrails)](https://github.com/NVIDIA/NeMo-Guardrails)** | NVIDIA | 免费 | 用于构建生产级护栏的 NeMo Guardrails 实操 notebooks。 |

---

## 编程代理与开发者 AI 工具 <a name="coding-agents"></a>

| 课程 | 机构 | 费用 | 可信原因 |
|--------|----------|------|-----------------|
| **[Claude Code — 官方文档](https://docs.anthropic.com/en/home)** | Anthropic | 免费 | Claude Code 的权威起点。涵盖 CLAUDE.md、SDK 和权限。 |
| **[Building Code Agents（Hugging Face）](https://huggingface.co/learn/agents-course/unit1/introduction)** | Hugging Face | 免费 | Hugging Face 官方 Agent 课程，包含构建代码执行 Agent 的单元。 |
| **[Introduction to OpenHands（OpenHands 入门）](https://github.com/All-Hands-AI/OpenHands/blob/main/docs/getting-started.md)** | All-Hands AI | 免费 | OpenHands 自主编码 Agent 的官方入门指南。 |

> 📖 另见本仓库指南：[Claude Code 指南](09-frameworks-and-tools/09-claude-code.md) 和 [OpenCoder Landscape](09-frameworks-and-tools/10-opencoderguide.md)

---

## 面向 PM 与非工程师 <a name="pm-track"></a>

这些课程不要求 Python 经验：

| 课程 | 机构 | 费用 | 优势 |
|--------|----------|------|--------------|
| **[AI for Everyone（人人都能学 AI）](https://www.coursera.org/learn/ai-for-everyone)** | DeepLearning.AI（Coursera） | 免费 | Andrew Ng 为非技术岗位设计。涵盖 AI 能做什么/不能做什么，以及项目管理。 |
| **[Prompt Engineering for Everyone（人人都能学提示工程）](https://learnprompting.org/)** | Learn Prompting | 免费 | 面向非工程师的通俗提示工程指南。 |
| **[Evals for AI（Maven）](https://maven.com/hamel-shreya/evals-for-ai)** | Hamel Husain & Shreya Shankar | 付费 | 虽然包含代码，但课程面向 PM 和 QA 设计，而不只是工程师。强烈推荐。 |
| **[AI Product Management（AI 产品管理）](https://www.productschool.com/blog/product-management/ai-product-manager/)** | Product School | 免费（博客） | 为构建 AI 驱动产品的 PM 提供实操指南。 |
| **[Google：Introduction to Generative AI（Google 生成式 AI 入门）](https://cloud.google.com/learn/training/machinelearning-ai)** | Google Cloud Skills Boost | 免费 | 无代码入门生成式 AI、LLM 和负责任 AI。 |

---

## YouTube 频道与免费内容 <a name="free"></a>

| 频道 / 资源 | 聚焦 | 关注原因 |
|-------------------|-------|------------|
| **[Andrej Karpathy](https://www.youtube.com/@AndrejKarpathy)** | 基础、transformers | 对 LLM 实际工作原理的最佳讲解 |
| **[Yannic Kilcher](https://www.youtube.com/@YannicKilcher)** | 论文点评 | 清晰讲解最新 ML 研究论文 |
| **[Aleksa Gordić - The AI Epiphany](https://www.youtube.com/@TheAIEpiphany)** | 论文点评 | 深度技术论文拆解 |
| **[AI Jason](https://www.youtube.com/@AIJasonZ)** | Agent、LangChain、实践 | 非常适合作为 agentic 框架入门的视频来源 |
| **[Sam Witteveen](https://www.youtube.com/@samwitteveenai)** | Gemini、RAG、Agent | 最优秀的实战向 AI YouTuber 之一 |
| **[Matt Wolfe](https://www.youtube.com/@mreflow)** | AI 新闻、产品演示 | 跟进 AI 新闻和工具动态的最佳渠道 |
| **[Hamel Husain（博客）](https://hamel.dev/)** | Evals、生产级 AI、LLM | 来自 evals Maven 课程作者的真实生产经验 |
| **[Simon Willison（博客）](https://simonwillison.net/)** | LLM 新闻、工具、编程 | 最值得信赖的每日 AI 新闻来源 |
| **[The Latent Space podcast](https://www.latent.space/)** | 技术 AI 访谈 | 最好的技术 AI 播客之一，与研究者深度对谈 |
| **[Lex Fridman Podcast](https://lexfridman.com/podcast/)** | 宽泛的 AI/ML 访谈 | 与领先 AI 研究者的长篇访谈 |

---

## 学习路径建议 <a name="paths"></a>

### 🛤️ 路径："我是 AI 新手，想快速做出东西"

```
Week 1: Prompt Engineering for Developers (DeepLearning.AI) — free, 2 hrs
Week 2: Building Systems with ChatGPT API (DeepLearning.AI) — free, 2 hrs
Week 3: Building and Evaluating Advanced RAG (DeepLearning.AI) — free, 2 hrs
Week 4: AI Agents in LangGraph (DeepLearning.AI) — free, 4 hrs
Month 2: Pick a real project, use this guide as reference
```

### 🛤️ 路径："我想深入理解 LLM"

```
Week 1-3: Neural Networks: Zero to Hero (Karpathy) — free, 12+ hrs
Week 4-6: CS324 Stanford LLMs — free, 30+ hrs
Month 2: Generative AI with LLMs (Coursera DeepLearning.AI)
Month 3: CS294 LLM Agents (Berkeley)
```

### 🛤️ 路径："我想构建可用于生产的 AI 评估"

```
Week 1: Evaluating and Debugging Generative AI (DeepLearning.AI + W&B) — free
Week 2: This repo's evals guides (Phoenix/Langfuse) — free  ← start here
Week 3-4: Quality and Safety for LLM Applications (DeepLearning.AI)
Month 2: Evals for AI (Maven, Hamel + Shreya) — paid, worth it
```

### 🛤️ 路径："我是 PM，想为 AI 产品质量做出贡献"

```
Week 1: AI for Everyone (Coursera) — free
Week 2: Prompt Engineering for Everyone (learnprompting.org) — free
Week 3: AI Evals guide in this repo — free (especially Chapters 1-3 on error analysis)
Month 2: Evals for AI (Maven) — paid, has PM track
```

### 🛤️ Path: "我想在我的团队中部署 coding agents"

```
Day 1: Claude Code docs (anthropic.com) — free
Week 1: This repo's Claude Code Guide + OpenCoder Landscape Guide
Week 2: Building Code Agents (Hugging Face) — free
Month 1: Run Claude Code on a real project in CI
```

---

## 如何保持最新

AI 发展很快。除了课程之外，这些习惯能帮助你保持最新：

1. **关注 Simon Willison 的博客** — 每日、可信的 AI 新闻摘要
2. **阅读 Anthropic + OpenAI 的发布说明（release notes）** — 第一手来源胜过二手摘要
3. **收听 Latent Space 播客（podcast）** — 技术深度最佳
4. **为开源（open source）做贡献** — OpenHands、LlamaIndex、DSPy — 真正的学习发生在 PR（Pull Request）中
5. **给这个仓库点 Star** — 我们会随着格局变化持续更新它 ⭐

---

*由 [Om Bharatiya](https://github.com/ombharatiya) 维护。欢迎为新增课程内容提交 PR！*
