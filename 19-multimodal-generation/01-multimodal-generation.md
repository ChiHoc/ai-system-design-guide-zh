# 多模态生成

生成图像、视频和音频，是一个与理解它们完全不同的工程问题。一个生成式媒体产品，本质上是一个**长时间运行、非确定性、成本高昂的作业**组成的**资产处理流水线（asset-processing pipeline）**，而大部分工作都在于安全地编排这些作业、证明来源（provenance），以及评估你无法精确复现的质量。本章先讨论这些长期存在的问题，并将具体模型视为易失快照（perishable snapshot）。除非与主来源关联，下面的每个能力数值都应视为公开报告或厂商声明。

**范围说明（先读）：** 这个主题对创意、媒体、营销、游戏和 avatar 产品是承重内容，而对后端服务、数据平台、RAG 和纯文本智能体而言基本是噪音。任何触及用户上传或 AI 生成媒体的产品，都需要关注的唯一一项是**来源与安全（provenance and safety）**，因为法律义务附着在生成或分发合成媒体上，而不是附着在你的业务领域上。如果你的系统从不输出像素或波形，那么只需要这一节。

## 目录

- [生产流水线模式](#生产流水线模式)
- [来源与安全](#来源与安全)
- [生成质量评估](#生成质量评估)
- [模型格局](#模型格局)
- [面试问题](#面试问题)
- [参考文献](#参考文献)

---

## 生产流水线模式

这是任何模型都不会超越的部分。

**编排是 DAG，不是一次调用。** 典型的创意流水线是一个阶段图，往往每一阶段都来自不同厂商的不同模型：`prompt -> image (keyframes/style) -> image-to-video -> lip-sync -> voice/TTS -> music/SFX -> mux`。长期适用的经验是**在阶段边界做职责分离（separation of concerns）**，这样任何阶段都可替换，这与 [voice agents](../18-voice-and-audio-agents/01-realtime-voice-agents.md) 章节所讲的级联式与单体式（cascaded-versus-monolithic）权衡相同。节点图工具（如 ComfyUI）已经把这一点在图像和视频里制度化；应将工作流图视为版本化代码，而不是 UI 状态。

**异步、队列和长任务处理是强制要求。** 图像生成通常以秒计；**视频生成每个 clip 往往需要几十秒到几分钟**，因此同步请求根本无法承受。通用模式是：提交后立即返回作业 ID，任务在 GPU worker 池中执行，客户端通过 webhook 回调获知完成情况（同时保留轮询兜底，因为 webhook 可能丢失）。必须验证 webhook 签名，并按队列深度而不是 CPU 来**自动扩缩容（autoscale）**。由于单个视频作业会真实消耗金钱和时间，需为每个逻辑请求附带幂等键（idempotency key），以免客户端重试或重复投递的 webhook 让你付两次钱。

**成本与时延控制**，按大致收益排序：基于完整请求指纹缓存（prompt 加全部参数加 seed 加模型版本），让完全相同的请求永远不会重复计费；先用低成本方式草拟（低分辨率、少步数、小型快速模型），然后只对已批准的草稿做全质量重渲染，这是视频里最大的节省项；在支持时做批处理；有意识地选择档位（turbo 和 distilled 变体会用质量换来显著的时延和成本收益）；并保持常驻 worker 池，因为加载一个多 GB checkpoint 可能需要几十秒。

**资产与 prompt 管理。** 将 prompt、negative prompt、seed、模型及版本，以及所有条件输入（control maps、参考图像、adapter ID 和权重）都作为结构化、可版本化记录，与每个输出一并存储。没有完整参数集，你无法复现或调试一次生成，而提供方也会在稳定名称下悄悄更换模型。这个 manifest 同时也是你的来源日志。

**Seed 与可复现性，残酷的事实。** Seed 可以让一次*本地固定（local, pinned）*运行可复现，但一旦跨越硬件或 batch 边界，可复现性就会下降，而在托管 API 上几乎不存在。根因是通用性的，而不是生成式特有的：浮点运算不满足结合律，所以不同 GPU kernel 的累加顺序不同；batch size 会改变 kernel 策略（这是数值噪声最常见的来源）；而某些 GPU 操作如果不显式强制就是非确定性的。实务立场是：在自托管、固定硬件、固定 batch、固定库版本并使用 seed 的前提下，可以获得近似可复现的图像；而任何托管 API，尤其是视频，都应视为不可复现，因此 QA 应围绕感知相似度来设计，而不是围绕完全一致。

---

## 来源与安全

技术会更迭；但标注义务，以及无法被完美执行的现实，才是长期存在的。两层互补机制，**而且两者都可以被移除。**

**C2PA / Content Credentials** 是一个开放标准，它通过密码学把来源绑定到资产上（媒体的“营养标签”）。一个 manifest 包含关于创建和编辑的断言、一个签名声明，以及对源资产的引用，其中包括**硬绑定**（字节级哈希，防篡改）和**软绑定**（能在重编码后存活的指纹或水印）。“Durable Content Credentials” 会通过在外部仓库里查找仍然存活的水印或内容指纹来恢复被剥离的 manifest，这种机制之所以存在，正是因为重编码和截图会让 manifest 与资产分离。采用正在真实发生并持续增长：主流图像和视频生成器现在会附加 C2PA 元数据和水印，一些相机厂商在拍摄时就对照片签名，平台也会读取 credentials 以加上 AI 标签。一个值得教学的警示案例是：某相机厂商在签名密钥出现漏洞后先启用、后暂停了 C2PA，因为信任模型只与密钥托管（key custody）同样可靠。

**水印（SynthID 风格）**会向生成媒体添加一个不可感知信号。对工程师而言，长期有效的注意事项是：**不可见水印并不能抵御有动机的攻击者。** 同行评审研究表明，重生成攻击（加噪、再用扩散模型去噪）可以在不明显损伤质量的前提下，把不可见图像水印降到扰动阈值以下并将其移除；文本水印则会被 paraphrase 和 back-translation 削弱。水印可以威慑随手滥用并支持平台标注；但它们无法阻止攻击者。应当把 C2PA 签名 provenance、一个能在元数据被剥离后仍然存活的水印，以及基于分类器的检测叠加起来，并假设每一层单独都可能被攻破。

**安全过滤器**会在返回资产前对输入做审核（阻断禁止的 prompt）并对输出做审核（NSFW 和身份分类器）。高严重级别类别包括非自愿亲密影像、真实人物 deepfake、未经同意的语音克隆，以及版权或肖像权侵权；缓解措施包括 prompt 和区域黑名单、已知人脸拒绝、基于同意的相似肖像门控、限流，以及与来源 manifest 绑定的滥用日志。

**2026 年监管背景**（这部分会波及那些只是托管媒体的非媒体产品）：EU AI Act 的透明性条款要求提供方以机器可读方式标记生成输出，并要求部署方披露 deepfake；相关义务自 2026 年 8 月起适用（见 [AI Governance and Compliance](../13-reliability-and-safety/04-ai-governance-and-compliance.md)）；美国 TAKE IT DOWN Act（2025）针对包括 AI deepfake 在内的非自愿亲密影像，要求平台承担下架义务；而各州的 likeness 法律（如 Tennessee ELVIS Act 以及许多关于 sexually-explicit deepfake 的法规）保护声音和肖像。音乐和语音生成还额外伴随悬而未决的版权诉讼，这使得模型许可和赔偿条款成为一个真实的采购问题。

---

## 生成质量评估

两个不可回避的事实：自动指标很弱，而人类偏好才是真实地面真值，但代价高昂。

**自动指标及其不可靠性。** FID 这个长期使用的图像指标与人类评审者的结论并不一致，会错误处理失真，而且在现实样本规模下存在偏差和不稳定性；CLIPScore 衡量的是文本-图像对齐，但可以被操纵，而把几个弱指标拼在一起也不会变成强指标。FVD 继承了 FID 的问题，并且在视频常见的小样本规模下也不稳定。对音频而言，FAD 是 FID 的类比，具有同样的注意事项，而 MOS（主观 1-5 分）在 TTS 已接近人类质量的今天也受到了天花板限制。应把这些指标当作粗粒度信号，而不是正确性判断。

**人类偏好才是 gold standard。** 这个领域用盲测的 pairwise arena，通过大量投票按 Elo 或 TrueSkill 对图像和视频模型排序。应把公开 arena 排名视为粗信号，并在*你自己的* prompt 分布上验证，遵循 [benchmarks](../14-evaluation-and-observability/03-benchmarks-and-leaderboards.md) 章节对 LLM 所要求的同样纪律。

**针对不可复现流水线的回归测试**是长期可行的做法，因为提供方会在稳定名称下悄悄更新模型。构建一个版本化的 golden prompt 集，覆盖你的真实用例和失败模式；在托管 API 上放弃 exact match，改为比较*分布*；使用感知相似度（perceptual hashing、SSIM、相对基线的 CLIP-embedding distance）而不是等值判断；再用 VLM-as-judge 按 rubric（prompt 遵循度、伪影、品牌安全）去评估哈希看不到的内容；持续跟踪 judge 和指标分布，并对 drift 告警，因为这通常意味着上游提供方更换了模型；并在 API 允许时固定到带日期的模型版本。发布门槛应基于统计显著性，而不是原始差值，并且让 prompt 独立于模型进行版本化。

---

## 模型格局

这里保持简短且带时效性，因为这个领域每个月都在变化，而且大量流传的规格细节都来自低质量来源。

- **图像。** 开源权重前沿由 FLUX 系列领跑（最近的一个版本是一个大型 rectified-flow transformer，经过量化后可在单张高端消费级 GPU 上运行，并且在角色或风格参考上无需微调）；Stable Diffusion 系列仍然是最广泛的工具基础。需要重点强调的授权陷阱是：open weights 不等于 open use，因为若干变体（`dev` 线）是非商业用途，商业工作需要付费许可，而蒸馏版 `schnell` 则采用宽松许可（Apache-2.0）。条件控制是可组合的：ControlNet（从姿态、深度、边缘或分割图获得结构控制）、reference adapters（把图像作为风格或相似性提示）、inpainting 和 outpainting，以及区域提示（regional prompting）；生产组合通常是一个 identity adapter 加结构控制再加文本主题，放在同一个图里。LoRA 仍然是风格或主体个性化的默认方案。
- **视频。** 专有 API 领跑者（OpenAI 的 Sora 2、Google 的 Veo 及其原生同步音频，以及来自 ByteDance、Kuaishou、Runway 等的强劲竞争者）位于一个快速进步的开源权重层之上。一个值得标注的更正，也是本节快速失效的现实案例：OpenAI 在 2026 年 3 月弃用了 Sora 2 / Videos API（据报道后来于 2026 年晚些时候关闭），并很快停用了消费者版 Sora 应用，所以在基于任何视频模型构建之前，都要先验证其状态，而不是相信任何快照，包括本章。计费按输出秒计算（大致每秒几美分到不到一美元），生成耗时几十秒到几分钟，且输出不可复现，这就迫使你采用异步作业、先草稿后渲染，以及严格的按用户成本上限。
- **音频。** 语音和 TTS（ElevenLabs 是参考基准，带有克隆和 dubbing）以及音乐（Suno 和 Udio，正处于持续进行的版权诉讼和许可和解之中）。与语音章节中的拆分方式相同：原生联合音视频同步最好，但控制最少；而级联方式（先生成静音视频，再分别加入 TTS 和音乐并单独做 lip-sync）则提供独立控制和配音能力，但代价更高，这也是为什么大多数生产级配音流水线仍然保持级联。

---

## 面试问题

### Q: 设计一个把脚本转换为带旁白、配乐视频的服务骨架。难点是什么？

**优秀回答：**
骨架是一个异步 DAG 的多阶段流水线，每个阶段都用可替换模型：prompt 到关键帧图像、image-to-video 负责运动、TTS 负责旁白、音乐模型生成配乐、lip-sync 将语音绑定到视频，最后再做 mux。由于视频生成通常耗时几十秒到几分钟，所以每一阶段都是一个作业：提交后返回 ID，任务在按队列深度自动扩缩容（autoscale）的 GPU worker 池中执行，完成后通过 webhook 通知，并保留轮询兜底。难点在成本和可靠性。成本方面：要基于完整请求指纹做缓存，先低成本草拟，再只把已批准的草稿重渲染到全质量，并对单用户支出设置上限，因为每次重试都是真金白银。可靠性方面：要附加幂等键，确保重试或重复投递的作业不会重复计费，并为每个资产保存一份包含 prompt、seed、参数和模型版本的完整 manifest，既用于调试，也作为来源记录。我还会加上输入和输出审核，并挂载 C2PA credentials，因为合成媒体的义务与业务领域无关，始终适用。

### Q: 当输出不可复现时，你如何对生成流水线做回归测试？

**优秀回答：**
你要放弃 exact match，改为感知和统计测试。我会维护一个版本化的 golden prompt 集，覆盖真实用例和已知失败模式，并在每次变更时运行它。在可复现的场景下，比如自托管、固定硬件并使用 seed，我可以用 seed 锁定校验；在托管 API 上我默认不可复现，因此比较的是指标分布而不是单个输出，并使用感知相似度、perceptual hashes、SSIM，以及相对于基线的 CLIP-embedding distance，再加上按 rubric 评分的 VLM-as-judge 来检查 prompt 遵循度和伪影。我会持续追踪这些分布并对 drift 告警，因为突然的变化通常意味着提供方在稳定模型名下静默更新了模型，所以在 API 允许时我也会固定到带日期的模型版本。发布门禁基于统计显著性，而不是原始差值，并且让 prompt 独立于模型进行版本化，以便把回归归因到正确的变更。

---

## 参考文献

- [C2PA specification](https://spec.c2pa.org/) (Content Credentials)
- "Invisible Image Watermarks Are Provably Removable Using Generative AI" (NeurIPS 2024, arXiv:2306.01953)
- Google DeepMind, [SynthID](https://deepmind.google/science/synthid/)
- "Rethinking FID: Towards a Better Evaluation Metric for Image Generation" (CVPR 2024) arXiv:2401.09603
- Black Forest Labs, [FLUX](https://bfl.ai/) and its [licensing](https://bfl.ai/licensing)
- EU AI Act [Article 50](https://artificialintelligenceact.eu/article/50/) (transparency for generated content)

---

*Previous: [Real-Time Voice Agents](../18-voice-and-audio-agents/01-realtime-voice-agents.md)*
