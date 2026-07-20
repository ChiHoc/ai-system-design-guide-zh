# OCR 与版面分析

传统的 OCR（Optical Character Recognition，光学字符识别）在很大程度上已被 **Native Multimodal LLMs（原生多模态大语言模型）**（Gemini 3.1 Pro、GPT-5.5、Claude Sonnet 4.6、Claude Opus 4.7）所取代。我们不再“读取字符”；我们“理解版面”。

## 目录

- [转变：传统 OCR 与 Vision-LLMs 对比](#转变-传统-ocr-与-vision-llms-对比)
- [Vision-LLM 版面提取](#vision-llm-版面提取)
- [阅读顺序与逻辑结构](#阅读顺序与逻辑结构)
- [处理低质量扫描件和手写内容](#处理低质量扫描件和手写内容)
- [成本与延迟权衡](#成本与延迟权衡)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 转变：传统 OCR 与 Vision-LLMs 对比

| 特性 | 传统 OCR（Tesseract/AWS Textract） | Vision-LLMs（Gemini 3.1 Pro、GPT-5.5、Claude Opus 4.7） |
|---------|-------------------------------------------|--------------------------------------------------------|
| **主要机制** | 字符识别 | 视觉 token 理解 |
| **逻辑** | 点线分析 | 语义上下文 |
| **阅读顺序** | 简单的自上而下 | 感知多栏、复杂版面 |
| **手写识别** | 较差 | 优秀（Human-level，接近人类水平） |
| **输出** | 文本块 + 边界框 | 结构化 Markdown/JSON |

---

## Vision-LLM 版面提取

标准工作流是 **Screenshot-to-Markdown**。
1. **Rasterize**：将 PDF 页面转换为图像。
2. **Visual Prompting**：要求视觉模型“将以下页面转录为 GitHub-flavored Markdown，并保留表格和标题。”
3. **Structured Recovery**：利用模型的空间感知能力重建逻辑层级。

---

## 阅读顺序与逻辑结构

> [!IMPORTANT]
> RAG（Retrieval-Augmented Generation，检索增强生成）中一个常见的失败是把段落跨栏拆开。  
> Vision-LLMs 通过“看到”栏间留白（column gutter）并正确排序文本来解决这个问题，而基于规则的解析器可能会直接横跨两栏读取。

---

## 处理低质量扫描件和手写内容

现代多模态模型对以下情况具有鲁棒性：
- **Skew/Rotation**：会在视觉注意力层中自动纠正。
- **Bleed-through**：模型利用语义上下文“忽略”来自页面背面的文本。
- **Handwritten Annotations**：可提取到单独的 `annotations` JSON 字段。

---

## 成本与延迟权衡

| 模型层级 | 用例 | 延迟 | 成本（1K 页） |
|------------|----------|---------|-----------------|
| **Gemini 3.1 Flash** | 高吞吐批处理 | 1-2 秒 / 页 | $1-3 |
| **GPT-5.5 / Claude Sonnet 4.6** | 高精度 / 法律 | 3-5 秒 / 页 | $8-18 |
| **本地（Llama 4 Vision）** | PII-sensitive（含个人身份信息敏感）/ 本地部署 | <1 秒 / 页 | 仅基础设施成本 |

---

## 面试题

### Q: 为什么在 vision LLM 存在的情况下，你仍然会使用 AWS Textract 或 Azure AI Search（OCR）？

**强答：**
**严格的空间元数据和合规性**。如果我的应用需要每个单词都拥有精确的像素级边界框（例如用于法律红action tool，红线脱敏工具），专用 OCR 引擎通常更精确且更便宜。此外，OCR 引擎是**确定性的**（Deterministic）：它们不会“幻觉”出不存在的单词。对于高风险文档处理，如果要求的是 100% 字符准确率，而不是“版面理解”，传统引擎在混合流水线中仍然占有一席之地。

### Q: 你如何高效处理一个 500 页的 PDF，使用 Vision LLMs？

**强答：**
我们使用 **Parallel Map-Reduce** 模式。 
1. **Map**：我们启动 50 个并行 worker（使用 AWS Lambda 或 Modal）来处理每 10 页。每个 worker 调用一个快速的 Vision 模型（如 Gemini 3 Flash）来获取 Markdown。
2. **Consolidate**：一个中央 agent 审查 Markdown 片段，以确保标题连续性。
3. **Cache**：我们将生成的 Markdown 存储在 vector DB 中。
这将处理时间从 30 分钟（顺序处理）缩短到 20 秒以内。

---

## 参考资料
- Google DeepMind. "Gemini 2.0: Understanding Multi-column Documents" (2025)
- OpenAI. "Vision Models for Document Understanding" (2025)
- Tesseract v6. "The Integration of Hybrid Transformer OCR" (2025)
