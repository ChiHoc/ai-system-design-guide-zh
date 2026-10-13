# 面向 AI 的数据工程

模型的效果取决于输入给它的数据，而任何严肃 AI 系统中的大部分工作都发生在模型之前。本章覆盖同时服务于 **RAG** 和 **fine-tuning（微调）** 的 **data layer（数据层）**：数据摄入、清洗、去重、PII 与治理、质量过滤，以及把这些环节串起来的管道。之所以把它放在检索部分，是因为多数团队最先在 RAG 中遇到它，但它其实是**横向贯穿**的：为向量库准备文档的同一条管道，也在为微调准备样本。把数据工程当作“RAG 的第二步”会低估它；它是一门独立学科，而两类消费者都依赖它。

## 目录

- [共享管道](#共享管道)
- [摄入](#摄入)
- [清洗与标准化](#清洗与标准化)
- [去重](#去重)
- [PII、同意与治理](#pii、同意与治理)
- [质量过滤与增强](#质量过滤与增强)
- [管道与编排](#管道与编排)
- [用于微调的数据](#用于微调的数据)
- [失败模式](#失败模式)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 共享管道

核心思路是：一条管道，两个消费者。RAG 需要把文档解析、清洗、去重、切块、增强并嵌入。Fine-tuning（微调）需要把样本解析、清洗、去重、质量过滤、对齐到评测集去污染、平衡并格式化。前五个阶段是**共享**的；两者只在尾部开始分岔。

```
SOURCES        web · docs (PDF/office/email) · DBs/APIs · uploads
   |
[1] DETECT & ROUTE    MIME sniff -> language ID -> route by type
[2] PARSE / EXTRACT   typed elements + structure
[3] CLEAN / NORMALIZE boilerplate strip · encoding repair · unicode · language filter
[4] DEDUP             exact -> MinHash/LSH -> semantic (SemDeDup)
[5] GOVERN            PII detect/redact · license/consent/provenance metadata
[6] QUALITY FILTER    heuristics + model classifier  [always ablate on a downstream eval]
   |-- RAG branch ---------------------|   |-- FINE-TUNE branch ----------------|
   | [7a] chunk -> enrich -> embed     |   | [7b] curate/label -> synthesize    |
   |      -> VECTOR STORE (CDC-fresh)  |   |      -> decontaminate -> balance   |
   |-----------------------------------|   |      -> TRAINING RECORDS           |
CROSS-CUTTING   orchestration (Airflow/Dagster) · lineage (OpenLineage) · versioning (DVC/lakeFS)
```

“most of the work” 这种说法之所以经久不衰，是因为“实践者大约把 80% 的时间花在数据准备上”这个广泛引用的经验法则本质上属于 folklore-grade（民间经验级）：它在很多来源中反复出现，但并非经过测量得出；而厂商声称 AI agent 现在能将准备时间缩短 50-70% 的说法也未经验证且带有明显利益相关性。两者都应只作为方向性参考。

---

## 摄入

输入通常是一堆异构文件（PDF、扫描件、办公文档、HTML、邮件、图片）。你必须识别每个文件的类型，把它路由到正确的解析器，并输出标准化的结构化表示。

- **按内容而非扩展名检测文件类型。** 标准做法是通过 `libmagic`（Unix `file` 命令背后的库）进行 magic-number sniffing（魔数嗅探），并通过 `python-magic` 之类的绑定对外暴露。像 Unstructured 这样的解析器会按这种方式自动检测文件类型，并在必要时回退到扩展名。
- **语言检测** 用于路由和过滤，常见做法是使用 fastText 的语言分类器。
- **解析与路由。** 内容类型决定处理器：可直接提取文本的 PDF 走快速文本路径，扫描件或图像 PDF 走 OCR，复杂多栏或表格密集文档走布局模型或多模态（逐页截图）路径，办公文档走特定格式处理器，邮件则拆分为 headers 和 body。主流工具链包括 **Unstructured**（支持 64+ 种文件类型，输出 Title/NarrativeText/Table 等带类型的元素）、**Docling**（IBM 出品，MIT 许可证，包含布局和表格模型，支持多种导出格式，截至 2026 年 9 月还可插拔 NVIDIA Nemotron Parse 2.0、MinerU 2.5 Pro 等 VLM 后端）、**MinerU**，以及 **LlamaParse**（分层 API 模式，最高可到多模态 agentic parse）。一个教学重点：公开的 parser 基准结果并不一致，所以**应基于自己的文档做 parser 选择的基准测试**，而不是盲目相信排行榜。

### 把页面路由到能够胜任的最低成本层级

在语料库规模上，解析成本由**每 GPU 秒可处理的页数**决定，而非排行榜最高分。2026 年的模式是分层处理：先走廉价路径，只有质量检查失败的页面才升级。

| 层级 | 示例 | 成本与吞吐 | 用途 |
|---|---|---|---|
| 无模型 | MinerU 4.0 `flash` 层级、PDF 原生文本提取 | 仅 CPU | 数字原生 PDF 和办公文件 |
| 小型专用模型 | MinerU `basic`（OCR、公式和表格模型，可使用 CPU）；NVIDIA Nemotron Parse 2.0（参数少于 1B，OpenMDW-1.1） | 便宜，可自托管 | 布局简单的扫描件 |
| 解析 VLM | Cohere Parse `parse-v5.0`（2.3B，2026 年 8 月 27 日）：API 每 1,000 页 $1.50，单 GPU 每秒 4.5 页（厂商数据）；jina-ocr-v1（2026 年 9 月 14 日）：单张 A100 每秒 2.57 页，采用 CC BY-NC 4.0，未获许可不得商用 | 中等 | 表格、表单、多栏内容 |
| 前沿 VLM | GPT-6 Sol、Claude Opus 5.5、Gemini 3.8 Flash 等 | 每页成本最高 | 最难处理的剩余页面 |

各层级间的准确率差距小于价格差距：在 Cohere 自己运行的 ParseBench 上，Cohere Parse 平均得分 79.2，GPT-5.5 为 84.4，Claude Opus 4.8 为 84.3；后两者甚至在该结果发表时都不是各厂商的最新模型（厂商运行，依赖前应在当前模型上重测）。MinerU 4.0（2026 年 9 月 16 日）内置 `flash`、`basic`、`standard`、`advanced` 分层；可原生解析 DOCX、PPTX、XLSX、EPUB 和 HTML，无需转成 PDF；还会返回稳定的块定位符（`doc/tier/page/block`），让引用可验证，也让智能体能渐进读取文档，而非一次接收预先切好的片段。

---

## 清洗与标准化

共享的第一道质量门禁：

- **样板内容移除。** 去掉导航、广告、页眉、页脚、cookie 横幅。对于大规模 HTML，标准做法是使用内容提取库；FineWeb 项目发现，从原始网页归档中使用这类工具抽取内容，优于使用预抽取文本，因为后者“保留了太多样板”，所以这属于上游质量问题，而不是纯粹的美化。
- **编码修复**，包括 mojibake 和双重编码文本，以及行尾标准化。
- **Unicode 标准化**（NFC/NFKC），确保视觉上相同的字符串可以比较相等，这是去重和匹配能够正常工作的前提。
- **语言过滤**，剔除低于置信度阈值的内容。

一个反直觉但值得强调的 caveat（注意事项）：**更多过滤并不一定更好。** FineWeb 的消融实验发现，许多启发式规则的影响很小或有限（它删除了大多数收益过低的候选过滤器）；而 Nemotron-CC（arXiv:2412.02595）报告称，过于激进的启发式过滤会丢掉其自身质量分类器判定为高质量的约 18% token。过滤器必须结合下游评测做消融验证，而不能想当然地启用。

---

## 去重

去重是收益最大的阶段，也是“共享基础设施”最清晰的例子，因为它有三重回报。基础性研究（Lee et al., arXiv:2107.06499）表明，去重训练数据能让模型更少地吐出记忆文本，在更少步数内达到相同或更好的精度，而且更关键的是，**它减少了 train-test overlap（训练-测试重叠），所以去重也是去污染。** 它还通过减少重复 PII 的记忆来缓解隐私风险。

三个层级，按级联方式运行（先便宜且精确，最后昂贵且语义化）：
1. **精确**：对整篇文档或标准化子串做哈希。速度快且精确；只能捕获逐字复制。
2. **模糊 / 近重复**：**MinHash + LSH** 在 token n-gram shingles 上估计 Jaccard 相似度，并对候选分桶以避免全量两两比较（这是 web-scale 的默认方案；一些 vector DB 现在把它作为原生索引提供）。SimHash 是经典替代方案。注意：这些方法是**词法**的，所以内容模板相同但含义不同的文档可能会被误删。
3. **语义 / embedding 去重**：**SemDeDup**（arXiv:2303.09540）对每个条目生成 embedding，聚类后按余弦相似度删除簇内近重复项；它报告称在一个大规模图文数据集上移除了约 50% 的数据且性能损失很小，能够捕获 MinHash 漏掉的改写文本。

生产环境通常会把它们组合起来：先 MinHash，再 SemDeDup。要明确写出这三重收益：RAG（重复 chunk 浪费上下文窗口并挤占多样化证据）、训练（更少记忆、更少步数）以及评测完整性（对 benchmark 去重可防止污染）。

---

## PII、同意与治理

**PII 检测与脱敏。** Microsoft Presidio（MIT）是开源标准：Analyzer 通过 NER、正则、校验和和上下文词检测实体，Anonymizer 则可对文本、图片（含 OCR）和结构化数据执行脱敏、替换、掩码、哈希或加密，并可在语料级别部署。由于去重会减少由重复带来的记忆，因此隐私与去重是相互关联的。

**同意、许可与溯源** 现在已经是监管要求，而不仅仅是卫生性要求。按欧盟 AI Act，通用用途模型提供方必须保留版权政策，并使用 AI Office 的强制模板发布“足够详细的摘要”，说明训练内容，包括数据来源以及对版权 opt-out（拒绝授权）的尊重情况（这项摘要义务自 2025 年 8 月起适用于新的通用用途模型，已在市场上的模型则可延至 2027 年 8 月）。第 50 条透明度义务自 2026 年 8 月 2 日起适用；此前投放市场的生成式系统可在 2026 年 12 月 2 日前补上机器可读标识。对管道的治理含义是：每条记录从摄入开始就要携带 source、license、consent status 和 timestamp 作为元数据，这正是下面的 lineage（血缘）所提供的能力。治理不是最后一道关口；它是贯穿每个阶段的元数据。详见 [AI 治理与合规](../13-reliability-and-safety/04-ai-governance-and-compliance.md)。

**不仅记录许可证，也要记录数据如何取得。** 美国法院正在区分*训练*的合法性与*获取*的合法性。在 Bartz v. Anthropic（2025）案中，法院认定使用书籍训练属于合理使用，但没有将此结论扩展到使用盗版副本建立图书库；该案以 15 亿美元和解。2026 年 8 月，包括 Sony Music Publishing 和 Warner Chappell 在内的音乐出版商以相同的获取路径理论起诉 Anthropic，指控其通过种子下载含歌词和乐谱的书籍；与此同时，美国政府提交的意见书（2026 年 9 月 2 日报道）支持 OpenAI 在 The New York Times v. OpenAI 案中关于训练合理使用的立场。对管道而言，这意味着每个来源都要有**获取渠道**字段（授权信息源、遵守 robots 规则的抓取、购买、用户贡献、种子下载或影子图书馆），以便发现并移除受污染来源。补救成本高昂：Suno 的 v6（2026 年 9 月）在授权音乐上重新训练，该公司表示将退役旧模型。

**完全开放的发布使溯源可审计。** 多数开放权重模型只发布权重。MBZUAI 的 K2 Horizon 家族（2026 年 9 月 3 日，Apache 2.0，规模从 0.9B 到 375B-A23B）还发布训练数据（TxT360-v2 及预训练、中期训练数据集）、训练代码和中间检查点，因此可以对真实预训练语料运行污染检查，而非仅相信模型卡。

---

## 质量过滤与增强

**质量过滤** 分为两类。**启发式**规则（长度、符号/词比、重复率、停用词出现情况）很便宜，但无法捕捉复杂的内容噪声。**基于模型的分类器**可以对质量或教育价值打分；FineWeb-Edu 在 LLM 生成的质量标注上训练了一个轻量分类器，并报告了显著的下游收益，在使用更少 token 的情况下达到了更大语料的效果。需要警惕的是：分类器过滤不是免费的午餐（“data-quality illusion” 工作指出它可能校准失真），所以**一定要在下游 eval 上做消融，绝不要因为名气而相信它。**

**Chunking（切块）**（RAG 侧阶段）没有统一最优解：公开基准在 fixed-size、recursive、semantic 这些策略之间差异很大，因此它是数据集相关的，必须评估，而不能默认。见 [Chunking 策略](02-chunking-strategies.md)。

**增强与元数据。** 除了标准元数据（title、author、timestamp、source、section），还要附加生成的元数据（chunk summaries、上下文前缀、一个 chunk 能回答的合成问题），这样就能把单轴向量相似度变成多维过滤检索。见 [上下文检索](10-contextual-retrieval.md)。

**Lineage（血缘）。** OpenLineage（以 Marquez 为参考实现）是跟踪 run、job 和 dataset 事件的厂商中立标准；在 ML 场景中，它会把图继续向前延伸到 feature tables、models 和 predictions。结合数据版本管理（DVC、lakeFS、Delta/Iceberg time-travel），这就是让治理元数据可端到端审计的底座。

---

## 管道与编排

**批处理 vs 流式处理。** 预训练语料准备和大规模 RAG 索引构建都是 batch jobs（批任务），例如在对象存储上使用 Spark 或 Ray。RAG 的 **freshness（新鲜度）** 是增量式的：当源文档变化时，只重新摄入增量部分。Change Data Capture（CDC）会实时捕获源数据的行级变化，对 RAG 来说就是“检测发生变化、新增和删除的文档，只对这些文档重新解析并重新嵌入，然后在 vector store 中 upsert 或删除”，从而避免全量重建索引，并防止向量陈旧或成为孤儿数据。

**编排器。** Airflow 是生态最成熟的默认选择；Dagster 采用基于资产（asset-based）的模型，支持增量重算，适合增量式 RAG 重新嵌入；Prefect 是更轻量的 Pythonic 方案。Spark 和 Ray 是由编排器调度的分布式计算引擎，本身不是编排器。

**嵌入阶段正在移入存储系统。** MongoDB Atlas Automated Embedding（2026 年 8 月 13 日正式发布）会在写入新文档时生成嵌入，并用 Voyage 模型重新嵌入修改过的文档；turbopuffer 于 2026 年 9 月 29 日正式发布原生嵌入；Elasticsearch 的 `semantic_text` 则在摄取时嵌入。这样可从 DAG 中删除嵌入与 upsert 任务，把 CDC 新鲜度交给数据库。代价是模型版本由厂商掌控，模型变化会变成厂商安排的重新嵌入，而不再由你规划。在数据湖侧，Milvus 3.0（2026 年 7 月）可把 Parquet、Iceberg、Lance 和 Vortex 数据就地作为只读 External Collections 查询，并在线回填新列，因此使用新模型重新嵌入几亿行数据，可作为后台列填充完成，而非并行重建索引。

**向量库 vs 特征库。** 管道会在尾部岔开：RAG 将 chunk embeddings 和元数据写入 **vector store（向量库）**（检索的服务层），而 fine-tuning（微调）则将精选样本写入 **feature or training-record store（特征库或训练记录库）**，并保留 point-in-time correctness（时间点正确性）。两者都挂在同一条共享主干上。

---

## 用于微调的数据

与 RAG 分岔的尾部流程：
- **策展胜过规模。** 少量精心策展的样本往往胜过大量一般质量样本；质量三要素是难度、质量和多样性。（这里的“1,000 胜过 10,000”只是示例，不是定律。）
- **合成数据**（以 Self-Instruct 风格从少量种子样本经 teacher model（教师模型）扩展，再过滤）可以低成本扩容，但如果生成方式粗糙，会导致多样性塌缩和模型退化，因此多样性必须是一等目标。见 [合成数据生成](../03-training-and-adaptation/06-synthetic-data-generation.md)。
- **去污染是必须做的。** 被标记的结果（arXiv:2311.04850）指出，*改写或翻译*后的测试项会绕过 n-gram 去污染，而在这类数据上训练的模型会把 benchmark 过拟合到接近 frontier（前沿）水平。即便是由 frontier models（前沿模型）生成的合成数据，也被发现存在污染。规则是：要用 embedding 或 LLM-based matching（基于 embedding 或 LLM 的匹配）进行去污染，而不是只靠 n-gram 重叠，并且要在每次 eval 之前做，因为污染会悄悄抬高分数。见 [基准与排行榜](../14-evaluation-and-observability/03-benchmarks-and-leaderboards.md)。

---

## 失败模式

1. **相信文件扩展名**，而不是 magic-byte 检测（会导致解析器选错，输出静默垃圾）。
2. **用纯文本路径解析扫描版 PDF**（会得到空结果或部分结果；应把图像 PDF 路由到 OCR 或多模态路径）。
3. **每页都交给最贵的解析器**（按层级路由，仅在失败时升级；语料规模上的每页成本占主导）。
4. **从已经剥离过样板的 HTML 中抽取内容**（样板污染；应从原始内容使用内容提取工具抽取）。
5. **跳过 Unicode 标准化**（精确去重和匹配会悄悄漏掉重复项）。
6. **在错误层级做去重**（只靠 MinHash 会漏掉改写；应按精确、模糊、语义的顺序级联）。
7. **过度激进的启发式过滤**（Nemotron-CC 报告可丢掉约 18% 的高质量 token；每个过滤器都要做消融）。
8. **凭声誉相信质量分类器**（data-quality illusion；要做下游验证）。
9. **训练前没有做 PII 脱敏**（会记忆并复述 PII，而且重复越多越严重）。
10. **缺少许可、同意、溯源或获取渠道元数据**（语料无法审计，也不能满足训练内容摘要义务或隔离受污染来源）。
11. **评测污染，这个隐形杀手**（只用 n-gram 去污染会漏掉改写的测试项；应使用 embedding 或 LLM 去污染）。
12. **RAG 索引陈旧**（不用 CDC 而全量重建，成本暴涨、答案过时、产生孤儿向量）。
13. **默认切块策略错误**（基准不一致；要按数据集评估）。
14. **没有 lineage（血缘）**（数据集不可复现，回归难以定位；应从第一天起就输出血缘）。

---

## 面试题

### Q: 为什么去重是 AI 数据管道中最重要的阶段之一？

**强回答：**
因为一次操作就能带来三重收益。对训练来说，去重能降低记忆化程度（模型复读训练文本的次数更少），并且在更少步数内达到相同或更高精度，因此可以节省算力。对 RAG 来说，重复 chunk 会浪费上下文窗口并挤占多样化证据，从而损害检索质量。更关键的是，对 benchmark 去重本身也是去污染：基础研究发现，移除重复项也会移除夸大评测分数的 train-test overlap（训练-测试重叠）。在实践中，我会级联执行：先做精确哈希，再用 MinHash + LSH 做近重复检测，最后用语义 embedding 去重处理 MinHash 漏掉的改写，因为每一层都能覆盖更便宜一层做不到的情况。

### Q: 你如何确保评测结果不被数据污染影响？

**强回答：**
陷阱在于，简单的 n-gram decontamination（去污染）远远不够。一项著名结果表明，改写或翻译版本的测试题会直接绕过 n-gram 匹配，而一旦模型在这些数据上训练，就可能把某个 benchmark 过拟合到接近 frontier（前沿）的分数，甚至连强模型生成的合成数据也曾被发现存在污染。所以我会使用语义方法：embedding 相似度检索加上 LLM adjudicator（LLM 裁决器），而不是只做字符串重叠，并且在每次评测前对所有 eval 集都运行一次去污染。更广泛地说，我更倾向于使用留出集（held-out）或新发布的测试集；在可能的情况下，把任何 benchmark 都视为可能已被污染，并在关键决策上依赖自己的 gold data（黄金数据），因为那是我最有把握保证模型没见过的数据集。

---

### Q: 你要为 RAG 解析 500 万页混合的数字原生 PDF、扫描件与办公文件。如何兼顾成本设计处理流程？

**强回答：**
我会按层级路由，并以每 GPU 秒处理页数为核心指标。先根据内容检测类型，把数字原生 PDF 和办公文件送入无模型路径（原生文本提取；MinerU 的 `flash` 层级也使用这种方式），这通常覆盖企业语料的大部分。扫描件进入小型自托管 OCR 与布局模型。只有未通过廉价质量检查的页面（空文本、损坏的表格、低 OCR 置信度、错乱的阅读顺序）才升级到解析 VLM，仍失败的剩余页面才交给前沿 VLM。

假设每页约有 1,500 个输入 token 和 800 个输出 token，且不产生推理 token，成本可这样计算：Cohere Parse 每 1,000 页 $1.50，全部 500 万页为 $7,500；GPT-6 Sol（每 100 万输入/输出 token 为 $2/$10）每页约 $0.011，总计约 $55,000；Claude Opus 5.5（$4/$20）至少是其两倍，因为无法关闭思考。然而专用解析器在厂商运行的 ParseBench 上，仅比旧一代前沿模型（GPT-5.5、Opus 4.8）低约 5 分。前沿家族中的低价模型打破了简单的成本阶梯：GPT-6 Luna（$0.10/$0.50）每页约 $0.0006，整批约 $2,750，低于解析 API，因此它也应与专用模型一同进入基准测试；未知的是它在表格与扫描件上能否保持质量。

专用 GPU 又会改变计算结果：按 Cohere 报告的单 GPU 每秒 4.5 页，500 万页约需 300 个 GPU 小时。正因如此，Cohere 声称其单租户 Model Vault 部署在 50% 利用率下比 API 低 23%（厂商报告）。自托管前还应检查许可证（jina-ocr-v1 使用 CC BY-NC），保留块级定位符，使引用指向页和块，并在设定路由阈值前，先用自己的数百页文档对每个层级做基准测试。

---

## 参考资料

- Lee et al.，《Deduplicating Training Data Makes Language Models Better》arXiv:2107.06499
- Abbas et al.，《SemDeDup》arXiv:2303.09540
- Penedo et al.，《The FineWeb Datasets》arXiv:2406.17557
- Yang et al.，《Rethinking Benchmark and Contamination ... with Rephrased Samples》arXiv:2311.04850
- Microsoft, [Presidio](https://github.com/microsoft/presidio)
- [Unstructured](https://www.unstructured.io/)、[Docling](https://github.com/docling-project/docling)、[OpenLineage](https://openlineage.io/)
- [MinerU 4.0 发布说明（2026 年 9 月）](https://github.com/opendatalab/MinerU/releases/tag/mineru-4.0.0-released)
- [Cohere，“Parse”（2026 年 8 月）](https://cohere.com/blog/parse)
- [MBZUAI K2 Horizon 375B-A23B 模型卡](https://huggingface.co/IFM/K2-Horizon-375B-A23B)

---

*上一篇：[大规模生产 RAG](14-production-rag-at-scale.md) | 下一篇：[Agent 基础](../07-agentic-systems/01-agent-fundamentals.md)*
