# 小程序依赖审计与兼容验证

核对日期：2026-11-03。目录：`apps/miniprogram`。Taro 保持 `4.3.2`，未执行 `npm audit fix --force`。补丁通过 `package.json` 的 `overrides` 和提交的 lockfile 固定，未直接修改 `node_modules` 文件。

## 审计范围与当前结果

| 范围 | Moderate | High | Critical | 合计 |
| --- | ---: | ---: | ---: | ---: |
| 本轮初始 `npm audit --omit=dev` | 14 | 2 | 3 | 19 |
| 本轮最终 `npm audit --omit=dev` | 7 | 0 | 0 | 7 |
| 本轮最终完整 `npm audit`（含开发/构建工具） | 25 | 14 | 1 | 40 |

计数包含受传递依赖影响的上层包，不能按行数理解为互相独立的漏洞。`--omit=dev` 仅描述 npm 依赖分类，不能据此断言某个包一定不会进入 H5 打包结果。当前完整工具链仍有未修复的高危和严重告警，不能据此宣布供应链审查通过或系统已达到可直接商用状态。

复核命令：

```sh
npm --prefix apps/miniprogram audit --omit=dev
npm --prefix apps/miniprogram audit
npm --prefix apps/miniprogram ls webpack webpack-dev-server webpack-dev-middleware swiper esbuild schema-utils react-refresh --depth=1
```

## 已采取的修补

| 包 | 当前固定版本 | 处理依据 |
| --- | --- | --- |
| swiper | 12.1.2 | 修复原型污染；保留 Taro 使用的 `swiper/bundle` 导出。[维护者公告](https://github.com/nolimits4web/swiper/security/advisories/GHSA-hmx5-qpq5-p643) |
| webpack-dev-server | 5.2.7 | 使用已发布的 v5 补丁版，其 Host/Origin 与代理 WebSocket 检查见[发布说明](https://github.com/webpack/webpack-dev-server/releases/tag/v5.2.7)。5.2.8 在本次 npm 查询中不存在，不能写成已安装版本。 |
| webpack-dev-middleware | 7.4.6 | 维护者目前列出的 v7 路径穿越修复版本为 7.4.6。[维护者公告](https://github.com/webpack/webpack-dev-middleware/security/advisories/GHSA-g84c-rxfj-3j2c) |
| webpack | 5.104.1 | 保持 Taro 所依赖的内部模块路径并越过当前 audit 的相关受影响区间；5.112.2 改变内部路径会导致此 Taro 版本构建失败。 |
| esbuild | 0.28.2 | 消除 Taro helper 带入的旧开发服务器跨源读取告警。 |
| sockjs → uuid | 11.1.1 | 保留 CommonJS 调用形式并升级至当前报告所要求的修复版本。 |
| lodash-es | 4.18.1 | H5 可能间接引入此库，升级同主版本修复模板导入键代码注入。[维护者公告](https://github.com/lodash/lodash/security/advisories/GHSA-r5fr-rjxr-66jc) |
| glob 的 v10 分支 | 10.5.0 | 修复 CLI `--cmd` 注入；旧分支的 minimatch 中危链仍保留在报告中。[维护者公告](https://github.com/isaacs/node-glob/security/advisories/GHSA-5j98-mcp5-4vw2) |

`schema-utils` 仅对 v4 分支固定为 `4.3.3`，保留 babel-loader 所需的旧分支 API。开发图像生成工具 sharp 升至 `0.35.5`。H5 开发使用显式安装的 React Refresh 插件 `0.6.3` 与符合 Taro peer 约束的 `react-refresh 0.14.2`。

## 兼容适配与验证

Taro 4.3.2 的 H5 runner 硬编码旧 `https: false` 选项，而 webpack-dev-server v5 已将该选项替换为 `server`。[官方迁移说明](https://github.com/webpack/webpack-dev-server/blob/main/migration-v5.md)

`tools/secure-dev-server.cjs` 仅由 `dev:h5` 入口预加载，删除已移除的 HTTP 旧选项并使用 v5 的 `server: 'http'`。它限定 `127.0.0.1` 和允许的本地主机，不自动打开浏览器。正式构建不预加载该适配器。默认端口沿用配置；被占用时可通过 `TARO_H5_DEV_PORT=3011` 指定另一个回环端口。此时以 webpack-dev-server 输出的真实地址为准，Taro 自己的摘要行仍可能显示原配置端口。

本轮已执行并通过：

- `npm run typecheck`。
- `npm run build:weapp`，生成 `apps/miniprogram/dist`。
- `npm run build:h5`，生成 `apps/miniprogram/dist-h5`；有动态 import 注释及 H5 bundle 体积提示，没有构建错误。
- `TARO_H5_DEV_PORT=3011 npm run dev:h5`：编译成功，首页和三个 JavaScript 入口 HTTP 200；使用直连本地 socket 的伪造 Host 请求返回 403。测试进程随后关闭。
- `npm ci --dry-run --ignore-scripts --no-audit`，检查 lockfile/peer 解析；此项不等于一次全新系统上的完整安装验收。

H5 开发测试覆盖编译、HTTP 输出与 Host 限制；没有将 HMR 视为微信真机业务验收。停止开发服务后重新执行静态 H5 构建，交付目录保留正式构建产物。

## 剩余项及处理边界

生产分类报告的七个中危条目来自 `minimatch → glob → globs → scss-bundle → @tarojs/runner-utils / @tarojs/service / @tarojs/plugin-platform-weapp`。旧调用方依赖旧 glob/minimatch 接口，未使用跨主版本强制覆盖来追求数字清零。

完整工具链报告仍包含以下直接高危/严重来源及其传递影响：

| 来源 | 所在路径/用途 | 当前处置 |
| --- | --- | --- |
| decompress 4.2.1（Critical） | Taro CLI → download-git-repo → download；模板归档解包 | 原包没有本次可直接替换并完成兼容验证的修复版本；维护中的替代包已改为 ESM。未进行未经验证的别名替换。禁止该工具链处理不受信任模板/归档，保留为工具链安全门槛未通过项。 |
| git-clone 0.1.0（High） | 旧脚手架模板下载 | 上游原包当前仍有告警；不接受外部输入拼接模板地址或调用初始化流程。 |
| adm-zip 0.5.18（High） | Taro CLI 归档处理 | 尚未完成新版本归档兼容验证，限制在受控项目构建中使用。 |
| html-minifier 4.0.0（High） | H5 构建时 HTML 压缩 | 维护替代品涉及同步/异步 API 改动，当前不强行替换；仅压缩仓库中受控 HTML。 |
| http-cache-semantics 3.8.1、decode-uri-component 0.2.2（High） | 旧下载/CLI 辅助链 | 保留告警，不处理外部提供的脚手架请求或不受信任下载输入。H5 自身使用的另一个 decode-uri-component 实例为 0.5.1，仍需按各实例区别核对。 |
| miniprogram-simulate 内旧 postcss（High） | 构建/模拟工具的 CSS 来源映射处理 | 不运行外部提供的 CSS/源码映射测试输入。 |
| serialize-javascript 6.0.2（High） | 构建工具序列化 | 保留告警，构建输入仅来自受控仓库。 |

这些措施限定了当前使用范围，没有修复上述漏洞。对外提供模板初始化、归档上传解包、非信任源码构建服务仍属于阻塞项，需要升级上游工具链或实施单独经过验证的替换方案。

正式部署使用生成的微信包或 H5 静态目录。它们不运行 Taro CLI、Git 下载器、归档解包器、Webpack 编译器或 webpack-dev-server 服务；开发服务器及完整 `node_modules` 不应作为线上前端服务目录发布。H5 中仍可包含 Taro 运行时和浏览器组件库，本轮已针对 Swiper 与 lodash-es 的实际间接引入升级版本。静态构建成功及生产分类报告没有 High/Critical，均不能替代完整工具链告警消除、真实微信支付/登录联调与业务上线验收。
