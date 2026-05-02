# Leanote Desktop 迭代记录

## 日期
- 2026-03-31

## 本轮目标
- 启动 Electron 项目并确认可运行。
- 解决登录页和主界面出现中文空白/乱码的问题。
- 建立后续可持续迭代的记录基线。

## 已完成事项

### 1. 启动与依赖
- 在项目根目录安装运行依赖：npm install。
- 使用 npx electron . 成功启动应用。
- 应用可进入登录流程（note.html 加载后跳转到 login.html）。

### 2. 问题定位
- 发现界面异常是两类问题叠加：
  - 样式未编译（仅有 less，无关键 css 产物）。
  - 运行环境缺失中文字体（系统 fontconfig 未识别任何中文字体）。

### 3. 代码侧修复
- 修改登录页字体回退，增强 Linux 中文字体兼容：
  - public/css/login.less
- 修改全局主题字体变量，增强主界面中文回退：
  - public/themes/includes/vars.less

### 4. 资源构建修复
- 因 gulp less 在当前 Node 版本下出现兼容问题（write callback called multiple times），改为 lessc 直编核心样式。
- 已生成以下关键 css：
  - public/css/login.css
  - public/css/windows.css
  - public/themes/default.css
  - public/themes/presentation.css
  - public/themes/writting.css
  - public/themes/windows.css

### 5. 环境侧修复
- 安装中文字体包并刷新字体缓存：
  - fonts-noto-cjk
  - fonts-wqy-zenhei
  - fonts-wqy-microhei
- 验证结果：fc-list :lang=zh 可返回中文字体（count=35）。

## 当前状态
- Electron 可正常启动。
- 样式资源已补齐。
- 中文字体环境根因已处理。
- 之前的 DBus/Autofill 日志属于非阻塞告警，未影响主流程。

## 待验证（人工 UI 观测）
- 登录页中文是否全部恢复正常显示。
- 主界面侧边栏、工具栏、编辑区中文是否仍有个别空白字符。
- 插件区域与动态注入文本是否存在单独字体回退缺口。

## 已知风险与说明
- dev/gulpfile.js 的 less 任务在当前环境存在兼容问题，暂以 lessc 直编替代。
- 若更换机器或容器，需确认系统层中文字体仍可用。

## 建议的下轮迭代任务
1. 增加统一启动脚本（建议）：
   - 先编译 less，再启动 electron，避免新环境出现无 css 页面。
2. 修复 gulp 构建链兼容性：
   - 升级 gulp-less 或调整 Node 版本矩阵。
3. 增加启动前检查：
   - 检查关键 css 是否存在。
   - 检查 fontconfig 是否识别中文字体。
4. 收敛字体策略：
   - 在主题变量中统一保留 CJK 回退，减少页面局部覆盖导致的不一致。

## 建议执行命令（可复用）
- 安装运行依赖：
  - npm install
- 编译关键样式（当前稳定路径）：
  - cd dev
  - npx lessc ../public/css/login.less ../public/css/login.css
  - npx lessc ../public/css/windows.less ../public/css/windows.css
  - npx lessc ../public/themes/default.less ../public/themes/default.css
  - npx lessc ../public/themes/presentation.less ../public/themes/presentation.css
  - npx lessc ../public/themes/writting.less ../public/themes/writting.css
  - npx lessc ../public/themes/windows.less ../public/themes/windows.css
- 启动应用：
  - cd ..
  - npx electron .

## 备注
- 本文件为持续迭代日志，后续每轮变更请追加新日期与变更条目，不覆盖历史记录。

---

## 日期
- 2026-03-31（Markdown 渲染器升级）

## 本轮目标
- 使用现代 Markdown 渲染库替换老旧渲染链。
- 解决 emoji 等新语法渲染不足问题。
- 改善 Markdown 编辑区/预览区错位。

## 已完成事项

### 1. 引入新渲染器依赖
- 安装依赖：
  - markdown-it
  - markdown-it-emoji
  - markdown-it-task-lists
  - markdown-it-footnote
  - markdown-it-mark
  - markdown-it-anchor
  - twemoji

### 2. 替换页面渲染入口
- 已将 note.html 的 Markdown 脚本从旧版 main-v2.min.js 切换为新实现：
  - public/md/modern-markdown.js
- 新增样式：
  - public/md/modern-markdown.css

### 3. 新渲染器能力（已接入）
- markdown-it 核心解析（GFM 常见语法可用）。
- emoji 语法支持（如 :smile:）。
- 任务列表、脚注、高亮标记、标题锚点。
- 目录导航（根据 h1-h6 生成右侧/导航区链接）。
- 基础滚动定位（目录点击跳转到对应标题）。

### 4. 与现有业务代码兼容
- 保留并适配全局 MD 接口，避免上层笔记逻辑报错：
  - MD.setContent
  - MD.getContent
  - MD.insertLink
  - MD.focus
  - MD.clearUndo（兼容空实现）
  - MD.resize / MD.onResize（兼容空实现）
- 同时保留 MarkdownEditor.refreshPreview 兼容旧调用点。

### 5. 布局修复
- 将左侧编辑器统一为 textarea 并修正高度填充、预览区滚动与代码块样式，缓解错位。

## 当前状态
- 应用可启动。
- 旧 Markdown 渲染入口已替换为现代库实现。
- 新语法（尤其 emoji）具备渲染能力。

## 待验证（人工 UI）
- 新建/编辑 Markdown 笔记时实时渲染是否稳定。
- 历史笔记中的复杂嵌入（表格、脚注、任务列表）是否符合预期。
- 极端长文档下滚动同步体验是否需要进一步优化。

## 下轮建议
1. 加入高亮主题（highlight.js）并统一代码块样式。
2. 增加 Markdown 回归样例文档（emoji、表格、任务列表、脚注、数学公式）用于快速验收。
3. 若需要离线 emoji 图片，可将 twemoji 资源改为本地静态托管，避免外网依赖。
