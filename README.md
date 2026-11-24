# Leanote Desktop App

[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/leanote/desktop-app?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

Use Electron(atom-shell) to create leanote desktop app.

![preview.png](preview.png "")

## Download
Please see http://app.leanote.com

## How to develop it

### 1. 环境要求

- **Node.js**: v26.x（已验证可用，Node 25+ 均可）
- **Electron**: v45.4.1（作为 devDependencies 安装；首次启动时才下载二进制）
- **操作系统**: Linux（已验证，macOS 13+ / Windows 理论兼容）

### 2. Install & Run

```shell
# 1. install dependencies
$> cd PATH-TO-LEANOTE-DESKTOP-APP
$> npm i

# 2. run with electron（首次运行会按需下载 Electron 二进制）
$> npm start

# 或直接使用 electron 二进制（首次 npm start 之后才存在）
$> ./node_modules/electron/dist/electron . --no-sandbox --disable-gpu --in-process-gpu
```

### 3. Build & Package

```shell
# Linux .deb (Ubuntu 22.04, amd64)
$> ./build.sh linux

# Windows .exe (NSIS installer)
$> ./build.sh win

# Android APK (requires Android SDK)
$> ./build.sh android

# iOS (requires macOS + Xcode)
$> ./build.sh ios

# Generate PNG icons from .ico
$> ./build.sh icons
```

Output: `dist/` directory.

### 4. npm scripts

```shell
npm start             # 运行 app
npm run build:linux   # 构建 Linux .deb
npm run build:win     # 构建 Windows .exe
```

### 3. 注意事项

#### Electron 启动问题

- **`require('electron')` 返回字符串而非 API 对象**：当系统环境变量中存在旧版 Electron 的 `NODE_PATH` 或其他干扰时，`require('electron')` 可能返回二进制路径字符串，导致 `app.on is not a function` 错误。解决方案是使用 `env -i` 清除环境变量后启动：

  ```shell
  env -i HOME=$HOME DISPLAY=$DISPLAY WAYLAND_DISPLAY=$WAYLAND_DISPLAY \
    XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR DBUS_SESSION_BUS_ADDRESS=$DBUS_SESSION_BUS_ADDRESS \
    ./node_modules/electron/dist/electron . --no-sandbox --disable-gpu --in-process-gpu
  ```

- **GPU 进程崩溃**：在容器或虚拟机环境中运行时，Electron 的 GPU 进程可能崩溃（`GPU process isn't usable`）。需要添加 `--no-sandbox --disable-gpu --in-process-gpu` 参数。

#### 样式

- 业务样式已全部迁移到原生 CSS（CSS Nesting + 自定义属性），**不再需要编译**。直接编辑 `public/themes/`、`public/css/` 下的 `.css` 文件并刷新窗口即可。
- 配色主题仍通过 `public/themes/themes/<name>/theme.css` 切换；组合主题（`volumn`、`pebbles_night`、`water_night`）通过原生 `@import` 复用 `night/theme.css`。

#### 已修复的兼容性问题

- 移除已废弃的 `crashReporter.start()` 调用（Electron 20+ 不支持）
- `remoteMain.initialize()` 移至 `app.on('ready')` 内调用，避免初始化顺序错误
- 修复 `service.js` / `service_login.js` 中 `gui` 模块的引用路径（`./src/gui` → `../gui`）
- Electron 从 `dependencies` 移至 `devDependencies`（当前 45.4.1）
- 修复 note.html 中 `window.Service = window.loadService()` 调用（loadService 不存在）
- 修复登录表单 Enter 键无法提交（添加 keydown 事件监听）
- 修复暗色主题下 TinyMCE/Ace 编辑器白色背景
- 修复 markdown 预览中 emoji 图标过大（twemoji img 无尺寸约束）
- 升级 Electron 20 → 45：自定义协议改用 `protocol.handle`、渲染进程剪贴板改为主进程 IPC、`printToPDF` 统一走 Promise、移除已废弃的 `enableRemoteModule` / `makeSingleInstance` 等选项
- 修复全新安装：`needle` 依赖从已停用的 `git://` 改为 GitHub HTTPS tarball；移除未使用的 `adm-zip` / `mkdirp`，锁定 `validator` 版本
- 业务样式从 LESS 迁移到原生 CSS（CSS Nesting + 自定义属性），移除 less/gulp 编译链，CSS 文件作为源码纳入版本控制

## Docs

Please see https://github.com/leanote/desktop-app/wiki


## LICENSE

[LICENSE](https://github.com/leanote/desktop-app/blob/master/LICENSE)

```
LEANOTE - NOT JUST A NOTEPAD!

Copyright by the contributors.

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

Leanote destop app is licensed under the GPL v2.
```

## Todo List

1. [x] 更新代码引用库到最新版本，修复依赖报错
2. [ ] 文件夹导入导出功能
   - [x] 导出保存目录结构，包括顶层目录和子目录
   - [ ] 导入保存原结构
3. [ ] 高级搜索功能
   - [ ] 标题搜索
   - [ ] 全文搜索
4. [ ] 界面美化
   - [x] 增加 CJK 字体栈支持（Noto Sans CJK SC 等）
   - [ ] 自定义边栏壁纸
   - [ ] 使用时下更流行的配色和字体
   - [ ] 侧边栏文件夹美化
   ...
5. [x] MarkDown 升级
   - [x] 升级实时渲染的 markdown 工具（modern-markdown）
   - [x] 添加 markdown-it 及相关插件依赖
   - [x] 集成 highlight.js 代码语法高亮
   - [x] 重写 modern-markdown.js（token-based TOC、twemoji 修复、clean API）
   - [x] 暗色主题 hljs 语法高亮支持（VS Code dark palette）
   - [ ] 增加图床
   - [ ] markdown 自动补全功能
6. [x] 修复 Electron v20 + Node v25 环境下的运行兼容性
   - [x] 移除 LESS/gulp 编译链，样式迁移到原生 CSS
   - [x] 修复 crashReporter / remoteMain 初始化问题
   - [x] 修复 gui 模块引用路径
   - [x] 替换远程 CDN 脚本为本地 nw-gui-shim.js
7. [x] 暗色主题修复
   - [x] 修复 body/html/page 白色背景
   - [x] 修复 TinyMCE 编辑器白色背景（skin.min.css 硬编码 #FFF）
   - [x] 修复 Ace editor 白色背景（#wmd-input.ace-tm）
   - [x] 修复 emoji 图标在预览中过大（twemoji img 无尺寸约束）
8. [x] 登录与交互修复
   - [x] 登录后记住用户（跳过登录页直接进入笔记）
   - [x] 登录表单 Enter 键提交
   - [x] 移除 note.html 中无效的 loadService() 调用
9. [x] 打包与构建系统
   - [x] 集成 electron-builder（Linux .deb + Windows .exe NSIS）
   - [x] 创建 build.sh 构建脚本（支持 linux/win/android/ios 参数）
   - [x] 自动生成 PNG 图标（.ico → build/icons/）
   - [x] 构建流程不再依赖 CSS 编译（原生 CSS 直接打包）
   - [ ] Capacitor 移动端适配（需要 webpack 打包 + 适配层）
- [ ] ... 其他的等我想到了再写