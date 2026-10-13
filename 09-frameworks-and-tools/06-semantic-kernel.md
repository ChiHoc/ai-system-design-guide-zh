# 语义内核（Semantic Kernel）

**Semantic Kernel（SK）** 是微软面向企业级 AI 编排的引擎，也是现有 **Azure/Microsoft** 和 **C#/.NET** AI 代码最常使用的框架。其后续发展重心已转向由原班团队构建的 **Microsoft Agent Framework（MAF）**，它是 AutoGen 和 SK 的继任者。MAF 1.0 已于 2026 年 4 月 2 日在 .NET 和 Python 上正式发布，提供长期支持，且大约每周更新一次（Python 1.19.0 于 9 月 18 日发布，.NET 1.23.0 于 2026 年 10 月 1 日发布）。SK 仍在更新（`semantic-kernel` 1.44.1 于 2026 年 8 月 6 日发布），微软也提供了从 SK 迁移到 MAF 的指南。

**实践准则**：维护现有 SK 代码，新智能体项目从 MAF 起步。下文的概念（Kernel 函数、插件、连接器、函数调用）会直接延续到 MAF。

## 目录

- [企业 DNA](#企业-dna)
- [插件与函数调用](#插件与函数调用)
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

## <a id="plugins"></a> 插件与函数调用

1. **Kernel 函数（Kernel Functions）**：逻辑的基本单元（原生代码或 LLM 提示词）。
2. **插件（Plugins）**：一组函数的集合（例如 “GitHub 插件” 或 “SQL 插件”）。
3. **规划由原生函数调用完成**：Stepwise 和 Handlebars 规划器已从 SK 的 Python、.NET 和 Java 版本弃用并移除（Microsoft Learn，2026 年 5 月 26 日更新）。自动函数调用（`FunctionChoiceBehavior.Auto()`）是规划机制：模型选择下一个函数，Kernel 调用它，然后循环。微软提供了 Stepwise Planner 迁移指南。

这是框架更迭的一个缩影。早期模型无法可靠地调用工具，因此需要基于提示词的规划器；原生工具调用出现后，这层抽象成了额外负担，最终被移除。需要跨越多天的长期流程应放在具备检查点能力的 MAF workflow 中，而非规划器里。

---

## <a id="memory"></a> 记忆与连接器

Semantic Kernel 使用 **连接器（Connectors）** 来抽象底层基础设施。
- **通用连接器（Universal Connectors）**：为 Azure OpenAI、OpenAI、Mistral 和本地 ONNX 模型提供统一接口。
- **向量存储抽象（Vector Store Abstraction）**：无需更改核心业务逻辑，即可在 Azure AI Search、Pinecone 和 Qdrant 之间切换。在 .NET 上，MAF 建立在相同的 `Microsoft.Extensions.AI` 聊天客户端抽象之上，可缩短迁移过程。

---

## <a id="multi-language"></a> 多语言支持

SK 是少数将 C# 和 Python 视为平等语言的主流框架之一（也支持 Java，但功能范围较小）。MAF 在 .NET 和 Python 上延续这一承诺，并新增公开预览的 Go 支持。
- **模式（The Pattern）**：先用 Python 开发和做原型，再将核心编排（core orchestration）部署到 C#，以获得性能和类型安全（type-safety）。
- **逻辑共享（Logic Sharing）**：共享可跨两种语言工作的提示词模板（prompt templates，.yaml）。

---

<a id="interview-questions"></a>

## 面试问题

### Q: 为什么高级工程师会选择 Semantic Kernel 而不是 LangChain？

**标准答案：**
**架构契合（Architectural Alignment）**。如果一个组织已经建立在 .NET/Azure 技术栈之上，微软技术栈可以融入其现有的 CI/CD、监控（App Insights）和安全（Entra ID）流水线。LangChain 往往给人一种“外部”技术的感觉。此外，**强类型（Strong Typing）**和**依赖注入（Dependency Injection）**模式，可以避免大型 LangChain 项目中常见的“意大利面式代码”。对于处理敏感金融数据的企业来说，**原生 Azure 集成（Native Azure integration）**在安全和审计方面是决定性因素。到 2026 年末，对于新项目，我会把选择表述为 **Microsoft Agent Framework 与 LangGraph 的比较**：MAF 已正式发布且提供长期支持，吸收了 SK 的企业能力，因此我会保留现有 SK 代码并规划迁移，而不以它启动新项目。

### Q: Semantic Kernel 中的 “Function Calling” 抽象是什么？

**标准答案：**
SK 采用**基于插件的模型（Plugin-based model）**。每个函数（原生 C# 或基于 LLM 的函数）都会注册到 Kernel 中，其 schema 作为工具提供给模型。当模型发出工具调用时，Kernel 在插件注册表中查找函数、验证参数、运行用于审批、日志或脱敏的**过滤器（filters）**，然后执行。使用 `FunctionChoiceBehavior.Auto()` 时，Kernel 会循环调用，直到模型停止使用工具；这也是旧规划器被移除的原因：原生函数调用本身就在完成规划。治理钩子是过滤器，因此敏感函数的人工审批和审计日志应放在这里。

---

## <a id="references"></a> 参考资料
- Microsoft Learn. “Semantic Kernel 简介”：https://learn.microsoft.com/en-us/semantic-kernel/overview/
- Microsoft Learn. “规划”（规划器弃用和移除；函数调用）：https://learn.microsoft.com/en-us/semantic-kernel/concepts/planning
- Microsoft. “Microsoft Agent Framework Version 1.0”（2026 年 4 月）：https://devblogs.microsoft.com/agent-framework/microsoft-agent-framework-version-1-0/

---

*下一篇：[Microsoft Agent Framework、CrewAI 与 Agent SDK](07-autogen-crewai.md)*
