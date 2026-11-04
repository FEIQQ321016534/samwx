# 运营与资金完整性补充

本补充以当前代码为准，配合 `api-contract.md` 阅读。当前数据库仍是 SQLite；PostgreSQL、COS、正式微信AppID、真实收款及回调尚未接入。下列能力已经实现并在本地测试，不代表达到可直接公开经营的验收标准。

## 库存、规格与快照

权威库存为 Product 的 `inventoryUnits` / `inventoryScale`。一整包固定为232792560单位（1至20的最小公倍数），每份消耗 `inventoryScale / option.slots`，数量与库存全为整数。半盒、三分之一、四分之一和整盒在同商品上共用整包容量；同时支付在SQLite写事务中检查总需求，不能通过换规格超卖。

`stock` 为旧前端兼容计数，不再作为付款或报价的库存依据。新建商品的stock输入按整包数初始化；更新已有商品不能直接改stock，必须实盘：

`POST /admin/products/:id/inventory {requestId,wholePacks,reason}`

wholePacks是**当前可继续售卖的整包容量绝对值**，不含已经付款订单占用的容量，范围0至100万。0用于停售/缺货盘点。库存调整记录原值、调整结果、操作者和原因。

旧商品缺少统一库存字段时保留原stock到legacyStock。没有历史付款的商品可按整包初始化；存在历史付款的商品无法从旧“每份减1”模型推回真实容量，设 `inventoryNeedsReview=true` 并禁止继续接单，待商户明确实盘。旧订单、旧流水和商品均保留，不据演示数据虚构实物库存。

新订单逐行保存稳定id、原始quantity、optionSnapshot、productVersion、unitsPerQuantity、价格及冷链属性。商品改名、改价或把同一optionId改成其他分法，不修改已有订单和既有团的快照。原下单价格在付款时保持，付款仍重新验证商户/社区可售、批次未截止、精确库存及团容量。原订单截单期限不可因目录延后而延长；已有订单的批次拒绝改截单时间。

新订单保留 merchantSnapshot、communitySnapshot、batchSnapshot，自提地址不会因社区改名、暂停或退出公开目录而丢失。旧单回填来源标记legacy，只说明当前能恢复的目录信息，不能声称还原了未知的历史地址。

库存容量表示运营承诺的可售数量，尚未连接山姆门店实时库存；按份成团仍按同一规格分别招募，没有实现半份与两份四分之一自动混团。

## 重试与审计

创建订单使用body `requestId` 或 `Idempotency-Key`，同一用户、路由和标识只创建一次；内容变化返回409。生产/预发布环境缺标识拒绝；开发环境暂兼容旧客户端缺标识。当前消费端应始终生成一次请求标识，并在网络重试时复用。

缺货取消、人工退款、售后申请/审核、批次取消、实盘都要求requestId。幂等记录、钱包流水、订单变更和审计在同一写事务中提交。钱包参考号唯一，重复请求不重复退款；资金累计不超过实收。

`GET /admin/audit` 返回当前商户或平台权限下的最近500条业务操作日志，包括操作者、原因、请求标识、原值/结果。正式账号登录等安全事件另在受控安全审计表中保存。此版不是外部不可篡改审计存证，服务器管理员仍可直接更改数据库。

## 缺货、取消与售后

| 接口 | 请求 |
|---|---|
| `POST /orders/:id/after-sales` | 顾客：`{requestId,reason,requestedRefundCents?}` |
| `GET /orders/:id/after-sales` | 仅本人、所属商户、平台可读 |
| `GET /admin/after-sales` | 按商户隔离的售后列表 |
| `POST /admin/after-sales/:id/review` | `{requestId,action:'approve'\|'reject',reason,refundCents?}`，返回 `{case,order}` |
| `POST /admin/orders/:id/items/cancel` | `{requestId,items:[{itemId,quantity}],reason,type:'out_of_stock'\|'customer_cancel',restoreInventory?}` |
| `POST /admin/orders/:id/refund` | `{requestId,amountCents,reason}`，协商售后退款，不默认恢复已交付库存 |
| `POST /admin/batches/:id/cancel` | `{requestId,reason}`，返回 `{batch,cancelledOrders,refundCents}` |

每单至多一个open售后，待处理售后暂停履约推进和提货核销。售后审核只允许所属商户或平台，顾客不能自行确认退款。商户和平台需在实际运营中约定处理时限；当前没有超时仲裁或自动赔付。

行取消保留原quantity，用cancelledQuantity表示已取消数量；有效份数为两者之差，完整取消才标记行refunded。按剩余实际商品金额重新计算费用，保留原免运费/免冷链优惠，不因被动缺货加收费用。默认缺货不恢复可售容量；未进入采购的顾客取消可释放已占容量，运营可明确选择是否恢复，审计保存选择。

未满团截止会自动退余额；全商品失败全额退，混合订单按有效行退款。批次取消会取消未付订单、退已付订单净收款并清除待补款。已有订单进入待提、配送或完成时，拒绝整批取消，须逐单售后。

已完成订单协商退款仍保留completed和提货时间，不回退为未履约；financialStatus独立表示settled、topup_due、partially_refunded或refunded。原pricing、最终finalPricing、payments、refunds和售后协商抵减afterSalesCreditCents分别保留。`paidCents-refundedCents` 为净收款，应付为 `max(0, finalPricing.totalCents-afterSalesCreditCents)`。

## 称重与补款

称重只能在paid、purchasing、portioning或待补款状态调整；进入待提、配送、已完成后拒绝重新改价。实际商品总金额必须大于0，整单含费应付不超过100000000分。全缺货用行取消或批次取消，不把称重金额写0。

`POST /admin/orders/:id/weight-adjustment` 保持 `{adjustmentId,actualGoodsCents,note}`，额外可传 `itemGoods:[{itemId,actualGoodsCents}]`，须覆盖所有有效行且总和等于整单金额。未传逐行数据时按原商品金额比例做整数分分摊，余数归最后一行；这是结算分摊，不应冒称逐件真实称重。

多收款退余额，少收款只生成待补，不静默扣余额。用户主动补款后恢复调整前的采购/分装状态，不退回paid。相同调整标识不同整单或逐行数据拒绝。后续部分缺货使用已保存的逐行结算金额，保留原下单单价供追溯。

## 对账和资金边界

`GET /admin/reconciliation?merchantId=&batchId=` 返回总量与逐单paidCents、refundedCents、netReceivedCents、amountDueCents、topupCents、walletPaymentCents、walletRefundCents、discrepancies。商户不能切换到他人merchantId，钱包查询仍只有顾客本人或平台可访问完整账户。

对账检查退款累计与钱包退款流水一致、钱包付款与付款快照一致、累计实收与付款记录一致、待补差额一致、退款不超实收。钱包自身另校验余额与每笔余额链，不一致时拒绝变动。旧订单无法恢复的付款方式分拆不会被伪造为新付款快照。

平台级钱包仍是内部账本；测试充值和测试付款明确依赖开发开关，生产禁止使用演示账本。没有微信商户支付回调、真实退款回调、可提现账户、商户资金分账或监管托管。本地账本退款成功仅表示记账完成，不能冒称微信原路退款成功。

数据库切换为PostgreSQL时仍需迁移整数库存、行快照、幂等唯一约束、锁定支付/退款并发事务、钱包余额校验、审计及备份恢复，不可只更换连接字符串。COS也仍需实现私有桶、短期授权访问、上传校验、凭证权限和备份策略。
