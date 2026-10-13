# 上游同步

1. 检查 `main` 工作区干净，更新 `upstream/main`，运行 `npm run sync:check`。
2. 有更新时，按变更清单翻译受影响内容；新增完整翻译，删除和重命名跟随上游。保留已有中文修订，以及代码、命令、URL、数字和非 Mermaid 代码块；Mermaid 只翻译标签。
3. 更新 `translation-state.json`，运行 `npm run validate`。
4. 校验通过后按仓库提交规范创建本地提交。自动化不推送、不创建 PR、不合并。
5. 无更新时结束。遇到无法修复的问题，保留现场并在自动化 memory 记录恢复信息。
