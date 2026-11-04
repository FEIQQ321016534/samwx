# 山姆邻里拼 · 微信小程序与多商户后台

沿用原有界面的烟台同城代购/大包装拼份系统，支持社区自提、送货到家、多代购商、采购批次、库存、订单、售后和内部账本。

当前提供**受控线上体验测试**，真实微信支付尚未接入。测试付款仅允许在独立UAT环境，由平台管理员批准真实微信顾客后使用；不会产生真实扣款或配送。测试库不得作为正式业务库。

## 项目组成

| 路径 | 内容 |
| --- | --- |
| `apps/miniprogram` | Taro + React + TypeScript，微信小程序与H5联调预览 |
| `apps/admin` | 正式/测试运营管理台，React + Vite |
| `apps/api` | Node.js 24 + Fastify + SQLite，认证、订单、库存和账本 |
| `packages/domain` | 共享类型和整数分计费规则 |
| `ui-reference/src` | 原始UI源码基准，用于对照与生成本地插画 |
| `deploy` | 通用容器、代理和UAT部署模板 |
| `tools` | 备份恢复、验证和AppID配置工具 |

生成的图片资产已随源码提供，私钥、环境密钥、数据库、实际运维记录和截图均不入库。AppSecret只能放服务端，不能放小程序或浏览器配置。

## 本地启动

需要 Node.js 24、npm 和微信开发者工具。各应用独立安装锁定依赖：

```sh
npm --prefix apps/api ci
npm --prefix apps/admin ci
npm --prefix apps/miniprogram ci
```

分别运行API和管理台：

```sh
npm run dev:api
npm run dev:admin
```

管理台默认 `http://127.0.0.1:5173/`，本地API默认 `http://127.0.0.1:8787/api`。开发身份和模拟资金只用于回环地址上的本地开发。

```sh
npm run build:miniapp
npm --prefix apps/miniprogram run build:h5
```

微信开发者工具导入 `apps/miniprogram/dist/`。配置自己的AppID可使用 `node tools/set-appid.mjs wx开头的AppID`。本项目的公开AppID及域名配置不是认证密钥，其他部署必须替换为自己有权限的账号和接口。

## 线上体验测试

- 管理后台：<https://sam.mmailife.com/>
- 独立测试后台：<https://sam.mmailife.com/uat/>
- 测试接口：`https://sam.mmailife.com/uat/api`

```sh
npm run build:uat
```

体验包输出到 `apps/miniprogram/dist-uat/`，保留正式构建目录并开启合法域名校验。使用对应小程序的开发者微信登录开发者工具，导入体验包、上传开发版本，再在公众平台设为体验版并添加体验成员。

微信公众平台的 request 和 downloadFile 合法域名填写 `https://sam.mmailife.com`，不要填写接口路径。体验者首次微信登录后，由测试后台的「测试用户审批」开通模拟付款资格。

当前微信开发版本0.1.1已上传，管理员已确认设为体验版；真实微信登录及受控模拟付款已在线验证。完整流程见 [线上测试说明](docs/uat.md)。没有微信支付商户号也可以验证选品、拼单、测试付款、截单、采购、分装、提货、缺货退款和称重补差。

## 运营与安全

- 精确整包库存，支持半份、三分份、四分份共用库存；历史库存必须实盘后使用。
- 服务端整数分核价、订单/规格快照、幂等创建和付款/退款、跨商户隔离、操作审计与对账。
- 正式管理账号使用受控CLI创建，无默认密码；scrypt哈希、限速/锁定、会话撤销、令牌摘要和环境/数据库绑定。
- 私有凭证上传限制格式、大小与像素，去EXIF，按订单归属鉴权读取。
- 在线一致备份、媒体校验、停机恢复、安全备份和恢复后会话清理。

说明：[运营不变量](docs/operations-integrity.md)、[API接口](docs/api-contract.md)、[管理账号](apps/api/scripts/README.md)、[管理台](docs/admin.md)、[部署与恢复](deploy/README.md)。

## 验证与发布状态

```sh
npm run verify
npm run release:check
```

本地回归包含业务、安全、媒体和UAT隔离测试，以及三个应用构建和备份恢复演练。`release:check`当前应报告未达到完整商业发布条件。

真实微信支付/商户结算、PostgreSQL/COS迁移、完整真机和云端业务验收仍需完成。构建工具链仍有待处置的依赖告警，不能把某一范围的扫描结果当成全系统无漏洞。详见 [上线验收](docs/production-readiness.md)、[支付接入](docs/payment-integration.md) 和 [依赖审计](docs/dependency-audit.md)。
