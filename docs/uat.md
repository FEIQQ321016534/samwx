# 线上测试环境

管理台入口为 `https://sam.mmailife.com/uat/`，小程序测试 API 为 `https://sam.mmailife.com/uat/api`。`sam-uat` 使用独立的 SQLite、凭证和备份卷。测试版通过真实微信登录识别顾客，平台审批后开放虚拟付款资格。付款、退款和钱包流水仅记入测试库，正式微信收款仍需配置微信支付商户。

## 微信体验版部署

服务端接口部署在云服务器，小程序前端代码上传到微信平台。两部分均准备好后才能进行手机扫码测试。

1. 在微信公众平台打开本小程序的开发设置，把 `https://sam.mmailife.com` 同时加入 **request合法域名** 和 **downloadFile合法域名**。不要填 `/uat/api` 路径，也不要依赖开发工具“跳过合法域名校验”让测试看似通过。
2. 执行 `npm run build:uat`，导入 `apps/miniprogram/dist-uat/`。构建目录与正式包分开，AppID读取项目配置，域名检查开启，API固定为 `/uat/api`。会话和购物车按接口环境分开保存。
3. 用具有该小程序开发权限的微信账号登录微信开发者工具。刷新「详情 → 域名信息」并重新编译，确认商品目录能加载、顶部显示线上测试标识。
4. 点击“上传”，可填写版本号 `0.1.1`，备注“线上体验测试，无真实资金”。在公众平台版本管理中把该开发版本设为体验版，再为需要测试的人添加体验成员。
5. 体验者扫码后点击微信登录。首次登录会在测试后台的「测试用户审批」出现。管理员核对本人提供的测试编号后批准，体验者刷新资格即可模拟付款。
6. 依次验证整件/拼份下单、自提/到家、成团、截单失败退测试余额、采购分装、称重补退、提货核销和售后。缺人数时可使用多个获准体验账号，或按合法份数参加同一团。

AppID用于标识项目；AppSecret只用于服务端登录换取身份。AppSecret不能替代代码上传权限。自动CI上传另需微信平台专用的代码上传私钥和出口IP白名单，不能把这些私钥提交到GitHub。[微信官方CI说明](https://github.com/wechat-miniprogram/miniprogram-ci-dist)

不要把UAT构建直接发布为正式版。正式版本应使用 `build:cloud` 指向正式API，并另行通过实际业务、支付及发布验收。

## 当前验收状态

2026-11-04：独立UAT服务已部署；HTTPS、平台管理员登录、审批列表、测试目录及跨环境令牌拒绝验证通过。初始含2个测试商户、3个社区、16个商品和测试采购批次，没有虚构顾客身份或已付款订单。后台与安全测试共53项通过，管理台和小程序构建通过。

本机微信开发者工具已导入真实AppID的体验包。request和downloadFile域名已配置并刷新生效，真实微信登录、测试资格审批及一笔43.80元模拟付款已通过在线验证。微信开发版本0.1.1已上传成功（代码对应Git提交4b5ed50）。管理员还需在公众平台将其设为体验版，手机扫码结果以实际验收为准；开发版上传成功不代表正式发布。

## 启动

在发布目录创建 `deploy/.env.uat`，填写同一小程序的 `WECHAT_APP_ID` 和 `UAT_WECHAT_APP_SECRET_FILE`。后者为服务器现有 AppSecret 文件的绝对路径。应用以 UID 1000 运行，文件须由该用户所有并采用 `0600` 权限。Compose 以只读方式挂载该文件，环境变量只提供挂载路径。

```sh
docker compose -p sam-uat --env-file deploy/.env.uat -f deploy/uat.compose.yaml config --quiet
docker compose -p sam-uat --env-file deploy/.env.uat -f deploy/uat.compose.yaml build api
docker compose -p sam-uat --env-file deploy/.env.uat -f deploy/uat.compose.yaml build admin
docker compose -p sam-uat --env-file deploy/.env.uat -f deploy/uat.compose.yaml up -d --no-build api admin
```

`sam-uat` 通过 `sam-stage_private` 的独立服务别名接入现有 HAProxy。API 和静态站点的宿主机探测口分别为 `127.0.0.1:18788` 和 `127.0.0.1:18082`。API 以 `staging` 和 `UAT_MODE=true` 运行，开发登录和开发支付均关闭。正式与测试各自使用所属项目的数据卷。UAT 管理台固定连接同源 `/uat/api`，使用单独的浏览器会话键，并在登录前核对测试环境开关。

首次启动后，用交互终端为测试库创建平台管理员。使用容器内 API 实际连接的数据库路径，密码由命令行工具隐藏读取。

```sh
docker compose -p sam-uat --env-file deploy/.env.uat -f deploy/uat.compose.yaml exec api \
  npm run manage-account -- create --database /data/sam.sqlite --role admin
```

## HTTPS 路由

在 `sam.mmailife.com` 的现有 HTTPS 前端，把 `/uat/api` 的规则放在 `/uat/` 规则之前，再放正式站点的规则。将 `/uat` 重定向至 `/uat/`。在各自的后端去掉 `/uat` 前缀，确保查询参数保留。API 后端沿用受控的转发头覆盖策略，连接来源为 `172.30.21.254`。[HAProxy 路径改写说明](https://docs.haproxy.org/2.8/configuration.html#http-request%20replace-path)

| 公网路径 | 后端 | 后端路径 |
| --- | --- | --- |
| `/uat/api/health` | `sam-uat-api:8787` | `/api/health` |
| `/uat/` | `sam-uat-admin:8080` | `/` |
| `/uat/assets/...` | `sam-uat-admin:8080` | `/assets/...` |

管理台镜像构建参数是 `VITE_BASE_PATH=/uat/` 和 `VITE_API_URL=/uat/api`。静态服务收到剥离前缀后的路径，可沿用现有 Nginx 配置。HAProxy 处理路径分流与 TLS，UAT Compose 只有 API 和管理台两个服务。

## 测试用户审批

1. 让顾客在小程序测试版完成一次微信登录。
2. 平台管理员登录 UAT 管理台，打开「测试用户审批」，按昵称、内部账号标识和注册时间核对顾客。
3. 选择「批准测试」。顾客刷新或重新打开测试版后，可以使用虚拟资金测试订单流程。
4. 需要结束资格时选择「撤销资格」。历史订单及流水保留在测试库。

验收时分别检查 `/api/config` 和 `/uat/api/config`。正式地址的 `uatEnabled` 应为 `false`，UAT 地址应为 `true`。匿名请求的 `testPaymentsEnabled` 应为 `false`，只有登录且已批准的测试顾客才具备虚拟付款资格。后台审批入口仅在 UAT 的平台管理员会话显示。再检查 `/uat/` 的静态资源均从 `/uat/assets/` 加载，并复查正式管理台 `/` 和既有业务路由。
