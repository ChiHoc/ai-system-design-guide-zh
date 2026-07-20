import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { h } from 'vue'
import HomeTopicIndex from './HomeTopicIndex.vue'
import MermaidDiagram from './MermaidDiagram.vue'
import SyncMeta from './SyncMeta.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('HomeTopicIndex', HomeTopicIndex)
    app.component('MermaidDiagram', MermaidDiagram)
  },
  // 在正文底部统一呈现来源与同步信息，避免修改 143 个译文文件。
  Layout: () => h(DefaultTheme.Layout, null, {
    'doc-after': () => h(SyncMeta),
  }),
} satisfies Theme
