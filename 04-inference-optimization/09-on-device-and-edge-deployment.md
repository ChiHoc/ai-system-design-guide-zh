# 端侧与边缘部署（On-Device and Edge Deployment）

并非每个模型都必须运行在别人的云上。LLM 在本地（local）运行——无论是在笔记本、工作站 GPU、手机还是边缘设备上——在 2026 年已成为真实的部署目标，这主要受隐私、离线运行、延迟和高并发时的成本驱动。问题在于，能够让本地模型易于试用的工具 Ollama 并不是用于生产服务的工具（而是 vLLM），这两者常被混淆。本文梳理了运行时栈、原型到生产的路径、硬件上限，以及何时本地部署更有优势。

## 目录

- [运行时栈（The Runtime Stack）](#运行时栈)
- [为什么 Ollama 不是生产服务器](#为什么-ollama-不是生产服务器)
- [何时本地优于云端（以及何时不然）](#何时本地优于云端-以及何时不然)
- [本地服务的量化（Quantization for Local Serving）](#本地服务的量化-quantization-for-local-serving)
- [硬件](#硬件)
- [从原型到生产（Prototype to Production）](#从原型到生产)
- [面试题](#面试题)
- [参考资料](#参考资料)

---

## 运行时栈

核心思维模型：这些工具**不是替代关系**。它们处于不同层级。

| 工具 | 层级 | 适用场景 |
|------|------|----------|
| **Ollama** | 体验层 / 本地守护进程（local daemon） | 一条命令拉取与运行模型、OpenAI 风格 API、单用户开发。基于 llama.cpp 构建，近期版本在 Apple Silicon 上使用 Apple MLX。 |
| **LM Studio** | 体验层 / 图形界面（GUI） | 用于浏览和运行本地模型的桌面 GUI。聚焦单用户。 |
| **llama.cpp** | 推理引擎（inference engine） | 可移植的 C/C++ CPU/GPU 推理（GGUF 格式）；几乎可在任何地方运行；为体验层工具提供底层能力。 |
| **MLX** | 推理引擎 | Apple 的数组计算框架；Apple Silicon 的最快路径；面向研究与微调。 |
| **vLLM** | 服务系统（serving system） | 借助 PagedAttention 与 continuous batching 的高吞吐并发服务；OpenAI 兼容（OpenAI-compatible API）。这是生产答案。 |
| **TGI / TensorRT-LLM** | 服务系统 | Hugging Face 与 NVIDIA 的高吞吐服务器；用于生产环境。 |
| **ExecuTorch** | 嵌入式/移动端运行时（Embedded/mobile runtime） | 原生 PyTorch 的端侧推理（从手机到微控制器）；2025 年底达到 1.0，并已在服务数十亿用户的应用中出货。 |
| **Core ML / ONNX Runtime / MLC LLM** | 嵌入式/移动端运行时 | 分别面向 Apple 端侧、跨平台和多目标编译（包括浏览器/WebGPU）。 |

---

## 为什么 Ollama 不是生产服务器

Ollama 和 LM Studio 非常适合原型验证，但并不适合共享生产端点，这一点有明确的架构原因。

Ollama 默认以很低的并行度服务请求，并对超出的请求采用先进先出队列；队列满时会返回错误。每个并行槽位都会静态倍增上下文内存分配。LM Studio 为单用户场景构建，缺少限流与鉴权。两者都未设计为把并发需求转化为吞吐量（throughput）。

**vLLM** 则通过两个机制做到这一点：**PagedAttention**（将 KV 缓存存储为非连续块，类似操作系统分页，能把朴素服务中的 60%-80% KV 内存浪费降到约 4% 以下）和 **continuous batching**（将已完成请求换出，并在批处理中间接纳排队请求）。Red Hat 的一项一手基准测试显示：在单台数据中心 GPU 上运行一个 8B 模型时，vLLM 达到约 **793 tokens/sec**，而 Ollama 约 **41 tokens/sec**，差异约 19 倍，并且尾延迟更低；即便是调优后的 Ollama 在所有并发级别下仍落后。

结论不是“vLLM 调优更好”，而是结构性差异：Ollama 与 LM Studio 是串行处理，vLLM 持续批处理并分页 KV 缓存。单用户场景下差距不大；在并发场景下会接近 16-20 倍。一个诚实的说明：大多数公开对比都在数据中心 GPU 上运行，以隔离*软件差异*，因此不要把“vLLM 胜过 Ollama”解读为“GPU 胜过 Mac”。

---

## 何时本地优于云端（以及何时不然）

**应偏向本地或边缘的情况：**
- **隐私或受监管数据**不能离开设备（HIPAA、GDPR、合同居住地要求）。这里有一个补充：主流 API 提供商已提供零数据保留企业级方案，因此“隐私”不再单独自动意味着必须本地部署。
- **离线或气隙（air-gapped）**运行（现场设备、关键基础设施）。
- **延迟底线要求**：端侧可去掉网络往返（通常 50-200ms），这对交互回路很关键；但总响应延迟仍由模型和硬件共同决定。
- **稳定高并发量下的成本**：据报道预留 GPU 在每天约数百万 token 左右可达到盈亏平衡，超过这个量级后自建硬件更划算，因为不再按 token 计费。具体盈亏平衡点取决于工作负载。

**在以下情况下应留在云 API：**需要前沿质量、需求尖峰/不确定（会产生空闲 GPU 成本；约 50% 折扣的 batch endpoint 在中等量通常优于本地）、低到中低量（低于盈亏平衡线时 API 总成本更低），或团队缺乏运行 vLLM 所需的自动扩缩容与监控能力。2026 年的共识通常是**混合模式**：小规模、私有、离线或对成本敏感路径本地化，重负载、前沿或突发路径走云端，在同一产品内协同。

---

## 本地服务的量化（Quantization for Local Serving）

量化（quantization）是本地服务可行的关键；[Quantization Deep Dive](../03-training-and-adaptation/07-quantization-deep-dive.md) 已讲解其数学原理，本节只聚焦部署层。

**GGUF** 是 llama.cpp、Ollama 与 LM Studio 使用的本地模型格式。常见量化等级在质量与体积间做权衡：Q4_K_M 通常是工程上最实用的平衡点（相比 FP16 约 1%-3% 的质量损失，体积约四分之一），Q5_K_M 在代码与推理任务上明显更好，损失通常低于约 1%，Q8_0 在约半 FP16 时几乎无损，而 Q2/Q3 节省内存最多，但数学与推理质量会下降 5-10% 甚至更多。

**VRAM 经验法则**：

```
VRAM (GB) ≈ (params in billions × bits per weight) / 8   # model weights only
```

然后再加上 KV 缓存（其规模随上下文长度与并发请求数增长），再加上约 10-20% 的运行时开销。故 7B 模型的权重在 FP16 下约 14GB，Q8_0 下约 7.7GB，Q4_K_M 下约 4.5GB，在此基础上再预留开销。大家反复强调的执行准则是：**使用能放入 10-20% 头room 的最高质量量化级别**，用于 KV 缓存、激活值与上下文。

---

## 硬件

模型规模与硬件建议（默认按 Q4 量化；用于规划，不构成硬性承诺）：

| 模型规模（Q4） | 最低 VRAM/RAM | 常见可行硬件 |
|-----------------|--------------|--------------------|
| 1-3B | 4-6 GB | 任意现代 GPU；高端手机（NPU）；AI PC |
| 7-8B | 8 GB | 主流 GPU；16 GB Mac |
| 13-14B | 12 GB | 中高端主流 GPU；16-24 GB Mac |
| 32-35B | 24 GB | 24 GB 消费级 GPU；36-48 GB Mac |
| 70B | ~40 GB+ | 高端或双 GPU；64 GB+ Mac；或数据中心显卡 |
| 200B+ | 48 GB+，常见多 GPU / 128 GB+ 统一内存 | 多 GPU 机架；大内存统一池工作站 |

说明：
- **消费级 GPU**通常在 24-32 GB VRAM 打顶，这通常是本地模型规模的关键瓶颈。
- **Apple Silicon** 在 CPU 与 GPU 间共享同一内存池，因此系统内存可作为 VRAM 使用，使大内存 Mac 能托管普通离散 GPU 同价位下无法承载的模型。Apple 的 MLX 路径持续优化：Ollama 的 MLX 后端（预览）报告在 Apple Silicon 上通过统一内存获得了可观的 prefill 与 decode 提升；另有单独更新加入了 NVFP4，这是 NVIDIA 的 4-bit 浮点格式（非 Apple 格式），据报比 Q4_K_M 快约 20%。
- **NPUs** 在手机与 AI PC 上常见很高的 TOPS，但教学中的关键点是：TOPS 本身不能直接预测 LLM 速度，因为算子支持与内存带宽会限制实际性能。NPU 更适合轻量、节能任务；重型本地推理仍是离散 GPU 领先。
- **移动端**受带宽与内存限制：手机可行模型通常是小于 1B 到约 3B，旗舰机可用应用内存也常低于 4 GB，而移动内存带宽比数据中心 GPU 低 30-50 倍。端侧常用标准是 4-bit 量化。

---

## 从原型到生产

1. 使用 Ollama（CLI）或 LM Studio（GUI）在 GGUF Q4_K_M 模型上做原型；在最小可行模型上验证质量和提示词（prompt）。
2. 选择在目标硬件上可落地且带 KV 缓存余量的最大模型与最高量化质量。
3. 对任何并发端点切换服务引擎：vLLM（NVIDIA 或 AMD）、TensorRT-LLM（NVIDIA 优先）或 TGI。保持 OpenAI 兼容 API（OpenAI-compatible API），让应用侧代码几乎不改。
4. 对于移动端或边缘端，导出到 ExecuTorch、Core ML 或 ONNX Runtime / MLC LLM，量化到 4-bit，并预留小于 4 GB 的 RAM 与带宽上限。

常见陷阱：将 Ollama 或 LM Studio 当作服务器使用（它们在负载下是串行化）；内存估算时遗漏 KV 缓存（长上下文乘并发槽位可能主导）；过度量化（Q2/Q3 会伤害推理能力）；把“vLLM 胜过 Ollama”误解为“GPU 胜过 Mac”；将 NPU TOPS 当作 LLM 速度指标；以及将引擎与硬件匹配错位（vLLM 偏 GPU 中心，MLX 只支持 Apple，llama.cpp 是可移植兜底方案）。

**成熟度：** 服务器端本地服务已具备生产成熟度（vLLM 已广泛部署，且具备 OpenAI 兼容 API）。端侧与移动端对小模型（小于 1B 到 3B）已可生产就绪，但对 frontier 模型尚不足；NPU 作为 LLM 引擎仍处于早期阶段；在 2026 年，离散 GPU 和大统一内存 Mac 仍是可信的本地主路径。

---

## 面试题

### 问：一个团队在 Ollama 上做了原型，想要作为共享 API 上线，应该改什么？为什么？

**标准回答：**
Ollama 不适合作为共享端点。它以有限并行度服务请求，并以先进先出队列处理超载请求，因此并发下延迟会飙升且请求可能失败。修正方案是将服务引擎切换到 vLLM（或 TensorRT-LLM、TGI），并保持同一套 OpenAI 兼容 API（OpenAI-compatible API），这样应用几乎无需改动。vLLM 的优势在结构上，不只是调优：PagedAttention 以非连续块存储 KV 缓存，消除大部分内存浪费；continuous batching 能在批处理过程中替换完成请求与排队请求，使并发需求转为吞吐量。官方基准显示在负载下吞吐量约提升一个数量级，尾延迟也显著更低。我还会结合目标 GPU 调整模型和量化级别并预留 KV 缓存冗余，同时加入 autoscaling（自动扩缩容）和监控能力，这些 Ollama 都不具备。

### 问：何时会在云 API 上选择本地或端侧推理（on-device inference）？

**标准回答：**
当出于隐私或数据驻留（residency）要求而不能让数据离开设备、系统必须离线或气隙运行、为了降到最低网络往返延迟需要端侧推理，或在稳定高并发下预留 GPU 已优于按 token 计费（据报约在每天数百万 token 附近达到盈亏平衡）时，我会选本地。对于 frontier 质量需求、负载尖峰场景（空闲 GPU 会浪费成本）、低于盈亏平衡点的低量需求，或者团队缺乏支撑自动扩缩容与监控的运维能力，我会继续使用 API。实践中通常是混合模式：小规模、私有、离线或成本敏感路径走本地量化模型，重负载、frontier 或突发路径走云端。对于手机，通常规划在小于 1B 到 3B 的模型范围，因为移动端受内存与带宽约束。

---

## 参考资料

- Red Hat Developer，《["Ollama vs vLLM: a deep dive into performance benchmarking"](https://developers.redhat.com/articles/2025/08/08/ollama-vs-vllm-deep-dive-performance-benchmarking)》
- vLLM，[文档](https://docs.vllm.ai/) 与 [PagedAttention 博客](https://blog.vllm.ai/2023/06/20/vllm.html)
- Ollama，[now powered by MLX on Apple Silicon](https://ollama.com/blog/mlx) 与 [并发 FAQ](https://docs.ollama.com/faq)
- PyTorch，[Introducing ExecuTorch 1.0](https://pytorch.org/blog/introducing-executorch-1-0/)
- Chandra 与 Krishnamoorthi（Meta），[“On-Device LLMs: State of the Union, 2026”](https://v-chandra.github.io/on-device-llms/)

---

*Next: [Prompt Engineering Fundamentals](../05-prompting-and-context/01-prompt-engineering-fundamentals.md)*
