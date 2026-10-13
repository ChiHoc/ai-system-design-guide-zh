# 端侧与边缘部署（On-Device and Edge Deployment）

并非每个模型都必须运行在别人的云上。LLM 在本地（local）运行——无论是在笔记本、工作站 GPU、手机还是边缘设备上——在 2026 年已成为真实的部署目标，这主要受隐私、离线运行、延迟和高并发时的成本驱动。问题在于，能够让本地模型易于试用的工具 Ollama 并不是用于生产服务的工具（而是 vLLM），这两者常被混淆。本文梳理了运行时栈、原型到生产的路径、硬件上限，以及何时本地部署更有优势。

## 目录

- [运行时栈（The Runtime Stack）](#运行时栈)
- [平台模型：Apple Foundation Models](#平台模型-apple-foundation-models)
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
| **Ollama** | 体验层 / 本地守护进程（local daemon） | 一条命令拉取与运行模型、OpenAI 风格 API、单用户开发。基于 llama.cpp 构建；在 Apple Silicon 上，受支持架构正逐步默认切换到 MLX（2026 年 9 月的 v0.40.0 候选版）。 |
| **LM Studio** | 体验层 / 图形界面（GUI） | 用于浏览和运行本地模型的桌面 GUI。聚焦单用户。 |
| **llama.cpp** | 推理引擎（inference engine） | 可移植的 C/C++ CPU/GPU 推理（GGUF 格式）；几乎可在任何地方运行；为体验层工具提供底层能力。 |
| **MLX** | 推理引擎 | Apple 的数组计算框架；Apple Silicon 的最快路径；面向研究与微调。 |
| **vLLM** | 服务系统（serving system） | 借助 PagedAttention 与 continuous batching 的高吞吐并发服务；OpenAI 兼容（OpenAI-compatible API）。这是生产答案。 |
| **vllm-metal** | 服务系统（Apple Silicon） | vLLM 的 Apple Silicon 插件（v0.30.0，2026 年 9 月 23 日）：在 MLX 模型上提供 vLLM 调度器、分页 KV 缓存、连续批处理和 OpenAI 服务端，支持批量 MTP 推测解码与 Homebrew 安装。 |
| **SGLang / TensorRT-LLM** | 服务系统 | 高吞吐服务端（SGLang 具备 RadixAttention 前缀缓存；TensorRT-LLM 面向 NVIDIA 峰值性能）；用于生产环境。Hugging Face TGI 已进入维护模式（仓库于 2026 年 3 月归档），Hugging Face 建议新部署选用 vLLM 或 SGLang。 |
| **ExecuTorch** | 嵌入式/移动端运行时（Embedded/mobile runtime） | 原生 PyTorch 的端侧推理（从手机到微控制器）；2025 年底达到 1.0，并已在服务数十亿用户的应用中出货。模型发布方如今还提供官方导出版本（如 Meta 2026 年 8 月发布的 Muse Glimmer 30B `.pte`）。 |
| **Apple Foundation Models framework** | 操作系统提供的模型 | 随系统提供的端侧模型，应用无需下载；详见下一节。 |
| **Core ML / ONNX Runtime / MLC LLM** | 嵌入式/移动端运行时 | 分别面向 Apple 端侧、跨平台和多目标编译（包括浏览器/WebGPU）。 |

---

## 平台模型：Apple Foundation Models

在 iOS 和 macOS 上，首先要问的不是打包哪个运行时，而是操作系统自带的模型是否足够。Apple 第三代基础模型家族于 2026 年 6 月 8 日公布，随 iOS 27 周期交付（iOS 27 的 App Store 提交于 9 月 9 日开放），包含五个成员：

| 模型 | 运行位置 | 说明 |
|-------|---------------|------------|
| AFM 3 Core | 端侧 | 3B 稠密模型 |
| AFM 3 Core Advanced | 端侧 | 20B 稀疏模型、原生多模态，每次请求激活 1B 至 4B 参数；完整模型存于 NAND 闪存，只将选中的专家加载到 DRAM |
| AFM 3 Cloud | Private Cloud Compute | 服务端模型 |
| ADM 3 Cloud (Image) | Private Cloud Compute | 图像生成与编辑 |
| AFM 3 Cloud Pro | Private Cloud Compute，运行在 Google Cloud 的 NVIDIA GPU 上 | 智能体工具使用与复杂推理 |

Apple 表示，它采用了量化感知训练，并与 Google 合作构建这些模型。其中有两项可迁移的设计经验：
- **驻留闪存的稀疏模型**打破了“手机只运行 1-3B 模型”的*总参数量*规则：将专家放在存储中，每次只按路由将所需专家分页加载到 DRAM，使 DRAM 只承载活跃部分。此时延迟取决于闪存带宽以及每次请求路由的可预测性。
- **设备到云端的升级路径是平台的一部分。**应用可以先在端侧处理，再在 Apple 的隐私保障下升级至 Private Cloud Compute；操作系统直接提供了本章建议的混合架构。

应核对目标操作系统版本的 Foundation Models framework 向第三方应用开放了哪些模型，并为不支持 Apple Intelligence 的设备准备回退路径。

---

## 为什么 Ollama 不是生产服务器

Ollama 和 LM Studio 非常适合原型验证，但并不适合共享生产端点，这一点有明确的架构原因。

Ollama 默认以很低的并行度服务请求，并对超出的请求采用先进先出队列；队列满时会返回错误。每个并行槽位都会静态倍增上下文内存分配。LM Studio 为单用户场景构建，缺少限流与鉴权。两者都未设计为把并发需求转化为吞吐量（throughput）。

**vLLM** 则通过两个机制做到这一点：**PagedAttention**（将 KV 缓存存储为非连续块，类似操作系统分页，能把朴素服务中的 60%-80% KV 内存浪费降到约 4% 以下）和 **continuous batching**（将已完成请求换出，并在批处理中间接纳排队请求）。Red Hat 的一项一手基准测试显示：在单台数据中心 GPU 上运行一个 8B 模型时，vLLM 达到约 **793 tokens/sec**，而 Ollama 约 **41 tokens/sec**，差异约 19 倍，并且尾延迟更低；即便是调优后的 Ollama 在所有并发级别下仍落后。

结论不是“vLLM 调优更好”，而是结构性差异：Ollama 与 LM Studio 是串行处理，vLLM 持续批处理并分页 KV 缓存。单用户场景下差距不大；在并发场景下会接近 16-20 倍。一个诚实的说明：大多数公开对比都在数据中心 GPU 上运行，以隔离*软件差异*，因此不要把“vLLM 胜过 Ollama”解读为“GPU 胜过 Mac”。

Mac 上的这一差距正在缩小。vllm-metal 将 vLLM 的连续批处理和分页 KV 缓存带到 Apple Silicon，因此大内存 Mac 上的共享端点（团队服务器、企业内设备）不再必须使用 Ollama 的串行队列。

---

## 何时本地优于云端（以及何时不然）

**应偏向本地或边缘的情况：**
- **隐私或受监管数据**不能离开设备（HIPAA、GDPR、合同居住地要求）。这里有一个补充：主流 API 提供商已提供零数据保留企业级方案，因此“隐私”不再单独自动意味着必须本地部署。但最新前沿档位也附带条件：Claude Fable 5.1 要求保留数据 30 天，除非 Anthropic 明确授权零数据保留（ZDR）；OpenAI（自 2026 年 8 月 19 日预览的 Private Safety Processing）与 Anthropic（9 月 1 日宣布、计划当年秋季晚些时候分阶段推出的 Enterprise Frontier Safeguards）也在将 ZDR 与自动安全监控结合。应逐模型阅读数据保留条款，而非只按供应商判断。
- **离线或气隙（air-gapped）**运行（现场设备、关键基础设施）。
- **延迟底线要求**：端侧可去掉网络往返（通常 50-200ms），这对交互回路很关键；但总响应延迟仍由模型和硬件共同决定。
- **稳定高并发量下的成本**：按 2026 年 10 月租赁价格，两张 H100（每月约 $4,000）运行 70B 级开源模型，与 $2/$10 API 档位的盈亏平衡点约为每月 1B token（每天约 33M）；而与 GPT-6 Luna 等最低价档位比较，平衡点约为每月 20B token，达到或超过两张 GPU 的可持续能力（计算示例见[成本优化实践手册](07-cost-optimization-playbook.md#面试问题-interview-questions)）。已经购置的边缘硬件会改变计算结果，所以平衡点取决于工作负载和质量门槛。

**在以下情况下应留在云 API：**需要前沿质量、需求尖峰/不确定（会产生空闲 GPU 成本；约 50% 折扣的 batch endpoint 在中等量通常优于本地）、低到中低量（低于盈亏平衡线时 API 总成本更低），或团队缺乏运行 vLLM 所需的自动扩缩容与监控能力。2026 年的共识通常是**混合模式**：小规模、私有、离线或对成本敏感路径本地化，重负载、前沿或突发路径走云端，在同一产品内协同。

---

## 本地服务的量化（Quantization for Local Serving）

量化（quantization）是本地服务可行的关键；[Quantization Deep Dive](../03-training-and-adaptation/07-quantization-deep-dive.md) 已讲解其数学原理，本节只聚焦部署层。

**GGUF** 是 llama.cpp、Ollama 与 LM Studio 使用的本地模型格式。常见量化等级在质量与体积间做权衡：Q4_K_M 通常是工程上最实用的平衡点（相比 FP16 约 1%-3% 的质量损失，体积约四分之一），Q5_K_M 在代码与推理任务上明显更好，损失通常低于约 1%，Q8_0 在约半 FP16 时几乎无损，而 Q2/Q3 节省内存最多，但数学与推理质量会下降 5-10% 甚至更多。

上一条规则适用于对按 16 位训练的模型进行朴素后训练量化。原本就针对低位宽构建的模型表现不同。PrismML 的 **Ternary Bonsai 2 27B**（2026 年 9 月，Apache 2.0，衍生自 Qwen3.8-27B）在 5.95 GB 文件中平均每权重使用 1.72 位，报告称在 14 个思考模式基准上保留 FP16 质量的 98.2%，RTX 5090 上解码约 130 tok/s，M5 Pro 上约 28 tok/s（均为厂商自报）。限制在于它只能运行于 PrismML 的 llama.cpp 和 MLX 分支。另一个极端是 Cactus Compute 的 **Needle 3**，一个 121M 参数的工具调用和抽取模型，压缩到每权重约 2 位、单文件 8-29 MB。相比自行量化，应优先选用供应商提供的 QAT 版本（Google 为 Gemma 系列提供 QAT int4 构建，包括 Gemma 4 12B）。

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
| 27B 三值模型（约 1.7 位） | 约 6-8 GB | 8 GB+ GPU 或 16 GB Mac，需使用供应商的运行时分支 |
| 70B | ~40 GB+ | 高端或双 GPU；64 GB+ Mac；或数据中心显卡 |
| 200B+ | 48 GB+，常见多 GPU / 128 GB+ 统一内存 | 多 GPU 机架；大内存统一池工作站 |

说明：
- **消费级 GPU**通常在 24-32 GB VRAM 打顶，这通常是本地模型规模的关键瓶颈。
- **Apple Silicon** 在 CPU 与 GPU 间共享同一内存池，因此系统内存可作为 VRAM 使用，使大内存 Mac 能托管普通离散 GPU 同价位下无法承载的模型。Apple 的 MLX 路径持续优化：Ollama 的 MLX 后端报告在 Apple Silicon 上通过统一内存获得了可观的 prefill 与 decode 提升，并正成为受支持架构的默认后端；另有单独更新加入了 NVFP4，这是 NVIDIA 的 4-bit 浮点格式（非 Apple 格式），据报比 Q4_K_M 快约 20%。
- **NPUs** 在手机与 AI PC 上常见很高的 TOPS，但教学中的关键点是：TOPS 本身不能直接预测 LLM 速度，因为算子支持与内存带宽会限制实际性能。NPU 更适合轻量、节能任务；重型本地推理仍是离散 GPU 领先。
- **移动端**受带宽与内存限制：手机可行的*稠密*模型通常是小于 1B 到约 3B（MBZUAI 将其开放的 K2 Horizon 3.7B 和 7B 定位于手机、0.9B 定位于手表），旗舰机可用应用内存也常低于 4 GB，而移动内存带宽比数据中心 GPU 低 30-50 倍。端侧常用标准是 4-bit 量化。专家驻留在闪存的稀疏模型可提高总参数量上限（Apple 的 20B AFM 3 Core Advanced 每请求激活 1-4B），而不会提高 DRAM 预算。

### 小模型各有所长

端侧更有用的答案往往是多个小型专用模型，而非一个通用模型：

| 任务 | 2026 年开源模型示例 | 说明 |
|-----|---------------------------|-------|
| 工具调用、路由、抽取 | Cactus Needle 3（121M，Apache 2.0） | 单文件 8-29 MB；厂商称其在移动端工具调用上胜过尺寸为其 10x 的模型 |
| 手机或手表上的通用助手 | K2 Horizon 0.9B / 3.7B / 7B（Apache 2.0，训练数据开放） | 0.9B 支持 128K 上下文；3.7B 和 7B 支持 512K |
| 面向企业的小模型，不使用中国来源权重 | IBM Granite 4.2 3B / 8B（Apache 2.0） | 官方提供 FP8、MXFP4、NVFP4、GGUF 和 MLX 构建 |
| 笔记本级多模态（文本、图像、音频、视频） | Gemma 4 12B（Apache 2.0） | 无编码器设计；官方提供 QAT int4 构建 |
| 本地编程智能体 | MiMo-V2.6-Distill-Qwen-9B（MIT） | 厂商报告 SWE-bench Verified 得分 61.1% |
| 笔记本上的推理 | Ternary Bonsai 2 27B（Apache 2.0） | 需要 PrismML 运行时分支 |

---

## 从原型到生产

1. 使用 Ollama（CLI）或 LM Studio（GUI）在 GGUF Q4_K_M 模型上做原型；在最小可行模型上验证质量和提示词（prompt）。
2. 选择在目标硬件上可落地且带 KV 缓存余量的最大模型与最高量化质量。
3. 对任何并发端点切换服务引擎：vLLM（NVIDIA 或 AMD）、vllm-metal（Apple Silicon）、SGLang 或 TensorRT-LLM（NVIDIA 峰值性能）。保持 OpenAI 兼容 API（OpenAI-compatible API），让应用侧代码几乎不改。
4. 对于移动端或边缘端，先核对平台模型（iOS 27 上的 Apple Foundation Models framework）。否则导出到 ExecuTorch、Core ML 或 ONNX Runtime / MLC LLM，量化到 4-bit（优先选用供应商 QAT 构建），并预留小于 4 GB 的 RAM 与带宽上限。

常见陷阱：将 Ollama 或 LM Studio 当作服务器使用（它们在负载下是串行化）；内存估算时遗漏 KV 缓存（长上下文乘并发槽位可能主导）；过度量化（Q2/Q3 会伤害推理能力）；把“vLLM 胜过 Ollama”误解为“GPU 胜过 Mac”；将 NPU TOPS 当作 LLM 速度指标；将引擎与硬件匹配错位（vLLM 优先面向 GPU，但如今可通过 vllm-metal 运行在 Apple Silicon 上；MLX 只支持 Apple，llama.cpp 是可移植兜底方案）；以及在未确认运行时能否加载时就采用特殊的低位宽格式。

**成熟度：**服务器端本地服务已具备生产成熟度（vLLM 已广泛部署，且具备 OpenAI 兼容 API）。端侧与移动端对小型稠密模型（小于 1B 到 3B）和操作系统提供的模型已可生产就绪，但对 frontier 模型尚不足；NPU 作为 LLM 引擎仍处于早期阶段；在 2026 年，离散 GPU 和大统一内存 Mac 仍是可信的本地主路径。基准测试正在跟进：MLPerf Inference v6.1 新增了上下文随多轮对话增长的 Edge Agentic 测试。

---

## 面试题

### 问：一个团队在 Ollama 上做了原型，想要作为共享 API 上线，应该改什么？为什么？

**标准回答：**
Ollama 不适合作为共享端点。它以有限并行度服务请求，并以先进先出队列处理超载请求，因此并发下延迟会飙升且请求可能失败。修正方案是将服务引擎切换到 vLLM（或 SGLang、TensorRT-LLM），并保持同一套 OpenAI 兼容 API（OpenAI-compatible API），这样应用几乎无需改动。vLLM 的优势在结构上，不只是调优：PagedAttention 以非连续块存储 KV 缓存，消除大部分内存浪费；continuous batching 能在批处理过程中替换完成请求与排队请求，使并发需求转为吞吐量。官方基准显示在负载下吞吐量约提升一个数量级，尾延迟也显著更低。我还会结合目标 GPU 调整模型和量化级别并预留 KV 缓存冗余，同时加入 autoscaling（自动扩缩容）和监控能力，这些 Ollama 都不具备。

### 问：何时会在云 API 上选择本地或端侧推理（on-device inference）？

**标准回答：**
当出于隐私或数据驻留（residency）要求而不能让数据离开设备、系统必须离线或气隙运行、为了降到最低网络往返延迟需要端侧推理，或稳定高吞吐使预留 GPU 优于按 token 计费时，我会选本地：两张租用的 H100 与 $2/$10 API 档位的盈亏平衡点约为每月 1B token，但无法仅凭价格胜过最便宜的 API 档位。对于 frontier 质量需求、负载尖峰场景（空闲 GPU 会浪费成本）、低于盈亏平衡点的低量需求，或者团队缺乏支撑自动扩缩容与监控的运维能力，我会继续使用 API。实践中通常是混合模式：小规模、私有、离线路径走本地量化模型，重负载、frontier 或突发路径走云端。对于手机，应规划小于 1B 到 3B 的稠密模型，或在可用时使用操作系统提供的模型，因为移动端受内存与带宽约束。我还会逐模型核对数据保留条款，不能假定云端一定支持 ZDR；某些前沿档位如今要求数据保留或安全监控。

### 问：要在 iOS 应用中推出 AI 功能，应打包自有模型，还是使用 Apple Foundation Models？

**标准回答：**
先试操作系统模型，只有证明有必要时才打包。Apple 的端侧模型随系统提供，无需下载、不会增加应用体积，也不会让第二个模型争夺内存；第三代家族增加了 20B 稀疏端侧模型，其专家驻留闪存、按请求加载到 DRAM，并提供升级到 Private Cloud Compute 处理更复杂推理的路径。我会用自己的评测集对功能做原型。只有评测表明系统模型无法完成任务（例如未经针对性训练的领域或无法满足严格输出格式）、需要 iOS 与 Android 完全相同的行为，或必须支持没有 Apple Intelligence 的设备时，才打包自有模型。如果打包，我会选通过评测的最小专用模型（低于 200M 的工具调用模型或 1-3B 稠密模型），使用供应商提供的 QAT int4 构建，通过 Core ML 或 ExecuTorch 导出，并在可用设备上仍优先使用系统模型。无论哪种选择，评测集都是关键资产，因为系统模型会随操作系统升级而变化。

---

## 参考资料

- Red Hat Developer，《["Ollama vs vLLM: a deep dive into performance benchmarking"](https://developers.redhat.com/articles/2025/08/08/ollama-vs-vllm-deep-dive-performance-benchmarking)》
- vLLM，[文档](https://docs.vllm.ai/) 与 [PagedAttention 博客](https://blog.vllm.ai/2023/06/20/vllm.html)
- Ollama，[now powered by MLX on Apple Silicon](https://ollama.com/blog/mlx) 与 [并发 FAQ](https://docs.ollama.com/faq)
- PyTorch，[Introducing ExecuTorch 1.0](https://pytorch.org/blog/introducing-executorch-1-0/)
- Chandra 与 Krishnamoorthi（Meta），[“On-Device LLMs: State of the Union, 2026”](https://v-chandra.github.io/on-device-llms/)
- Apple Machine Learning Research，[“第三代 Apple Foundation Models 介绍”](https://machinelearning.apple.com/research/introducing-third-generation-of-apple-foundation-models)
- vLLM，[vllm-metal 发布版本](https://github.com/vllm-project/vllm-metal/releases)
- PrismML，[Ternary Bonsai 2 27B](https://huggingface.co/prism-ml/Ternary-Bonsai-2-27B-gguf)

---

*Next: [Prompt Engineering Fundamentals](../05-prompting-and-context/01-prompt-engineering-fundamentals.md)*
