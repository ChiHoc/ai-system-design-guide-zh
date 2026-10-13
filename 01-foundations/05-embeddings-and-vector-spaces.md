# Embedding 与向量空间

Embedding（向量嵌入）是文本的稠密向量表示，用于捕捉语义含义。它们是 RAG（Retrieval-Augmented Generation，检索增强生成）系统、语义检索以及众多 AI 应用的基础。

## 目录

- [什么是 Embedding](#什么是-embedding)
- [Embedding 模型架构](#embedding-模型架构)
- [训练目标](#训练目标)
- [距离度量](#距离度量)
- [Embedding 模型对比](#embedding-模型对比)
- [Matryoshka 与自适应维度](#matryoshka-与自适应维度)
- [Late Chunking 与 Late Interaction](#late-chunking-与-late-interaction)
- [规模化量化](#规模化量化)
- [实践注意事项（批处理、缓存）](#实践注意事项)
- [Embedding 漂移与版本控制](#embedding-漂移与版本控制)
- [面试题](#面试题)
- [参考资料](#参考文献)

---

## 什么是 Embedding

Embedding 将离散文本（单词、句子、文档）映射到连续向量空间，其中语义相似性对应几何接近性。

**关键特性：**
- 含义相近的文本彼此接近
- 关系可以用向量运算编码（king - man + woman = queen）
- 通过近似最近邻（approximate nearest neighbor，ANN）算法实现高效相似性搜索

**认知模型：**
可以把 embedding 看作高维空间中的坐标。维度（512 到 4096）提供表达能力。每个维度捕捉语义的某个方面，但单个维度通常不可解释。

---

## Embedding 模型架构

### 词向量（历史方法）

早期方法会为单个单词生成 embedding：

| 模型 | 年份 | 方法 | 局限 |
|-------|------|----------|------------|
| Word2Vec | 2013 | Skip-gram, CBOW | 静态：`bank` 在所有上下文中都相同 |
| GloVe | 2014 | 共现矩阵 | 静态 |
| FastText | 2017 | 子词 embedding | 静态，但可处理 OOV |

**核心限制：** 同一个词在不同上下文中会得到相同的 embedding。

### 上下文 Embedding

基于 Transformer 的模型会生成上下文相关的 embedding：

```python
# Static embedding (Word2Vec)
embed("bank") = [0.1, 0.3, ...]  # Same vector always

# Contextual embedding (BERT)
embed("river bank") = [0.1, 0.3, ...]   # Geography sense
embed("bank account") = [0.5, 0.2, ...]  # Finance sense
```

### 句子/文档 Embedding

用于检索时，我们需要对整段文本进行 embedding：

| 方法 | 方式 | 优点 | 缺点 |
|----------|--------|------|------|
| 均值池化 | 对 token embedding 求平均 | 简单 | 丢失信息 |
| CLS token | 使用 [CLS] token embedding | BERT 的标准做法 | 可能无法捕捉全文 |
| 最后一个 token | 使用最后一个 token | 适用于 decoder 模型 | 存在位置偏置 |
| 训练式池化 | 学习池化权重 | 质量更好 | 需要训练 |

现代 embedding 模型通常是专门为句子/文档 embedding 训练的，而不只是从语言模型适配而来。

### Bi-Encoder 架构

标准的检索 embedding 架构：

```
Document -> Encoder -> Document Embedding
Query    -> Encoder -> Query Embedding

Similarity = cosine(doc_embedding, query_embedding)
```

**特性：**
- 文档可预先计算并建立索引
- 查询 embedding 在查询时计算
- 对每个文档的相似性计算为 O(1)（配合 ANN）

### Cross-Encoder 架构

另一种将 query 和文档一起处理的架构：

```
[Query, Document] -> Encoder -> Relevance Score
```

**特性：**
- 更准确（同时看到 query 和文档）
- 无法预计算：对 n 个文档推理为 O(n)
- 用于 reranking，不用于检索

当前的 reranker 可接收 32K token 输入，因此候选内容可以是长章节或短文档，而非仅限 512 token 的段落：Cohere Rerank 4（Fast 和 Pro）、Voyage rerank-3 和 rerank-3-lite（2026 年 9 月 30 日，分别为每 1M token $0.05 和 $0.02），以及 Qwen3-Reranker-8B、Qwen3-VL-Reranker 等开放权重选项（Apache 2.0，多模态）。参见 [Reranking Strategies](../06-retrieval-systems/06-reranking-strategies.md)。

---

## 训练目标

### 对比学习

大多数现代 embedding 模型使用对比学习：

```python
# Simplified contrastive loss
def contrastive_loss(anchor, positive, negatives):
    pos_sim = cosine_similarity(anchor, positive)
    neg_sims = [cosine_similarity(anchor, neg) for neg in negatives]
    
    # Push positive close, negatives far
    loss = -log(exp(pos_sim / tau) / 
                (exp(pos_sim / tau) + sum(exp(neg_sim / tau) for neg_sim in neg_sims)))
    return loss
```

**关键因素：**
- **正样本对：** 语义相似的文本（平行句、query-document 对）
- **困难负样本：** 相似但不匹配的文本（BM25 检索到的不相关内容）
- **批内负样本：** 将同批次的其他样本作为负例（高效）

### 训练数据来源

| 来源 | 正样本对 | 质量 | 规模 |
|--------|---------------|---------|-------|
| 平行句 | 翻译对 | 高 | 中 |
| Query-document | 搜索日志 | 高 | 中 |
| 标题-正文 | 文档结构 | 中 | 大 |
| Paraphrase | NLI 数据集 | 高 | 小 |
| 生成数据 | LLM 生成样本对 | 可变 | 大 |

### 指令微调 Embedding

近期模型支持任务指令：

```python
# Instruction-tuned (e.g., E5, BGE)
query_embedding = embed("Represent this query for retrieval: What is RAG?")
doc_embedding = embed("Represent this document for retrieval: RAG combines...")
```

通过指定预期用途，可以提升性能。

---

## 距离度量

### 余弦相似度

文本 embedding 最常用的度量：

```python
def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
```

**特性：**
- 取值范围：[-1, 1]（所有分量均为非负时为 [0, 1]）
- 衡量角度而非幅度
- 不受向量长度影响

**适用场景：** 文本 embedding 的默认选择。

### 点积

```python
def dot_product(a, b):
    return np.dot(a, b)
```

**特性：**
- 幅度有影响
- 取值无上界
- 对归一化向量而言等价于余弦相似度

**适用场景：** 当 embedding 已经归一化，或幅度本身有意义时。

### 欧氏距离

```python
def euclidean_distance(a, b):
    return np.linalg.norm(a - b)
```

**特性：**
- 衡量绝对差异
- 受幅度影响
- 对归一化向量：`sqrt(2 - 2 * cosine)`

**适用场景：** 文本中较少使用；图像 embedding 更常见。

### 度量选择

| 度量 | 向量数据库 | 常见用途 |
|--------|------------------|------------|
| Cosine | Pinecone, Qdrant, Weaviate | 文本 embedding |
| Dot Product | 所有主流数据库 | 已归一化 embedding |
| Euclidean | 所有主流数据库 | 图像、多模态 |

---

## Embedding 模型对比

### 托管模型（2026 年 10 月）

| 模型 | 维度 | 最大输入 | 模态 | 每 1M token 成本 | 备注 |
|-------|------------|-----------|------------|------------------|-------|
| OpenAI text-embedding-3-large | 3072（Matryoshka） | 8,192 | 文本 | $0.13 | OpenAI 尚未推出更新的 embedding 模型 |
| OpenAI text-embedding-3-small | 1536（Matryoshka） | 8,192 | 文本 | $0.02 | 低成本基线 |
| Google gemini-embedding-2 | 128-3,072（推荐 768 / 1,536 / 3,072） | 8,192 个文本 token；最多 6 张图像、120 秒视频、音频、6 页 PDF | 多模态、交错输入 | 文本 $0.20（Google 定价页） | 自 2026 年 4 月起稳定；替代已关闭的 text-embedding-004，以及将于 2028 年 5 月 14 日关闭的纯文本 gemini-embedding-001 |
| Cohere embed-v5.0-pro / -fast | 256-2,048（Matryoshka） | 128K | 文本、图像、融合文本+图像 | 文本 $0.12 / $0.08；图像 $0.40 | 2026 年 9 月 30 日发布；Pro 与 Fast 共享同一 embedding 空间 |
| Voyage voyage-4-large / voyage-4 / voyage-4-lite | 默认 1024（256-2,048） | 32K | 文本 | $0.12 / $0.06 / $0.02 | 2026 年 1 月发布；该系列共享同一 embedding 空间 |
| Voyage voyage-code-4 | 默认 1024（256-2,048） | 32K | 代码 | $0.12 | 2026 年 8 月 13 日发布；基于从 pull request 挖掘的自然语言查询训练，适用于 agent 式代码搜索 |
| Voyage voyage-context-4 | - | 32K 窗口；可处理更长文档 | 文本、上下文化 chunk | $0.12 | 每个 chunk 一个向量，编码整篇文档的上下文 |

**如何解读基准声明：**
- **优先参考 RTEB**（MTEB 团队于 2025 年 10 月推出），而非只看 MTEB 排名。RTEB 混合开放数据集与维护者评估的私有保留集，因此模型无法针对其全部内容调优。NVIDIA 报告称，截至 2026 年 7 月 15 日，Nemotron 3 Embed 8B 以 78.5 位列 RTEB Multilingual 第一。
- **MTEB 的领先者存在争议。** Qwen3-Embedding-8B（多语言均值 70.58）后来在声明的排名中被 llama-embed-nemotron-8b 和 KaLM-Embedding-Gemma3-12B-2511（72.32）超越。请查看实时榜单。
- **厂商数据在复现前都只是营销数据。** 对视觉丰富的文档，Cohere 报告的 ViDoRe V3 分数分别为：embed-v5.0-pro 85.8、fast 84.5、voyage-4-large 83.7、gemini-embedding-2 83.2、text-embedding-3-large 75.5。在其自有的 agent 代码检索套件上，Voyage 报告 voyage-code-4 比 voyage-code-3 高 27.54%，尚待独立验证。两者均为厂商自报。

### 开源模型

| 模型 | 维度 | 最大 Token | 许可证 | 备注 |
|-------|------------|------------|---------|-------|
| Nemotron 3 Embed 8B | 4096（可切片） | 32,768 | OpenMDW-1.1 | 2026 年 7 月 16 日发布；RTEB Multilingual 第一，78.5（NVIDIA 自报）；使用 `query:` / `passage:` 前缀 |
| Nemotron 3 Embed 1B | 2048 | - | OpenMDW-1.1 | RTEB Multilingual 72.4（NVIDIA 自报）；提供适合低成本服务的 NVFP4 变体 |
| Qwen3-Embedding-8B | 最高 4096（Matryoshka） | 32K | Apache 2.0 | MTEB Multilingual 均值 70.58 |
| BGE-large-en-v1.5 | 1024 | 512 | MIT | 较早但强大的英文基线 |
| E5-large-v2 | 1024 | 512 | MIT | 指令微调 |
| Nomic-embed-text-v1.5 | 768（Matryoshka） | 8192 | Apache 2.0 | 小型、长上下文 |

### 选择标准

| 因素 | 考量 |
|--------|----------------|
| 质量（RTEB、MTEB） | 越高越好，但对自身查询的评估更重要；保留基准优于公开基准 |
| 模态 | 图像、PDF、视频或代码需要针对这些内容训练的模型（gemini-embedding-2、Cohere Embed 5、voyage-code-4） |
| 共享空间 | 共享同一空间的模型系列可在不重建索引的情况下更换查询端模型 |
| 维度 | 越高表达力越强，但存储和计算成本也更高 |
| 最大 token | 必须覆盖你的文档长度 |
| 成本 | API 与自托管（self-hosting）的权衡 |
| 延迟 | Embedding 生成耗时 |
| 多语言 | 是否服务非英文内容 |

---

## Matryoshka 与自适应维度

### 核心思想

Matryoshka Representation Learning（MRL）会训练出这样的 embedding：完整 embedding 的前缀本身也有意义：

```python
full_embedding = model.encode(text)  # 1024 dimensions

# All these are valid embeddings with decreasing quality
dim_512 = full_embedding[:512]  
dim_256 = full_embedding[:256]
dim_128 = full_embedding[:128]
dim_64 = full_embedding[:64]
```

### 为什么重要

| 使用场景 | 维度 | 取舍 |
|----------|-----------|----------|
| 全量检索 | 1024-3072 | 峰值准确率 |
| **两阶段检索**| 128 -> 1024 | **生产标准**：先用 128 维召回 1000 条，再用 1024 维重排前 100 条。 |
| 成本敏感 | 256 | 相比 3,072 维节省 12 倍存储；OpenAI 报告称，256 维的 text-embedding-3-large 在 MTEB 上仍优于全尺寸 ada-002 |
| 边缘 / 移动端 | 64 | 最高速度，适合简单意图 |

### 支持 Matryoshka 的模型

- OpenAI text-embedding-3-*（原生支持）
- Google gemini-embedding-2（128 到 3,072）
- Cohere Embed 5（256 到 2,048）和 Voyage 4 系列（包括 voyage-code-4，均为 256 到 2,048）
- 开放权重模型：Nemotron 3 Embed、Qwen3-Embedding、Nomic-embed-text-v1.5
- 若干微调模型

### 使用 Matryoshka Embedding

```python
from openai import OpenAI
client = OpenAI()

# Request smaller dimensions
response = client.embeddings.create(
    model="text-embedding-3-large",
    input="Your text here",
    dimensions=256  # Request 256 instead of full 3072
)
```

---

## Late Chunking 与 Late Interaction

### Late Chunking

**传统切分：**
`Document -> Split into chunks -> Embed chunks individually`
- **问题**：Chunk 2 会丢失 Chunk 1 的上下文。

**Late Chunking（由 Jina AI 于 2024 年提出）：**
`Full Document -> Model Encoder -> Token-level Embeddings -> Pool into chunk boundaries`
- **收益**：每个 chunk 的 embedding 都包含**整篇文档**的信息，因为在 pooling 之前，transformer 的 self-attention 已作用于完整序列。
- **要求**：模型必须支持长上下文（至少 8k+ token）。

**上下文化 chunk embedding 模型**现已将这一理念产品化，因此无需为每个 chunk 调用 LLM，即可获得感知文档上下文的 chunk 向量：
- **voyage-context-4**（于 2026 年 6 月 29 日 GA，$0.12 / 1M token）：每个 chunk 一个编码整篇文档上下文的向量，内置自动切分，并可透明处理超出 32K 窗口的文档。Voyage 报告称，其在 39 个数据集上的 chunk 级表现比 voyage-context-3 提升 2.08%。
- **pplx-embed-v2-context-9b-preview**（Perplexity，2026 年 9 月 25 日）：以 2048 维共同编码同一文档的各 chunk。该模型处于预览阶段，其 embedding 不得与后续版本混用。

这改变了与上下文前缀方案的成本比较，后者需要调用 LLM 为每个 chunk 编写上下文简介。

---

### Late Interaction（ColBERT）

ColBERT 不再为每篇文档只保留一个 embedding，而是为每个 token 保留一个 embedding，并在查询时通过 MaxSim 打分（每个查询 token 匹配其最佳文档 token）。

**何时使用 ColBERT：**
- 检索精度至关重要
- 可以接受存储开销
- 查询延迟预算 > 50ms

**实现：**

```python
# Using RAGatouille
from ragatouille import RAGPretrainedModel

model = RAGPretrainedModel.from_pretrained("colbert-ir/colbertv2.0")

# Index documents
model.index(
    collection=documents,
    index_name="my_index"
)

# Search
results = model.search(query="What is RAG?", k=10)
```

---

## 规模化量化

为处理数十亿向量，**Binary** 与 **Scalar（Int8）** 量化已是标准；基于旋转的 1 至 4 bit 方案则是 2026 年新增的发展。

| 类型 | 数据大小 | 内存节省 | 质量损失 | 获取方式 |
|------|-----------|----------------|--------------|------------------|
| Float32 | 4 bytes/dim | 基线 | 0% | 所有方案 |
| Int8 | 1 byte/dim | 4x | <1% | 模型输出（Cohere Embed 4/5、Voyage 4 系列）、大多数向量数据库 |
| 4-bit 旋转量化（RaBitQ、TurboQuant、RQ） | 0.5 byte/dim | 8x | 重排后较小（厂商声明） | Qdrant Turbo4（选择启用）、Weaviate 4-bit RQ（预览）、LanceDB RaBitQ |
| **Binary** | **1 bit/dim** | **32x** | ~5-10% | 模型输出（Cohere、Voyage）、大多数向量数据库 |

**旋转为何有效：** 随机旋转或 Hadamard 旋转会将每个向量的能量均匀分散到各维度，使统一的逐维量化器不再把 bit 浪费在少数异常维度上。这使每维 1 至 4 bit 变得可用。截至 2026 年 10 月，这些模式均为选择启用或预览，并非默认：Qdrant 在 1.18 加入 Hadamard 旋转的 TurboQuant，并在 1.19 加入选择启用的 4-bit Turbo4 存储类型；Weaviate 在 1.39 预览 4-bit Rotational Quantization（7.84 倍压缩）；LanceDB 报告多 bit RaBitQ 无需 refine 步骤即可达到 96% recall（厂商声明）。Elasticsearch 是例外：自 9.1 起，BBQ（约每维 1 bit）已是 384 维及以上 float `dense_vector` 字段的默认选项；在许可证包含该功能时，DiskBBQ（`bbq_disk`）自 9.4 起默认启用；9.5 新增对称 1-bit OSQ scorer。

**Binary Quantization 模式**（适用于任意低 bit 方案）：
1. 使用 Binary embeddings 检索前 1000 条（极致速度）。
2. 使用 Float32（或保存在磁盘上的 int8 原始向量）或 Cross-Encoder 对前 50 条重排（峰值准确率）。

---

## 实践注意事项

### 批处理

```python
# Inefficient: one API call per document
embeddings = [embed(doc) for doc in documents]

# Efficient: batch API calls
batch_size = 100
embeddings = []
for i in range(0, len(documents), batch_size):
    batch = documents[i:i + batch_size]
    batch_embeddings = embed_batch(batch)
    embeddings.extend(batch_embeddings)
```

### Embedding 的切分

长文档在 embedding 之前必须切分：

```python
def embed_document(document: str, max_tokens: int = 512) -> list[np.array]:
    chunks = chunk_document(document, max_tokens=max_tokens)
    embeddings = []
    for chunk in chunks:
        embedding = embed(chunk)
        embeddings.append(embedding)
    return embeddings
```

**注意事项：**
- chunk 大小应小于模型最大 token
- overlap 有助于保留跨 chunk 的上下文
- 需要保存 chunk 到文档的映射用于检索

### 归一化

许多系统期望 embedding 已归一化：

```python
def normalize(embedding):
    norm = np.linalg.norm(embedding)
    return embedding / norm

# Cosine similarity of normalized vectors = dot product
similarity = np.dot(normalize(a), normalize(b))
```

大多数向量数据库和 embedding API 会处理归一化，但仍需验证。

### 缓存

embedding 计算成本很高，应积极缓存：

```python
import hashlib

def get_embedding(text: str, cache: dict) -> np.array:
    key = hashlib.sha256(text.encode()).hexdigest()
    
    if key in cache:
        return cache[key]
    
    embedding = compute_embedding(text)
    cache[key] = embedding
    return embedding
```

---

## Embedding 漂移与版本控制

### 问题

Embedding 在以下情况下不可直接比较：
- 不同模型
- 同一模型的不同版本
- 有时不同 API 调用（某些 API 存在非确定性）

### 后果

如果更新 embedding 模型：
- 所有现有 embedding 都会失去兼容性
- 必须重新生成整个语料库的 embedding
- 迁移期间搜索结果会不一致

### 缓解策略

**1. 为 embedding 做版本化：**
```python
embedding_metadata = {
    "model": "text-embedding-3-large",
    "model_version": "2024-01",
    "dimensions": 3072,
    "created_at": "2025-12-16"
}
```

**2. 为重新 embedding 做规划：**
- 估算全量重新 embedding 的成本和时间
- 构建可在后台运行的流水线
- 切换前先测试新 embedding

**3. 蓝绿部署：**
```
Index A: Current embeddings
Index B: New embeddings (building)

Query -> Both indexes -> Merge or switch
```

**4. 跟踪 embedding 质量：**
- 持续监控检索指标
- 检测 embedding 分布漂移
- 在质量下降时告警

**5. 在可用时使用共享 embedding 空间：**
Voyage 4 系列（large、base、lite）共享同一空间，Cohere Embed 5 Pro 和 Fast 也共享同一空间，因此可以用大模型建立索引、用小模型查询，或在之后更换查询模型，而无需重建索引。Qdrant 的 Constella 研究预览版（2026 年 9 月 29 日）进一步推进了这一思路：固定 Stella 文档索引，同时可替换微型查询编码器；Qdrant 报告 Constella Nano（3450 万参数）在 CPU 查询编码快 12 倍的同时，仍保持约 91% 的 Stella BEIR nDCG@10。共享空间只在同一系列内有效；迁移至其他厂商仍需完整重建。

**6. 明确谁拥有 embedder：**
数据库内 embedding（MongoDB Atlas Automated Embedding，2026 年 8 月 13 日 GA；turbopuffer native embedding，2026 年 9 月 29 日 GA；Elasticsearch `semantic_text`）可移除同步流水线，但会使索引绑定到厂商选定的模型版本。应固定模型，并确认厂商如何处理模型升级以及谁承担重新 embedding 的成本。

---

## 面试题

### Q: embedding 模型如何学习语义相似性？

**高质量回答：**
Embedding 模型通过对比学习训练。目标是让语义相似文本的 embedding 靠近，让语义不相似文本远离。

训练过程：
1. 正样本对：应该相似的文本（query-document 对、paraphrase、翻译对）
2. 负样本对：应该不相似的文本（通常来自同一 batch 或 BM25 的困难负样本）
3. 损失函数：推动正样本对接近，负样本对远离

模型学习把文本放入高维空间，使距离与语义相似性相关。这就支持检索：先对 query 做 embedding，再在文档 embedding 空间中查找最近邻。

像 E5、BGE 和 Qwen3-Embedding 这样的现代模型也支持 instruction-tuned（指令微调），可以通过前置任务指令来专门化 embedding；Nemotron 3 Embed 等其他模型则使用固定的 `query:` 和 `passage:` 前缀。使用错误前缀会在无提示的情况下降低检索效果。

### Q: 什么时候会使用 ColBERT 而不是 bi-encoder？

**高质量回答：**
ColBERT 使用 late interaction（晚交互）：它不是为每个文档只生成一个 embedding，而是保留逐 token 的 embedding。查询时会计算 token 级相似度。

应选择 ColBERT 的场景：
- 检索精度至关重要（法律、医疗、高风险场景）
- 可以接受每个文档 10-100 倍的存储开销
- 查询延迟预算为 50ms+（比 bi-encoder 略慢）
- 查询受益于词法匹配（technical terms，技术术语）

应选择 bi-encoder 的场景：
- 存储受限
- 需要低于 20ms 的延迟
- bi-encoder 的检索精度已经足够
- 需要频繁重建索引（ColBERT 重建索引成本高）

实践中常见模式是：第一阶段用 bi-encoder 检索（前 100 条），然后用 cross-encoder 或 ColBERT 做 reranking。

### Q: 更新模型时如何处理 embedding drift（漂移）？

**高质量回答：**
Embedding 模型生成的向量只在同一模型下才有可比意义。如果更新模型，旧 embedding 就会失去兼容性。

我的做法：
1. **不要原地更新。** 使用新 embedding 并行构建新索引。
2. **切换前先测试。** 在测试集上同时比较新旧 embedding 的检索质量。
3. **后台重建。** 在后台使用新模型重新生成整个语料库的 embedding。
4. **原子切换。** 新索引完成并验证后，再原子切换流量。
5. **回滚方案。** 保留旧索引，便于快速回滚。

成本估算：如果有 1000 万文档、平均 500 token，且 text-embedding-3-large 的价格为 $0.13/1M tokens，那么重新 embedding 的成本大约是 $650。考虑模型更新时应把这部分成本纳入预算。API 账单通常只是较小部分；索引重建时间、双索引存储和评估运行的成本更高。

有一个值得说明的例外：在共享空间的模型系列内（Voyage 4、Cohere Embed 5 Pro 和 Fast），可以更换查询端模型而不触及文档索引；更换文档端模型仍需完整重建。

### Q: 你如何选择 embedding 的维度？

**高质量回答：**
更高维度可以编码更多信息，但会增加存储和计算成本。

考虑点：
- **存储：** 1024 维 float32 每条 embedding 是 4 KB。1000 万文档约 40 GB，仅用于 embedding 存储。
- **检索速度：** 维度越高，最近邻搜索越慢。
- **质量：** 大多数任务在超过某个维度后收益递减。

实践方法：
1. 从模型推荐的维度开始。
2. 如果使用 Matryoshka 模型（如 text-embedding-3），在你的任务上尝试更低维度。
3. 在自己的查询上测试每个维度的质量。OpenAI 公布的数据提供了一个下限：text-embedding-3-large 降至 256 维后，仍以 61.0 的 MTEB 平均分超过全尺寸 ada-002，而其 3,072 维时为 64.6，因此在该基准上保留了超过 94% 的完整分数。狭窄领域的损失可能更大。
4. 两阶段检索：第一阶段用低维，重排阶段用完整维度。

对大多数应用来说，768-1024 维提供了较好的平衡。例外是高精度需求极高的场景，此时 2048-4096 可能更有帮助。

### Q: 为什么不直接让 LLM 判断相关性，而要使用 embedding？

**高质量回答：**
因为达到相当效果的成本会高出数个数量级。《The Embedder's Dilemma》（arXiv 2608.12875，2026 年 8 月）在 37 个任务上比较了 10 个 LLM 与 26 个 embedding 模型。汇总结果中两者不相上下：最佳 LLM（Gemini 3.1 Pro）得分为 77.6，最佳 embedder 为 77.2；但要达到 embedder 的效果，成本最高增加 1,431 倍（每次基准运行 154 美元，对比 0.11 美元），开源 LLM 在相同 GPU 上慢 2.5 倍至 736 倍，推理 token 则占 LLM 成本的 28% 至 81%。

由此得出的分工是：
- **Embedding**：用于全语料库的第一阶段相似性检索；可预计算、成本低、毫秒级查找。
- **Cross-encoder 或 listwise reranker**：用于前 50-100 个候选。
- **LLM 裁判仅用于最后阶段**：只评估少量候选，并且仅用于论文发现 LLM 确实领先的重推理查询。较低推理预算通常仍能保持检索质量，因此应以低 effort 运行该裁判。

---

## 参考文献

- Reimers 和 Gurevych. “Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks（Sentence-BERT：使用 Siamese BERT 网络的句向量）” (2019)
- Khattab 和 Zaharia. “ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction over BERT（ColBERT：通过基于上下文的 BERT 晚期交互实现高效有效的段落检索）” (2020)
- Wang 等. “Text Embeddings by Weakly-Supervised Contrastive Pre-training（通过弱监督对比预训练生成文本嵌入）” (E5, 2022)
- Xiao 等. “C-Pack: Packaged Resources To Advance General Chinese Embedding（C-Pack：推进通用中文 Embedding 的打包资源）” (BGE, 2023)
- Kusupati 等. “Matryoshka Representation Learning（Matryoshka 表示学习）” (MRL, 2022)
- Günther 等. “Late Chunking: Contextual Chunk Embeddings Using Long-Context Embedding Models” (2024)
- “The Embedder's Dilemma” (arXiv 2608.12875, 2026)
- MTEB 排行榜（包括 RTEB）: https://huggingface.co/spaces/mteb/leaderboard
- OpenAI Embeddings 指南: https://platform.openai.com/docs/guides/embeddings

---

*上一篇: [Transformer Architecture](04-transformer-architecture.md) | 下一篇: [Inference Pipeline](06-inference-pipeline.md)*
