# 本地 API 契约

后续运营完整性更新见 [运营与资金完整性补充](operations-integrity.md)。库存以 inventoryUnits/inventoryScale 为准；旧stock计数仅兼容；正式环境创建订单必须提供幂等标识。正式后台密码登录、安全会话与本地管理账号工具以当前安全文档和代码为准，早期微信身份提权工具不再是推荐的后台开户流程。

本版面向烟台社区的多代购商本地验证。源类型见 `packages/domain/src/index.ts`。所有金额均为整数人民币分，时间为 ISO 8601 UTC 字符串；界面显示中国时区。数据库为 SQLite 文件，订单、会话与钱包流水可跨重启保存。

## 启动、身份与返回值

```sh
npm run dev --prefix apps/api
```

本地基础地址 `http://127.0.0.1:8787/api`。默认绑定 `127.0.0.1`，真机局域网联调时可用 `HOST=0.0.0.0` 启动。微信开发者工具本地 HTTP 联调需在项目设置中允许本地调试；生产环境必须另行部署 HTTPS。

成功响应：`{"data": ...}`。失败响应：`{"error":{"code":"GROUP_FULL","message":"该拼团已满或不可参加"}}`，并使用 400/401/403/404/409/503 等 HTTP 状态。请求 JSON 对象，鉴权头 `Authorization: Bearer <token>`。

- `GET /health` → `{ok:true}`。
- `GET /config` → `{devAuthEnabled,devPaymentsEnabled,wechatLoginConfigured,wechatPayConfigured:false,wechatPaymentEnabled:false,city:"烟台市",currency:"CNY"}`。
- `POST /auth/dev-login`：`{role:"customer"|"merchant"|"admin",merchantId?,nickname?,customerKey?}` → `{token,user}`。`loginKey` 是 `customerKey` 的兼容别名。customerKey 默认为 `demo`，生成独立前缀的开发用户，不接受现有真实用户 ID。商户角色必须提供已有 merchantId。会话有效期 24 小时。
- `GET /me` → `User`。
- `POST /auth/logout` → `{ok:true}`。
- `POST /auth/wechat`：`{code}` → `{token,user}`。使用小程序 `wx.login` 获取的一次性 code，通过服务端环境变量 `WECHAT_APP_ID`、`WECHAT_APP_SECRET` 调用微信官方 code2Session；缺配置返回 `503 AUTH_NOT_CONFIGURED`，无效 code 返回 `401 LOGIN_CODE_INVALID`。openid 在服务端映射持久用户，客户端仅得到不透明用户ID和随机会话令牌；不保存、下发 session_key。官方接口依据：[code2Session](https://developers.weixin.qq.com/miniprogram/dev/server/API/user-login/api_code2session.html)、[小程序登录](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html)。

开发身份仅在 development/test 且显式 `DEV_AUTH_ENABLED=true` 时启用。未配置时返回 `503 AUTH_NOT_CONFIGURED`。`npm run dev` 显式启用开发身份与开发支付。`npm start` 不设置这两个开关，生产环境强制禁用，即便错误地设置为 true 也无效。没有默认管理员密码。真实微信登录已提供服务端适配，但须配置真实 AppID/AppSecret；微信支付尚未接入，不能将开发身份用于公开生产服务。

生产默认数据库为 `./data/sam-production.sqlite`，开发默认为 `./data/sam.sqlite`。生产启动会拒绝含 seed-v1 标记、dev-用户、模拟支付订单或开发充值流水的数据库，也拒绝强制seed配置，避免演示余额迁移为真实资金。会话持久记录身份来源，生产每次鉴权都只接受微信来源且拒绝dev-用户；旧版会话迁移默认标记为development，不能继承生产管理权限。

演示商户 ID：`merchant-laochen`、`merchant-xiaolin`。老陈社区 `community-yangguang`、`community-feicui`，班次 `batch-laochen-demo`；小林社区 `community-laishan`，班次 `batch-xiaolin-demo`。初始班次截止时间为首次创建库时起 24 小时后，过期后可在后台新建班次。生产模式不会自动填充演示数据。

## 商品、社区与拼团

- `GET /catalog?merchantId=&batchId=` → `{merchants,communities,batches,products,groups}`。仅返回审核通过商户及其在售商品；`merchants` 保持全部已审核商户供切换，其余按 merchantId 筛选。
- `GET /groups?merchantId=&batchId=` → `SplitGroup[]`。
- `POST /groups`（customer）：`{productId,optionId,batchId,communityId,note?}` → `SplitGroup`。note为可选的分装说明或偏好，最多200字，随团存储并通过catalog返回；仅补充说明，不修改实际optionId、人数、价格。从商户已经配置的拆分规格开空团，不允许任意份数。开团时 `paidSlots=0`；发起人也须支付后才占份。

`Product` 的关键字段：`id,merchantId,name,subtitle,categoryId,originalPriceCents,originalSpecs,canSplit,requiresColdChain,stock,salesCount,tags,iconType,accentColor,options,active`。每个 `options` 项为 `{id,name,ratio,slots,weightEstimate,priceCents,description}`。`stock` 在此首版指可售规格份数，支付时按数量扣减，未成团退款时归还；后续若接入整箱/称重库存，应迁移为规格级库存和采购包装换算。

`SplitGroup` 包含 `id,merchantId,productId,optionId,batchId,communityId,productName,totalSlots,paidSlots,pricePerSlotCents,slotDescription,status,cutoffAt,participants,createdBy,createdAt`。参与者保存 `{userId,nickname,orderId,quantity,paidAt}`。团价格在开团时确定；通过团参购使用该团的价格和准确 optionId。

## 报价、下单、付款与补差价

`CheckoutInput` 示例：

```json
{
  "merchantId":"merchant-laochen",
  "communityId":"community-yangguang",
  "batchId":"batch-laochen-demo",
  "fulfillment":"pickup",
  "items":[{"productId":"sam-p1","optionId":"split-half","quantity":1,"groupId":"可选的已有团ID"}],
  "recipientName":"提货人",
  "recipientPhone":"13812345678",
  "address":"送货上门时必填",
  "notes":"给代购商的备注"
}
```

- `POST /orders/quote`（customer）：接收上述字段，其中联系人可以省略 → `{items,pricing}`。全部价格从后端商品/团读取，客户端单价一律忽略。
- `POST /orders`（customer）：接收完整 CheckoutInput → `Order`。创建 `unpaid` 订单，尚不扣库存、不占团份额。拆分项没有 groupId 时，自动匹配同商户/社区/批次/规格的未满团，否则创建空团并把 groupId 写入订单。单项数量不超过该规格一团人数；更多数量需分团下单。
- `GET /orders` → 当前身份可见的 `Order[]`，新订单在前。
- `GET /orders/:id` → `Order`。
- `POST /orders/:id/pay`（customer）：`{method:"wallet"|"dev"|"wechat"}` → `Order`。仅本人可支付，重复支付请求直接返回已付订单，不重复占位或扣款。
- `POST /orders/:id/topup`（customer）：`{method:"wallet"|"dev"|"wechat"}` → 补差价后的 `Order`。不传金额，由后端读取最新 `topupCents`，支付后恢复调整前的运营状态。
- `POST /orders/:id/cancel`（customer）：仅未付订单可取消。

`dev` 必须显式 `DEV_PAYMENTS_ENABLED=true` 且非 production；记录为“开发模拟”，无真实资金扣款。`wechat` 始终返回 `503 WECHAT_PAY_NOT_CONFIGURED`，不创建假支付成功记录。钱包也仅是本地账本，首版没有真实线上充值入口。

支付在 SQLite `BEGIN IMMEDIATE` 事务内完成：重新验证当前班次/库存/价格，扣库存、校验团容量并占位、扣钱包、变更订单。任一步失败全部回滚。最后一份并发争抢只允许一笔成功；支付前的订单不保留名额。

价格对象 `pricing`、`finalPricing` 均为：

```ts
{ subtotalCents, proxyFeeCents, packagingFeeCents, deliveryFeeCents, discountCents, totalCents }
```

代购费按商品金额的 6%，最低 400 分、最高 2500 分，四舍五入到角；冷链 300 分，商品满 19900 分免；自提免运费，到家 800 分，满 29900 分免。首版 `discountCents=0`，不使用原型里的固定 5 元券。所有阈值按优惠前商品金额计算。

`Order` 另含 `id,customerId,createdAt,paidAt,status,paymentMethod,pickupCode,paidCents,refundedCents,topupCents,progress,photoUrls,receiptUrls,weightAdjustments`，以及 CheckoutInput 的字段。订单行包含锁定的 `name,optionName,unitPriceCents,weightEstimate,isSplit,requiresColdChain,state`（`active`/`refunded`）。`pricing` 是原下单报价，`finalPricing` 是未成团处理/称重复核后的最终应付。`paidCents-refundedCents` 为当前净收款。提货码付款后随机生成，后台必须核验订单归属与可提状态后才能核销。

## 钱包

- `GET /wallet`（customer）→ `{balanceCents,entries}`。
- `POST /wallet/dev-credit`（customer）：`{amountCents,requestId}` → Wallet。只在开发支付开关启用时开放；同 requestId 同金额重复请求只充值一次，金额冲突返回 409。界面必须标明测试余额。
- `GET /admin/wallet?customerId=`（仅 admin）→ Wallet。商户不开放用户的跨商户完整余额流水。

流水字段：`id,userId,amountCents,balanceAfterCents,reference,kind,note,createdAt,merchantId?,orderId?`。正数入账，负数扣款。数据库唯一 `(user_id,reference)` 保证充值、支付、截单退款、称重退款幂等。余额不足时交易失败，余额不能为负。没有提现、真实充值和跨商户资金结算功能。

## 平台与商户管理

`/admin/*` 默认允许 admin/merchant，merchant 按会话中的 merchantId 隔离。创建资源时商户不能指定其他商户；已有资源不可改归属。下列特别注明的平台操作仅 admin 可执行。

| 路由 | 输入 / 返回 |
|---|---|
| `GET /admin/overview` | `{merchants,products,batches,orders,revenueCents,pendingReviews}`，前四项为数量；revenue 是净收款，包含开发测试资金，不是商户利润 |
| `GET /admin/merchants` | `Merchant[]`，商户仅自己 |
| `POST /merchants/apply` | customer/admin，`{name,contactName,contactPhone,description?}` → 待审核 Merchant，city 固定烟台 |
| `POST /admin/merchants/:id/review` | 仅 admin，`{status:"approved"|"rejected",reason?}` → Merchant |
| `GET /admin/communities` | `Community[]` |
| `POST /admin/communities` | `{merchantId?,name,station,address}` → Community |
| `GET /admin/products` | `Product[]` |
| `POST /admin/products` | Product 字段，id由后端生成，admin须传merchantId → Product |
| `PATCH /admin/products/:id` | 可改 Product 字段的子集；不能转移所属商户 → Product |
| `GET /admin/batches` | `Batch[]` |
| `POST /admin/batches` | `{merchantId?,title,storeName,cutoffAt,pickupStartAt,pickupEndAt,status?,shopperName?,shopperPhone?,note?,photoUrls?,receiptUrls?}` → Batch |
| `PATCH /admin/batches/:id` | Batch 字段子集，已截单不能重开 → Batch |
| `GET /admin/batches/:id/picking-list` | `{batch,orderCount,items:[{productId,name,optionId,optionName,quantity}],groups}`，只汇总已付有效份额 |
| `POST /admin/batches/:id/close` | 空对象 → `{batch,failedGroups,refundedOrders,refundCents}` |
| `GET /admin/orders` | 当前权限可见 `Order[]` |
| `POST /admin/orders/:id/progress` | `{status,note?,photoUrls?,receiptUrls?}` → Order |
| `POST /admin/orders/:id/attachments` | `{photoUrls?,receiptUrls?}` → Order，替换相应URL列表 |
| `POST /admin/orders/:id/weight-adjustment` | `{adjustmentId,actualGoodsCents,note}` → Order，actualGoods是当前有效商品的**整单实际商品金额** |
| `POST /admin/orders/:id/verify-pickup` | `{pickupCode}` → 已完成 Order；重复核销返回同一结果 |

凭证最多20个URL，仅接受 HTTPS；首版保存外部 URL，不代替图片上传服务，不伪造“山姆官方小票”。`photoUrls` 为运营实拍，`receiptUrls` 为运营上传的真实采购小票，用户代购结算明细应独立展示。

采购状态顺序：`paid → purchasing → portioning → ready_for_pickup → 核销完成`；到家订单为 `paid → purchasing → portioning → delivering → completed`。有未成团份额或待补款时不能推进。自提必须通过核销接口完成，不能直接跳为 completed。

截单操作允许商户主动提前截单，会取消本批次未付订单；未满团记 failed，其已付订单行记 refunded，并按剩余有效商品重新计算商品/代购/包装/配送费用，差额退余额。因被动未成团造成金额跌破免运或免包装门槛时，保留原订单对应费用优惠，各项服务费不超过原下单费用，不因未成团额外收费。所有商品失败时全额退回，混合订单仅退对应差额。截单重复执行不重复退款。服务在启动时和每30秒扫描已到期的 open 批次，自动复用同一事务逻辑处理退款；服务停机期间过期的批次会在重启后补处理。新批次只能从 open 开始，不能通过 PATCH 跳过截单直接进入采购状态。

称重调整使用不可重复的 adjustmentId，修改后重新计算整单费用。多收部分退余额；少收部分记 `awaiting_topup` 与 `topupCents`，用户主动付款后继续，不静默扣余额。同标识同金额/原因重试不重复退款；同标识不同数据拒绝。

## 本版边界与验证

此 API 是可持久化的本地业务验证版本。微信code登录的服务端适配已经实现，但当前未配置真实AppID和AppSecret，验证使用受控HTTP桩而非真实微信账号。真实收款、支付通知验签、外部对象存储上传、配送商接单、电子面单、生产入驻资料审核、订阅消息、可提现的支付账户和真实资金结算均未接入；需要相应资质、配置和部署后续实现。

运行 `npm run test --prefix apps/api` 和 `npm run typecheck --prefix apps/api`。关键测试覆盖：费用阈值/整数分、3人团准确规格、并发最后一份、重复付款、钱包不足回滚与充值幂等、未成团混合/全额退款、启动及周期自动截单、称重退款幂等和主动补款、商户与用户越权、跨商户资源创建、提货状态与幂等、生产模式禁用开发身份和支付、SQLite重启持久化、浏览器PATCH预检。

## 权限与资金隔离边界

1. customer 只能读取/支付/取消自己的订单，不能使用 merchantId 或 customerId 参数冒充他人；订单归属从会话及后端记录判断。
2. merchant 的商品、社区、批次、订单、核销、称重调整与凭证操作均限制在会话 merchantId 内。平台审核只允许 admin。商户不能查看用户跨其他商户的完整钱包余额与流水；全账户钱包查询只向 admin 开放。
3. customer 可在不同商户购物，首版钱包是**平台级统一内部账本**，不是各商户独立钱包。退款标注 merchantId/orderId 以便追溯，但未实现平台向商户结算、冻结款或提款。跨商户消费资金清算上线前必须另行设计，不能把本地测试余额当成微信钱包资金。
4. 开发登录选角色仅供本机调试。正式管理账号与微信顾客身份分离，通过本地受控CLI创建，没有默认密码；详见 `apps/api/scripts/README.md`。生产/staging不接受开发会话，微信顾客身份不能作为管理员会话使用。商户暂停、账号禁用或角色变动会使管理会话失效。
5. 已实现内部支付/退款/钱包流水对账和操作审计。当前SQLite提供单实例事务保证，尚未完成PostgreSQL迁移、分布式支付通知、云数据库容灾及微信账单对账。

## 正式管理账号

使用 `npm --prefix apps/api run manage-account -- create ...` 在受控主机创建管理账号。密码从隐藏TTY或受限secret-file读取，不在命令行传明文密码。完整用法见 `apps/api/scripts/README.md`。旧grant-role方式不能建立正式管理会话，应使用独立管理账号。

## 私有采购凭证

- `POST /admin/orders/:id/media`：Bearer商户/平台身份，JSON `{kind:"photo"|"receipt",filename,contentBase64}`。原图最多5MB，支持静态JPEG/PNG/WebP；限制像素，去除EXIF并重编码为JPEG。每账号每分钟20次，最多两个上传请求同时处理。
- `GET /orders/:id/media`：仅订单顾客/本商户/平台可列出元数据。
- `GET /media/:id`：每次验证订单权限后返回图片，禁止缓存。浏览器使用带Bearer的fetch+blob，小程序使用带Bearer的downloadFile；不返回公开图片链接。
- `MEDIA_DIRECTORY`指定私有数据目录。文件先落盘再提交元数据，上传操作写入审计；备份须同时保留DB和媒体目录。

## 容器交付

已提供 `apps/api/Dockerfile`、Dockerfile专用忽略规则 `apps/api/Dockerfile.dockerignore`（根目录构建时生效）和同内容 `.dockerignore`。构建上下文必须为仓库根目录，以便包含共享domain代码。容器使用Node24、非root用户、生产环境，持久目录 `/app/data`；开发登录和开发支付强制关闭，不打包本机SQLite、环境密钥或node_modules。

以下为后续部署示例，本次没有实际构建、启动容器或暴露公网：

```sh
docker build -f apps/api/Dockerfile -t sam-api:local .
docker volume create sam-production-data
docker run --rm --name sam-api -p 127.0.0.1:8787:8787 --mount source=sam-production-data,target=/app/data --env-file /服务器私有位置/sam-production.env sam-api:local
```

生产环境文件应设置真实 `WECHAT_APP_ID`、`WECHAT_APP_SECRET`、精确的HTTPS `CORS_ORIGINS`，保持 `NODE_ENV=production`；数据库使用容器默认 `/app/data/sam-production.sqlite`。不要将本机开发 `.env.example` 的数据库路径和开发开关整份复制为生产配置。上层反向代理负责正式域名、TLS和访问控制。没有真实支付配置时微信收款仍返回未配置，不能用于真实线上交易。
