import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vitepress'

const root = process.cwd()
const statePath = join(root, 'translation-state.json')
const state = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, 'utf8'))
  : { upstream_commit: 'df612278ea4c51a3cf0489cf00aa2b7bf63f22da' }

const sectionNames: Record<string, string> = {
  '00-interview-prep': '00 面试准备',
  '01-foundations': '01 基础',
  '02-model-landscape': '02 模型版图',
  '03-training-and-adaptation': '03 训练与适配',
  '04-inference-optimization': '04 推理优化',
  '05-prompting-and-context': '05 Prompt 与上下文',
  '06-retrieval-systems': '06 检索系统',
  '07-agentic-systems': '07 Agentic Systems',
  '08-memory-and-state': '08 Memory 与状态',
  '09-frameworks-and-tools': '09 框架与工具',
  '10-document-processing': '10 文档处理',
  '11-infrastructure-and-mlops': '11 基础设施与 MLOps',
  '12-security-and-access': '12 安全与访问控制',
  '13-reliability-and-safety': '13 可靠性与安全',
  '14-evaluation-and-observability': '14 评估与可观测性',
  '15-ai-design-patterns': '15 AI 设计模式',
  '16-case-studies': '16 案例研究',
  '17-tool-use-and-computer-agents': '17 工具使用与计算机 Agent',
  '18-voice-and-audio-agents': '18 语音与音频 Agent',
  '19-multimodal-generation': '19 多模态生成',
}

/** 从译文 H1 读取菜单标题，新增上游章节会自动进入侧边栏。 */
function pageTitle(path: string) {
  const heading = readFileSync(join(root, path), 'utf8').match(/^#\s+(.+)$/m)?.[1]
  return heading?.replace(/[`*_]/g, '') ?? path.split('/').pop()!.replace(/\.md$/, '')
}

function buildSidebar() {
  return readdirSync(root)
    .filter((name) => /^\d{2}-/.test(name) && statSync(join(root, name)).isDirectory())
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map((directory) => ({
    text: sectionNames[directory] ?? pageTitle(`${directory}/${readdirSync(join(root, directory)).find((name) => name.endsWith('.md'))}`),
    collapsed: directory !== '00-interview-prep',
    items: readdirSync(join(root, directory))
      .filter((name) => name.endsWith('.md'))
      .sort((a, b) => a === 'index.md' ? -1 : b === 'index.md' ? 1 : a.localeCompare(b, 'en'))
      .map((name) => ({
        text: pageTitle(`${directory}/${name}`),
        link: `/${directory}/${name.replace(/\.md$/, '')}`,
      })),
  }))
}

export default defineConfig({
  lang: 'zh-CN',
  title: 'AI 系统设计指南',
  description: '面向工程师的生产级 AI 系统设计、RAG、Agent、评估与可靠性中文指南。',
  base: '/ai-system-design-guide-zh/',
  lastUpdated: true,
  cleanUrls: true,
  // LICENSE 无扩展名，由 public/ 原样发布，VitePress 无法把它识别为页面。
  ignoreDeadLinks: ['./LICENSE'],
  sitemap: { hostname: 'https://chihoc.github.io/ai-system-design-guide-zh/' },
  vite: {
    // Mermaid 已按需拆成独立块；放宽该块告警，不增加首页首屏体积。
    build: { chunkSizeWarningLimit: 1_000 },
  },
  srcExclude: [
    'CONTEXT.md',
    'LICENSE.zh-CN.md',
    'docs/**',
    'scripts/**',
    'test/**',
  ],
  transformPageData(pageData) {
    // 通过页面 frontmatter 同时把同步基线交给 SSR 和浏览器端，避免仅客户端全局量。
    pageData.frontmatter.upstreamCommit = state.upstream_commit
    pageData.frontmatter.hasUpstreamSource = Boolean(state.files?.[pageData.relativePath])
    const route = pageData.relativePath
      .replace(/(^|\/)index\.md$/, '$1')
      .replace(/\.md$/, '')
    const canonical = `https://chihoc.github.io/ai-system-design-guide-zh/${route}`
    pageData.frontmatter.head = [
      ...(pageData.frontmatter.head ?? []),
      ['link', { rel: 'canonical', href: canonical }],
      ['meta', { property: 'og:url', content: canonical }],
    ]
  },
  head: [
    ['meta', { name: 'theme-color', content: '#ffffff' }],
    ['meta', { property: 'og:locale', content: 'zh_CN' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'AI 系统设计指南' }],
    ['meta', { property: 'og:description', content: '构建生产级 AI 系统的完整中文指南。' }],
    ['meta', { property: 'og:image', content: 'https://chihoc.github.io/ai-system-design-guide-zh/og-cover.png' }],
    ['meta', { name: 'robots', content: 'index, follow' }],
  ],
  markdown: {
    lineNumbers: true,
    config(md) {
      // Mermaid 在客户端渲染，其他代码围栏继续走 VitePress 默认高亮。
      const defaultFence = md.renderer.rules.fence!
      md.renderer.rules.fence = (tokens, index, options, env, self) => {
        const token = tokens[index]
        if (token.info.trim() === 'mermaid') {
          return `<MermaidDiagram code="${encodeURIComponent(token.content)}" />`
        }
        return defaultFence(tokens, index, options, env, self)
      }
    },
  },
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'AI 系统设计指南',
    nav: [
      { text: '学习路径', link: '/#学习路径' },
      { text: '主题', link: '/#主题索引' },
      { text: '面试准备', link: '/00-interview-prep/' },
      { text: '英文原仓库', link: 'https://github.com/ombharatiya/ai-system-design-guide' },
    ],
    sidebar: buildSidebar(),
    outline: { level: [2, 3], label: '本页内容' },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
          modal: {
            noResultsText: '未找到相关内容',
            resetButtonTitle: '清除查询',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
          },
        },
      },
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/ChiHoc/ai-system-design-guide-zh' }],
    editLink: {
      pattern: 'https://github.com/ChiHoc/ai-system-design-guide-zh/edit/main/:path',
      text: '纠正此页',
    },
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdated: { text: '最后更新于' },
    darkModeSwitchLabel: '主题',
    sidebarMenuLabel: '目录',
    returnToTopLabel: '回到顶部',
    footer: {
      message: '中文镜像内容遵循上游 MIT License。',
      copyright: '英文原作 © 2026 Om Bharatiya · 中文镜像由 ChiHoc 维护',
    },
  },
})
