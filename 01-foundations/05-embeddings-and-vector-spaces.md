# Embedding 与向量空间

Embedding（向量嵌入）是文本的稠密向量表示，用于捕捉语义含义。它们是 RAG（Retrieval-Augmented Generation，检索增强生成）系统、语义检索以及众多 AI 应用的基础。

## 目录

- [什么是 Embedding](#什么是-embedding)
- [Embedding 模型架构](#embedding-模型架构)
- [训练目标](#训练目标)
- [距离度量](#距离度量)
- [Embedding 模型对比](#embedding-模型对比)
- [Matryoshka 与自适应维度](#matryoshka-与自适应维度)
- [Late Interaction 与 Late Chunking](#规模化量化)
- [二值量化与标量量化](#规模化量化)
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
- 取值范围：[-1, 1]（向量归一化后，若为正值则为 [0, 1]）
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

### 当前顶级模型（2025 年 12 月）

| 模型 | 维度 | 最大 Token | MTEB Retrieval | Cost / 1M tokens |
|-------|------------|------------|----------------|------------------|
| OpenAI text-embedding-4 | 3072 | 16k | 68.2 | $0.10 |
| Voyage-4 | 1024 | 128k | 70.1 | $0.05 |
| Cohere embed-v3.5 | 1024 | 512 | 67.5 | $0.10 |
| Google text-embedding-005 | 768 | 8k | 67.2 | $0.02 |

*MTEB 分数是近似值，会随基准子集不同而变化。务必核实当前数值。英文榜单当前由 Gemini Embedding 001（68.32）领先；多语言榜单由 Qwen3-Embedding-8B（70.58）和 Llama-Embed-Nemotron-8B 领先。*

### 开源模型

| 模型 | 维度 | 最大 Token | MTEB Retrieval | 备注 |
|-------|------------|------------|----------------|-------|
| BGE-large-en-v1.5 | 1024 | 512 | 63.9 | 强大的开源模型 |
| E5-large-v2 | 1024 | 512 | 62.4 | 指令微调 |
| GTE-large | 1024 | 512 | 63.1 | Alibaba |
| Nomic-embed-text-v1.5 | 768 | 8192 | 62.3 | 长上下文，开源 |

### 选择标准

| 因素 | 考量 |
|--------|----------------|
| 质量（MTEB） | 越高越好，但任务特定评估更重要 |
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
| 成本敏感 | 256 | 节省 12 倍存储，MRR 损失 <2% |
| 边缘 / 移动端 | 64 | 最高速度，适合简单意图 |

### 支持 Matryoshka 的模型

- OpenAI text-embedding-3-*（原生支持）
- Nomic-embed-text-v1.5
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

### Late Chunking（2025 年的转变）

**传统切分：**
`Document -> Split into chunks -> Embed chunks individually`
- **问题**：Chunk 2 会丢失 Chunk 1 的上下文。

**Late Chunking（由 Jina AI/Voyage 提出）：**
`Full Document -> Model Encoder -> Token-level Embeddings -> Pool into chunk boundaries`
- **收益**：每个 chunk 的 embedding 都包含**整篇文档**的信息，因为在 pooling 之前，transformer 的 self-attention 已作用于完整序列。
- **要求**：模型必须支持长上下文（至少 8k+ token）。

---

## 规模化量化

为了处理数十亿向量，**Binary** 和 **Scalar（Int8）** 量化已成为标准。

| 类型 | 数据大小 | 内存节省 | 质量损失 | 支持方 |
|------|-----------|----------------|--------------|--------------|
| Float32 | 4 bytes/dim | 基线 | 0% | 所有 |
| Int8 | 1 byte/dim | 4x | <1% | Cohere, BGE |
| **Binary** | **1 bit/dim** | **32x** | ~5-10% | Cohere v3, v4 |

**Binary Quantization 模式：**
1. 使用 Binary embeddings 检索前 1000 条（极致速度）。
2. 使用 Float32 或 Cross-Encoder 对前 50 条重排（峰值准确率）。

### 何时使用 ColBERT

- 检索精度至关重要
- 可以接受存储开销
- 查询延迟预算 > 50ms

### 实现

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

像 E5 和 BGE 这样的现代模型也支持 instruction-tuned（指令微调），可以通过前置任务指令来专门化 embedding。

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

成本估算：如果有 1000 万文档、平均 500 token，且 text-embedding-3-large 的价格为 $0.13/1M tokens，那么重新 embedding 的成本大约是 $650。考虑模型更新时应把这部分成本纳入预算。

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
3. 在不同维度上做质量基准测试：通常 256-512 维可以达到全维质量的约 95%。
4. 两阶段检索：第一阶段用低维，重排阶段用完整维度。

对大多数应用来说，768-1024 维提供了较好的平衡。例外是高精度需求极高的场景，此时 2048-4096 可能更有帮助。

---

## 参考文献

- Reimers 和 Gurevych. “Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks（Sentence-BERT：使用 Siamese BERT 网络的句向量）” (2019)
- Khattab 和 Zaharia. “ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction over BERT（ColBERT：通过基于上下文的 BERT 晚期交互实现高效有效的段落检索）” (2020)
- Wang 等. “Text Embeddings by Weakly-Supervised Contrastive Pre-training（通过弱监督对比预训练生成文本嵌入）” (E5, 2022)
- Xiao 等. “C-Pack: Packaged Resources To Advance General Chinese Embedding（C-Pack：推进通用中文 Embedding 的打包资源）” (BGE, 2023)
- Kusupati 等. “Matryoshka Representation Learning（Matryoshka 表示学习）” (MRL, 2022)
- MTEB 排行榜: https://huggingface.co/spaces/mteb/leaderboard
- OpenAI Embeddings 指南: https://platform.openai.com/docs/guides/embeddings

---

*上一篇: [Transformer Architecture](04-transformer-architecture.md) | 下一篇: [Inference Pipeline](06-inference-pipeline.md)*
