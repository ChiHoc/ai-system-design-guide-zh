# 贡献

感谢你帮助保持本指南准确且有用。它是面向生产环境 AI systems（人工智能系统）和 interview prep（面试准备）的动态参考，因此基于真实世界实践的贡献尤其受欢迎。

## 你可以贡献什么

高价值的补充包括：

- 具有 staff-level depth（资深层级深度）和完整解答的**面试问题（Interview questions）**。
- 你遇到的**生产故障模式（Production failure modes）**，以及你如何诊断并修复它们。
- 已确认、已公开发布模型的**模型基准测试（Model benchmarks）**和定价更新。
- 对任何过时、含糊或错误内容的**更正（Corrections）**。
- 具有具体权衡（tradeoffs）的**新模式（New patterns）**（如 RAG、agents、MCP、评测流水线（eval pipelines）、多租户隔离（multi-tenant isolation））。

## 如何提议修改

1. Fork 仓库并从最新的 `main` 创建一个分支。
2. 用有明确边界的聚焦提交（focused commits）完成你的修改。
3. 提交一个描述“发生了什么以及原因”的拉取请求（pull request）。对任何新的模型（model）、价格（price）或基准（benchmark）主张，请链接来源。

对于小修改（拼写错误、失效链接、过时数字），直接 PR 就可以。对于较大的新增内容（如新章节或案例研究），请先开一个 issue，以便我们对范围达成一致。

## 风格约定

- **不使用 em dash（长破折号）**。请改用逗号、括号或改写。这一规则适用于正文、提交信息（commit message）和代码注释（code comments）。
- **只使用已确认上线的模型（confirmed-real models）**。只引用实际已公开发布的模型，不要编造模型名称、版本、价格或基准数值。引用定价或能力时，请链接来源。
- **约定式提交（Conventional commits）**。使用类似 `docs: fix broken links in case studies` 或 `feat(retrieval): add ColBERT reranking notes` 的信息，每条消息对应一个逻辑变更。
- **匹配上下文语气**。观点明确、具体，并关注权衡。优先使用具体数字（numbers）和具体工具（named tools），而不是供应商中性模糊表述。
- **保持链接为相对路径（relative links）**并在提交 PR 前确认其可访问（resolve）。

## 质量标准

- 保持准确（accurate）。如果不确定，请明确说明或先不写。
- 讲清楚细节（concrete）。列明模型、指标（metric）、故障模式（failure mode）和成本。
- 保持时效（current）。本指南反映真实上线内容，因此请标记已过时的信息。

通过贡献，你同意你的贡献将依据 [MIT License](LICENSE) 授权。
