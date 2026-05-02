# Leanote Desktop App

[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/leanote/desktop-app?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

Use Electron(atom-shell) to create leanote desktop app.

![preview.png](preview.png "")

## Download
Please see http://app.leanote.com

## How to develop it

### 1. 环境要求

- **Node.js**: v25.x（已验证可用）
- **Electron**: v20.3.12（作为 devDependencies 安装）
- **操作系统**: Linux（已验证，macOS/Windows 理论兼容）

### 2. Install & Run

```shell
# 1. install dependencies
$> cd PATH-TO-LEANOTE-DESKTOP-APP
$> npm i

# 2. use gulp to parse less（需要先安装 dev 目录依赖）
$> cd PATH-TO-LEANOTE-DESKTOP-APP/dev
$> npm i
$> gulp dev

# 3. run with electron
$> cd PATH-TO-LEANOTE-DESKTOP-APP
$> ./node_modules/electron/dist/electron . --no-sandbox --disable-gpu --in-process-gpu
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

#### Less 编译问题

- **`gulp-less@3.x` 与 Node v25 不兼容**：会报 `write callback called multiple times` 错误。已升级至 `gulp-less@5.0.0`。如果编译仍有问题，CSS 文件已预先生成存在，不影响运行。

#### 已修复的兼容性问题

- 移除已废弃的 `crashReporter.start()` 调用（Electron 20+ 不支持）
- `remoteMain.initialize()` 移至 `app.on('ready')` 内调用，避免初始化顺序错误
- 修复 `service.js` / `service_login.js` 中 `gui` 模块的引用路径（`./src/gui` → `../gui`）
- Electron 从 `dependencies` 移至 `devDependencies`，锁定版本 `^20.3.12`

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
5. [ ] MarkDown 升级
   - [x] 升级实时渲染的 markdown 工具（modern-markdown）
   - [x] 添加 markdown-it 及相关插件依赖
   - [ ] 增加图床
   - [ ] markdown 自动补全功能
6. [x] 修复 Electron v20 + Node v25 环境下的运行兼容性
   - [x] 升级 gulp-less 到 v5.0.0
   - [x] 修复 crashReporter / remoteMain 初始化问题
   - [x] 修复 gui 模块引用路径
   - [x] 替换远程 CDN 脚本为本地 nw-gui-shim.js
- [ ] ... 其他的等我想到了再写