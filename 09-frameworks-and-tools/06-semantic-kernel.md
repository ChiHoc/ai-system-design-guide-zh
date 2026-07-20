# 语义内核（Semantic Kernel）

**Semantic Kernel（SK）** 是微软面向企业级 AI 编排（AI orchestration）的引擎。它仍然是坚持 **Azure/Microsoft 生态（Azure/Microsoft ecosystem）** 和 **C#/.NET** 架构的组织的主要桥梁，尽管其后续推进的许多内容现在已经整合进 **Microsoft Agent Framework**（AutoGen + SK 的统一继任者，RC 1.0 于 2026 年 2 月发布，GA 预计在 2026 年 Q2）。

## 目录

- [企业 DNA](#企业-dna)
- [插件与规划器](#插件与规划器)
- [记忆与连接器](#记忆与连接器)
- [多语言支持（C# vs. Python）](#多语言支持)
- [面试问题](#面试问题)
- [参考资料](#参考资料)

---

## <a id="dna"></a> 企业 DNA

虽然 LangChain 更受初创公司青睐，Semantic Kernel 更受 **银行和《财富》500 强企业** 青睐。
- **依赖注入（Dependency Injection）**：SK 遵循标准的企业设计模式。
- **强类型（Strong Typing）**：对 C# 类型的一等支持，使其在大规模、关键任务系统中高度可靠。
- **安全性（Security）**：与 Azure Active Directory（Microsoft Entra ID）和托管标识（Managed Identities）深度集成。

---

## <a id="plugins"></a> 插件与规划器

1. **Kernel 函数（Kernel Functions）**：逻辑的基本单元（原生代码或 LLM 提示词）。
2. **插件（Plugins）**：一组函数的集合（例如 “GitHub 插件” 或 “SQL 插件”）。
3. **规划器（Planners）**：SK 的规划器已经从简单的 ReAct 演进为**分层规划器（Hierarchical Planners）**，可以跨多天协调长期业务流程。

---

## <a id="memory"></a> 记忆与连接器

Semantic Kernel 使用 **连接器（Connectors）** 来抽象底层基础设施。
- **通用连接器（Universal Connectors）**：为 OpenAI、Mistral 和本地 Onyx 模型提供统一接口。
- **向量存储抽象（Vector Store Abstraction）**：无需更改核心业务逻辑，即可在 Azure AI Search、Pinecone 和 Qdrant 之间无缝切换。

---

## <a id="multi-language"></a> 多语言支持

SK 是少数将 C# 和 Python 视为平等语言的主流框架之一。
- **模式（The Pattern）**：先用 Python 开发和做原型，再将核心编排（core orchestration）部署到 C#，以获得性能和类型安全（type-safety）。
- **逻辑共享（Logic Sharing）**：共享可跨两种语言工作的提示词模板（prompt templates，.yaml）。

---

<a id="interview-questions"></a>

## 面试问题

### Q: 为什么高级工程师会选择 Semantic Kernel 而不是 LangChain？

**标准答案：**
**架构契合（Architectural Alignment）**。如果一个组织已经建立在 .NET/Azure 技术栈之上，Semantic Kernel 可以无缝融入其现有的 CI/CD、监控（App Insights）和安全（Entra ID）流水线。LangChain 往往给人一种“外部”技术的感觉。此外，SK 的**强类型（Strong Typing）**和**依赖注入（Dependency Injection）**模式，可以避免大型 LangChain 项目中常见的“意大利面式代码”。对于处理敏感金融数据的企业来说，**原生 Azure 集成（Native Azure integration）**在安全和审计方面是决定性因素。

### Q: Semantic Kernel 中的 “Function Calling” 抽象是什么？

**标准答案：**
SK 采用**基于插件的模型（Plugin-based model）**。每个函数（原生 C# 或基于 LLM 的函数）都会注册到 Kernel 中。当 LLM 认为自己需要某个工具时，Kernel 会在插件注册表（Plugin registry）中查找该函数，验证参数，并执行它。SK 现在支持**自动意图检测（Automatic Intent Detection）**：Kernel 可以基于当前上下文窗口（context window），在用户甚至还没提问之前，就主动建议可能需要的插件。

---

## <a id="references"></a> 参考资料
- Microsoft Learn. “Semantic Kernel 文档”（2025）
- Azure Architecture Center. “使用 Semantic Kernel 的 AI 设计模式”（2025）
- Build 2025. “SK 驱动的 Copilot 的未来”（2025 年大会回顾）

---

*下一篇：[AutoGen 和 CrewAI](07-autogen-crewai.md)*
