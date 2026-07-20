# 上游同步运行手册

## 日常流程

1. `git fetch upstream main`。
2. 运行 `npm run sync:check`；`current` 直接结束，`blocked` 停止并报告。
3. 从最新 `main` 创建 `sync/upstream-<short-sha>` 分支。
4. 对新增、修改、重命名和删除文件执行三方更新：旧英文来自 `translation-state.json` 的同步基线，旧中文来自当前分支，新英文来自 `upstream/main`。
5. 使用全新 Codex 上下文校对语义；代码、数字、链接、表格与 Markdown 结构必须保持。
6. 更新 `translation-state.json`，依次运行 `npm test`、`npm run validate`、`npm run docs:build`。
7. 推送分支并创建待审 Pull Request，不自动合并。

## 失败合同

- 上游非快进、三方定位不可靠、验证失败或主分支竞态时，不推送不完整译文。
- 创建或更新标题为 `[sync] upstream-sync-blocked` 的唯一 Issue，并附上提交范围、失败阶段和可复现命令。
- 后续同步成功后关闭该 Issue。
