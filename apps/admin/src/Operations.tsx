import { useContext, useEffect, useRef, useState } from "react";
import { cents, date, money } from "./api";
import type {
  AfterSalesCase,
  Batch,
  Community,
  Merchant,
  OperationAudit,
  Order,
  Product,
  Reconciliation,
} from "./api";
import {
  DraftNotice,
  DraftScope,
  Empty,
  Field,
  Modal,
  Notice,
  SubmitForm,
  operationId,
  useDraftState,
} from "./ui";
import type { Api } from "./ui";
const auditLabels: Record<string, string> = {
  community_created: "新增社区",
  community_updated: "维护社区",
  inventory_counted: "库存盘点",
  out_of_stock: "缺货取消",
  customer_cancel: "顾客协商取消",
  "media.upload": "上传私有凭证",
  after_sales_requested: "顾客申请售后",
  after_sales_reviewed: "售后审核",
  after_sales_approved: "售后退款",
  after_sales_rejected: "拒绝售后",
  order_created: "创建订单",
  order_paid: "订单付款",
  batch_created: "新建批次",
  batch_updated: "维护批次",
  batch_closed: "批次截单",
  batch_cancelled: "取消批次",
  product_created: "新建商品",
  product_updated: "编辑商品",
  manual_refund: "协商退款",
  weight_adjusted: "称重结算",
  progress_updated: "更新履约进度",
  pickup_verified: "提货码核销",
};
const message = (e: unknown) =>
  e instanceof Error ? e.message : "操作失败，请重试";
const merchantName = (merchants: Merchant[], id: string) =>
  merchants.find((m) => m.id === id)?.name || id;

export function CommunityPanel({
  api,
  merchants,
  merchantId,
}: {
  api: Api;
  merchants: Merchant[];
  merchantId?: string;
}) {
  const [rows, setRows] = useState<Community[]>([]),
    [error, setError] = useState(""),
    [editing, setEditing] = useState<Community | "new" | null>(null);
  const load = async () => {
    try {
      setRows(await api<Community[]>("/admin/communities"));
      setError("");
    } catch (e) {
      setError(message(e));
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <section className="card">
        <div className="card-title">
          <h2>社区与自提点</h2>
          <div className="actions">
            <button className="button secondary" onClick={() => void load()}>
              刷新
            </button>
            <button className="button" onClick={() => setEditing("new")}>
              ＋ 新增社区
            </button>
          </div>
        </div>
        <p className="muted">停用后不再接受新订单，历史订单保留原站点快照。</p>
        {error && <Notice type="error">{error}</Notice>}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>社区</th>
                <th>所属商户</th>
                <th>自提点 / 地址</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="name">
                    {c.name}
                    <small>{c.id}</small>
                  </td>
                  <td>{merchantName(merchants, c.merchantId)}</td>
                  <td>
                    {c.station}
                    <small>{c.address}</small>
                  </td>
                  <td>
                    <span
                      className={`badge ${c.active === false ? "gray" : "green"}`}
                    >
                      {c.active === false ? "已停用" : "服务中"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="button small secondary"
                      onClick={() => setEditing(c)}
                    >
                      维护
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <Empty title="暂无社区" hint="新增商户后请维护真实自提点地址。" />
          )}
        </div>
      </section>
      {editing && (
        <CommunityEditor
          community={editing === "new" ? undefined : editing}
          merchants={merchants}
          merchantId={merchantId}
          api={api}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
    </>
  );
}
function CommunityEditor({
  community,
  merchants,
  merchantId,
  api,
  onClose,
  onSaved,
}: {
  community?: Community;
  merchants: Merchant[];
  merchantId?: string;
  api: Api;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm, clear, reset, restored] = useDraftState(
    `community-${community?.id || "new"}`,
    {
      merchantId: community?.merchantId || merchantId || merchants[0]?.id || "",
      name: community?.name || "",
      station: community?.station || "",
      address: community?.address || "",
      active: community?.active !== false,
    },
  );
  return (
    <Modal
      title={community ? "维护社区与自提点" : "新增社区与自提点"}
      onClose={onClose}
    >
      <SubmitForm
        onClose={onClose}
        onSubmit={async () => {
          const { merchantId: mid, ...data } = form;
          await api(
            community
              ? `/admin/communities/${community.id}`
              : "/admin/communities",
            community ? "PATCH" : "POST",
            community ? data : { ...data, merchantId: mid },
          );
          clear();
          await onSaved();
        }}
      >
        <DraftNotice restored={restored} onReset={reset} />
        <div className="form-grid">
          <Field label="所属商户">
            <select
              required
              disabled={!!merchantId || !!community}
              value={form.merchantId}
              onChange={(e) =>
                setForm((v) => ({ ...v, merchantId: e.target.value }))
              }
            >
              <option value="">请选择</option>
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="社区名称">
            <input
              required
              maxLength={80}
              value={form.name}
              onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
            />
          </Field>
          <Field label="自提点名称">
            <input
              required
              maxLength={120}
              value={form.station}
              onChange={(e) =>
                setForm((v) => ({ ...v, station: e.target.value }))
              }
            />
          </Field>
          <Field label="完整自提地址">
            <input
              required
              maxLength={300}
              value={form.address}
              onChange={(e) =>
                setForm((v) => ({ ...v, address: e.target.value }))
              }
            />
          </Field>
          <label className="check span-two">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) =>
                setForm((v) => ({ ...v, active: e.target.checked }))
              }
            />
            向顾客开放此社区
          </label>
        </div>
      </SubmitForm>
    </Modal>
  );
}

export function InventoryDialog({
  product,
  api,
  onClose,
  onSaved,
}: {
  product: Product;
  api: Api;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm, clear, reset, restored] = useDraftState(
    `inventory-${product.id}`,
    { wholePacks: "", reason: "", requestId: crypto.randomUUID() },
  );
  return (
    <Modal title={`库存盘点 · ${product.name}`} onClose={onClose}>
      <SubmitForm
        label="记录盘点并调整库存"
        onClose={onClose}
        onSubmit={async () => {
          const wholePacks = Number(form.wholePacks);
          if (
            !/^\d+$/.test(form.wholePacks) ||
            !Number.isSafeInteger(wholePacks) ||
            wholePacks > 1_000_000
          )
            throw new Error("整包盘点数须为0至100万的整数。");
          const body = { wholePacks, reason: form.reason.trim() };
          await api(`/admin/products/${product.id}/inventory`, "POST", {
            ...body,
            requestId: form.requestId,
          });
          clear();
          await onSaved();
        }}
      >
        <DraftNotice restored={restored} onReset={reset} />
        <Notice>
          填写当前可继续售卖的整包容量，不含已售订单已占用的库存。填0表示不再接新单。调整会记录原因与操作人。
        </Notice>
        <p className="muted">
          当前可售整包数：
          {(product.inventoryUnits !== undefined && product.inventoryScale
            ? product.inventoryUnits / product.inventoryScale
            : product.stock
          ).toLocaleString("zh-CN", { maximumFractionDigits: 4 })}
          {product.inventoryNeedsReview ? " · 旧库存待盘点确认" : ""}
        </p>
        <div className="form-grid">
          <Field label="实际可售整包数">
            <input
              required
              type="number"
              min="0"
              max="1000000"
              step="1"
              value={form.wholePacks}
              onChange={(e) =>
                setForm((v) => ({ ...v, wholePacks: e.target.value }))
              }
            />
          </Field>
          <Field label="盘点原因">
            <input
              required
              maxLength={500}
              value={form.reason}
              onChange={(e) =>
                setForm((v) => ({ ...v, reason: e.target.value }))
              }
              placeholder="例如：到货盘点、破损剔除"
            />
          </Field>
        </div>
      </SubmitForm>
    </Modal>
  );
}

export function BatchCancelDialog({
  batch,
  api,
  onClose,
  onSaved,
}: {
  batch: Batch;
  api: Api;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const scope = useContext(DraftScope);
  const [reason, setReason, clear, reset, restored] = useDraftState(
    `cancel-batch-${batch.id}`,
    "",
  );
  return (
    <Modal title="取消整个采购批次" onClose={onClose}>
      <SubmitForm
        label="取消批次并处理退款"
        onClose={onClose}
        onSubmit={async () => {
          const body = { reason: reason.trim() };
          await api(`/admin/batches/${batch.id}/cancel`, "POST", {
            ...body,
            requestId: operationId(scope, `cancel-batch-${batch.id}`, body),
          });
          clear();
          await onSaved();
        }}
      >
        <DraftNotice restored={restored} onReset={reset} />
        <Notice>
          取消「{batch.title}
          」后停止接单，未支付订单取消，未履约的已付订单按服务端规则退款至顾客余额。已有履约订单时服务端会拒绝整批取消。
        </Notice>
        <Field label="取消原因">
          <textarea
            required
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </SubmitForm>
    </Modal>
  );
}

export function OrderOperations({
  order,
  api,
  onSaved,
}: {
  order: Order;
  api: Api;
  onSaved: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"items" | "refund">("items"),
    [done, setDone] = useState("");
  const [form, setForm, clear, reset, restored] = useDraftState(
    `order-operations-${order.id}`,
    {
      reason: "",
      amount: "",
      type: "out_of_stock",
      restoreInventory: false,
      quantities: {} as Record<string, string>,
      requestIds: { items: crypto.randomUUID(), refund: crypto.randomUUID() },
    },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const remaining = (item: Order["items"][number]) =>
    item.state === "refunded"
      ? 0
      : Math.max(0, item.quantity - (item.cancelledQuantity || 0));
  const net = Math.max(0, (order.paidCents || 0) - (order.refundedCents || 0));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setDone("");
    try {
      if (!form.reason.trim()) throw new Error("请填写本次处理原因。");
      let route: string, body: Record<string, unknown>;
      if (mode === "items") {
        const items = order.items
          .map((item, index) => ({
            itemId: item.id || `item-${index}`,
            quantity: Number(form.quantities[item.id || `item-${index}`] || 0),
          }))
          .filter((item) => item.quantity > 0);
        if (!items.length) throw new Error("请选择需要取消的商品及数量。");
        route = "items/cancel";
        body = {
          items,
          reason: form.reason.trim(),
          type: form.type,
          restoreInventory: form.restoreInventory,
        };
      } else {
        const amountCents = cents(form.amount);
        if (amountCents <= 0 || amountCents > net)
          throw new Error(`退款须大于0且不超过当前净收款${money(net)}。`);
        route = "refund";
        body = { amountCents, reason: form.reason.trim() };
      }
      await api(`/admin/orders/${order.id}/${route}`, "POST", {
        ...body,
        requestId: form.requestIds[mode],
      });
      clear();
      setForm((v) => ({
        ...v,
        reason: "",
        amount: "",
        quantities: {},
        requestIds: { items: crypto.randomUUID(), refund: crypto.randomUUID() },
      }));
      await onSaved();
      setDone("处理已完成，退款及剩余应付已由服务端重新计算。");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="operations-section">
      <div className="card-title">
        <h3>取消、缺货与协商退款</h3>
        <span className="muted">当前净收款 {money(net)}</span>
      </div>
      <div className="role-tabs">
        <button
          type="button"
          className={mode === "items" ? "active" : ""}
          onClick={() => setMode("items")}
        >
          按商品取消 / 缺货
        </button>
        <button
          type="button"
          className={mode === "refund" ? "active" : ""}
          onClick={() => setMode("refund")}
        >
          协商退款至余额
        </button>
      </div>
      <DraftNotice restored={restored} onReset={reset} />
      {error && <Notice type="error">{error}</Notice>}
      {done && <Notice type="success">{done}</Notice>}
      <form onSubmit={submit}>
        {mode === "items" ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>商品 / 规格</th>
                    <th>原数量</th>
                    <th>已取消</th>
                    <th>本次取消数量</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, index) => {
                    const id = item.id || `item-${index}`,
                      available = remaining(item);
                    return (
                      <tr key={id}>
                        <td>
                          {item.name || item.productId}
                          <small>{item.optionName}</small>
                        </td>
                        <td>{item.quantity}</td>
                        <td>{item.cancelledQuantity || 0}</td>
                        <td>
                          <input
                            aria-label={`${item.name || item.productId}本次取消数量`}
                            disabled={
                              !available || order.status === "completed"
                            }
                            type="number"
                            min="0"
                            max={available}
                            step="1"
                            value={form.quantities[id] || ""}
                            onChange={(e) =>
                              setForm((v) => ({
                                ...v,
                                quantities: {
                                  ...v.quantities,
                                  [id]: e.target.value,
                                },
                              }))
                            }
                            placeholder={`剩余${available}`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <Field label="处理类型">
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((v) => ({
                      ...v,
                      type: e.target.value,
                      restoreInventory: e.target.value === "customer_cancel",
                    }))
                  }
                >
                  <option value="out_of_stock">门店缺货 / 无法交付</option>
                  <option value="customer_cancel">顾客协商取消</option>
                </select>
              </Field>
              <label className="check">
                <input
                  type="checkbox"
                  checked={form.restoreInventory}
                  onChange={(e) =>
                    setForm((v) => ({
                      ...v,
                      restoreInventory: e.target.checked,
                    }))
                  }
                />
                将取消份额恢复为可售库存
              </label>
            </div>
            <p className="muted">
              仅取消选中数量；服务费、包装及配送费变化由服务端重算。缺货份额通常不恢复库存。
            </p>
          </>
        ) : (
          <div className="form-grid">
            <Field label="本次协商退款金额（元）">
              <input
                required
                type="text"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) =>
                  setForm((v) => ({ ...v, amount: e.target.value }))
                }
              />
            </Field>
            <div className="subtle-panel">
              累计退款不能超过订单实收款，退款将进入顾客平台余额。
            </div>
          </div>
        )}
        <Field label="处理原因">
          <textarea
            required
            rows={2}
            maxLength={500}
            value={form.reason}
            onChange={(e) => setForm((v) => ({ ...v, reason: e.target.value }))}
          />
        </Field>
        <div className="actions" style={{ marginTop: 14 }}>
          <button
            className="button danger"
            disabled={busy || (mode === "refund" && net === 0)}
          >
            {busy
              ? "处理中…"
              : mode === "items"
                ? "按数量取消并重算退款"
                : "确认退款至余额"}
          </button>
        </div>
      </form>
      {!!order.refunds?.length && (
        <div style={{ marginTop: 20 }}>
          <h3>退款记录</h3>
          {order.refunds.map((refund) => (
            <div className="record" key={refund.id}>
              <div>
                {refund.reason}
                <p>
                  {date(refund.createdAt)} · {refund.type}
                </p>
              </div>
              <strong>{money(refund.amountCents)}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function AfterSalesPanel({
  api,
  orders,
  onOpenOrder,
  onChanged,
}: {
  api: Api;
  orders: Order[];
  onOpenOrder: (id: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [rows, setRows] = useState<AfterSalesCase[]>([]),
    [status, setStatus] = useState("all"),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<AfterSalesCase | null>(null);
  const load = async () => {
    try {
      setRows(await api<AfterSalesCase[]>("/admin/after-sales"));
      setError("");
    } catch (e) {
      setError(message(e));
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <section className="card">
        <div className="card-title">
          <h2>售后申请处理</h2>
          <div className="actions">
            <select
              aria-label="售后状态"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">全部</option>
              <option value="open">待处理</option>
              <option value="approved">已同意</option>
              <option value="rejected">已拒绝</option>
            </select>
            <button className="button secondary" onClick={() => void load()}>
              刷新
            </button>
          </div>
        </div>
        {error && <Notice type="error">{error}</Notice>}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>订单 / 时间</th>
                <th>顾客诉求</th>
                <th>申请退款</th>
                <th>状态 / 处理意见</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((row) => status === "all" || row.status === status)
                .map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        className="button link mono"
                        onClick={() => onOpenOrder(row.orderId)}
                      >
                        {row.orderId}
                      </button>
                      <small>{date(row.createdAt)}</small>
                    </td>
                    <td className="wrap-cell">{row.reason}</td>
                    <td>
                      {row.requestedRefundCents === undefined
                        ? "未指定金额"
                        : money(row.requestedRefundCents)}
                    </td>
                    <td>
                      <span
                        className={`badge ${row.status === "open" ? "orange" : row.status === "approved" ? "green" : "gray"}`}
                      >
                        {row.status === "open"
                          ? "待处理"
                          : row.status === "approved"
                            ? "已同意"
                            : "已拒绝"}
                      </span>
                      <small>{row.reviewReason}</small>
                    </td>
                    <td>
                      <button
                        className="button small secondary"
                        disabled={row.status !== "open"}
                        onClick={() => setSelected(row)}
                      >
                        处理申请
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!rows.length && (
            <Empty title="暂无售后申请" hint="顾客提交申请后会在此显示。" />
          )}
        </div>
      </section>
      {selected && (
        <AfterSalesReview
          record={selected}
          order={orders.find((o) => o.id === selected.orderId)}
          api={api}
          onClose={() => setSelected(null)}
          onSaved={async () => {
            setSelected(null);
            await Promise.all([load(), onChanged()]);
          }}
        />
      )}
    </>
  );
}
function AfterSalesReview({
  record,
  order,
  api,
  onClose,
  onSaved,
}: {
  record: AfterSalesCase;
  order?: Order;
  api: Api;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const scope = useContext(DraftScope);
  const [form, setForm, clear, reset, restored] = useDraftState(
    `after-sales-${record.id}`,
    {
      action: "approve",
      reason: "",
      amount:
        record.requestedRefundCents === undefined
          ? ""
          : String(record.requestedRefundCents / 100),
    },
  );
  const net = Math.max(
    0,
    (order?.paidCents || 0) - (order?.refundedCents || 0),
  );
  return (
    <Modal title="处理售后申请" onClose={onClose}>
      <SubmitForm
        label={
          form.action === "approve" ? "同意并退款至余额" : "拒绝并记录处理意见"
        }
        onClose={onClose}
        onSubmit={async () => {
          const body = {
            action: form.action,
            reason: form.reason.trim(),
            ...(form.action === "approve"
              ? { refundCents: cents(form.amount) }
              : {}),
          };
          if (!body.reason) throw new Error("请填写处理意见。");
          if (
            form.action === "approve" &&
            (!body.refundCents || body.refundCents > net)
          )
            throw new Error("批准退款须大于0且不能超过当前净收款。");
          await api(`/admin/after-sales/${record.id}/review`, "POST", {
            ...body,
            requestId: operationId(scope, `after-sales-${record.id}`, body),
          });
          clear();
          await onSaved();
        }}
      >
        <DraftNotice restored={restored} onReset={reset} />
        <div className="subtle-panel">
          顾客诉求：{record.reason}
          <p>
            订单：{record.orderId} · 当前净收款 {money(net)}
          </p>
        </div>
        <div className="form-grid">
          <Field label="处理决定">
            <select
              value={form.action}
              onChange={(e) =>
                setForm((v) => ({ ...v, action: e.target.value }))
              }
            >
              <option value="approve">同意售后退款</option>
              <option value="reject">拒绝申请</option>
            </select>
          </Field>
          {form.action === "approve" && (
            <Field label="批准退款金额（元）">
              <input
                required
                type="text"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) =>
                  setForm((v) => ({ ...v, amount: e.target.value }))
                }
              />
            </Field>
          )}
          <Field label="处理意见" className="span-two">
            <textarea
              required
              rows={3}
              maxLength={500}
              value={form.reason}
              onChange={(e) =>
                setForm((v) => ({ ...v, reason: e.target.value }))
              }
            />
          </Field>
        </div>
      </SubmitForm>
    </Modal>
  );
}

function saveCsv(name: string, rows: (string | number)[][]) {
  const content =
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((cell) => {
            let value = String(cell);
            if (/^[=+@\-\t\r]/.test(value)) value = "'" + value;
            return '"' + value.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ReconciliationPanel({
  api,
  merchants,
  batches,
  isAdmin,
  onOpenOrder,
}: {
  api: Api;
  merchants: Merchant[];
  batches: Batch[];
  isAdmin: boolean;
  onOpenOrder: (id: string) => void;
}) {
  const [merchant, setMerchant] = useState(""),
    [batch, setBatch] = useState(""),
    [data, setData] = useState<Reconciliation | null>(null),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setBusy(true);
    const query = new URLSearchParams();
    if (merchant) query.set("merchantId", merchant);
    if (batch) query.set("batchId", batch);
    api<Reconciliation>(`/admin/reconciliation?${query}`)
      .then((result) => {
        if (active) {
          setData(result);
          setError("");
        }
      })
      .catch((e) => {
        if (active) {
          setError(message(e));
          setData(null);
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [merchant, batch, version]);
  return (
    <>
      <section className="card">
        <div className="filters">
          {isAdmin && (
            <select
              aria-label="对账商户"
              value={merchant}
              onChange={(e) => {
                setMerchant(e.target.value);
                setBatch("");
              }}
            >
              <option value="">全部商户</option>
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="对账批次"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
          >
            <option value="">全部批次</option>
            {batches
              .filter((b) => !merchant || b.merchantId === merchant)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
          </select>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => setVersion((v) => v + 1)}
          >
            {busy ? "查询中…" : "刷新对账"}
          </button>
          <button
            className="button"
            disabled={!data || busy}
            onClick={() =>
              data &&
              saveCsv(
                `山姆邻里拼对账-${new Date().toISOString().slice(0, 10)}.csv`,
                [
                  [
                    "订单号",
                    "实收元",
                    "已退元",
                    "净收元",
                    "应付元",
                    "待补元",
                    "余额支付元",
                    "余额退款元",
                    "差异",
                  ],
                  ...data.orders.map((row) => [
                    row.orderId,
                    row.paidCents / 100,
                    row.refundedCents / 100,
                    row.netReceivedCents / 100,
                    row.amountDueCents / 100,
                    row.topupCents / 100,
                    row.walletPaymentCents / 100,
                    row.walletRefundCents / 100,
                    row.discrepancies.join("；"),
                  ]),
                ],
              )
            }
          >
            下载对账CSV
          </button>
        </div>
        <p className="muted">
          对账为当前账本统计，包含开发交易时不代表真实银行到账。微信支付未开通前仅用于验证业务账目。
        </p>
        {error && <Notice type="error">{error}</Notice>}
      </section>
      {data && (
        <>
          <div className="cards">
            {[
              ["实收", data.paidCents],
              ["已退款", data.refundedCents],
              ["净收款", data.netReceivedCents],
              ["待补款", data.topupCents],
            ].map(([title, value]) => (
              <div className="card stat" key={title}>
                <div className="label">{title}</div>
                <div className="value">{money(Number(value))}</div>
              </div>
            ))}
          </div>
          {!!data.discrepancies.length && (
            <Notice type="error">
              发现 {data.discrepancies.length}{" "}
              项账目差异，请逐单核查，勿直接修改账本余额。
            </Notice>
          )}
          <section className="card">
            <div className="card-title">
              <h2>订单对账明细</h2>
              <span className="muted">{data.orderCount} 笔订单</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>订单</th>
                    <th>已收</th>
                    <th>已退</th>
                    <th>净收</th>
                    <th>应付</th>
                    <th>待补</th>
                    <th>余额退款</th>
                    <th>差异</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((row) => (
                    <tr key={row.orderId}>
                      <td>
                        <button
                          className="button link mono"
                          onClick={() => onOpenOrder(row.orderId)}
                        >
                          {row.orderId}
                        </button>
                      </td>
                      <td>{money(row.paidCents)}</td>
                      <td>{money(row.refundedCents)}</td>
                      <td>{money(row.netReceivedCents)}</td>
                      <td>{money(row.amountDueCents)}</td>
                      <td>{money(row.topupCents)}</td>
                      <td>{money(row.walletRefundCents)}</td>
                      <td>
                        <span
                          className={`badge ${row.discrepancies.length ? "red" : "green"}`}
                        >
                          {row.discrepancies.length
                            ? row.discrepancies.join("；")
                            : "一致"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.orders.length && <Empty title="暂无对账记录" />}
            </div>
          </section>
        </>
      )}
    </>
  );
}

export function AuditPanel({ api }: { api: Api }) {
  const [rows, setRows] = useState<OperationAudit[]>([]),
    [error, setError] = useState(""),
    [search, setSearch] = useState("");
  const load = async () => {
    try {
      setRows(await api<OperationAudit[]>("/admin/audit"));
      setError("");
    } catch (e) {
      setError(message(e));
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="card">
      <div className="card-title">
        <h2>操作审计</h2>
        <button className="button secondary" onClick={() => void load()}>
          刷新记录
        </button>
      </div>
      <div className="filters">
        <input
          aria-label="搜索审计记录"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="操作、账号、订单或处理原因"
        />
      </div>
      <p className="muted">
        平台查看全部，商户仅查看所属商户记录。审计记录由服务端生成，管理台无法编辑或删除。
      </p>
      {error && <Notice type="error">{error}</Notice>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>时间 / 操作</th>
              <th>操作人</th>
              <th>关联订单</th>
              <th>处理原因</th>
              <th>变更记录</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((row) =>
                `${row.action} ${row.actorId} ${row.orderId || ""} ${row.reason}`.includes(
                  search,
                ),
              )
              .map((row) => (
                <tr key={row.id}>
                  <td>
                    {date(row.createdAt)}
                    <small>{auditLabels[row.action] || row.action}</small>
                  </td>
                  <td className="mono">
                    {row.actorId}
                    <small>{row.merchantId}</small>
                  </td>
                  <td className="mono">{row.orderId || "—"}</td>
                  <td className="wrap-cell">{row.reason || "—"}</td>
                  <td>
                    <details>
                      <summary>查看前后变化</summary>
                      <pre className="audit-json">
                        {JSON.stringify(
                          { before: row.before, after: row.after },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!rows.length && (
          <Empty
            title="暂无审计记录"
            hint="库存、退款和履约等操作会自动记录。"
          />
        )}
      </div>
    </section>
  );
}

interface MediaRecord {
  id: string;
  kind: "receipt" | "photo";
  filename: string;
  size: number;
  createdAt: string;
}
export function MediaPanel({
  orderId,
  api,
  baseUrl,
  token,
}: {
  orderId: string;
  api: Api;
  baseUrl: string;
  token: string;
}) {
  const [rows, setRows] = useState<MediaRecord[]>([]),
    [kind, setKind] = useState<"receipt" | "photo">("receipt"),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [previews, setPreviews] = useState<Record<string, string>>({});
  const urls = useRef(new Set<string>()),
    input = useRef<HTMLInputElement>(null);
  const load = async () => {
    try {
      setRows(await api<MediaRecord[]>(`/orders/${orderId}/media`));
      setError("");
    } catch (e) {
      setError(message(e));
    }
  };
  useEffect(() => {
    void load();
    return () => {
      for (const url of urls.current) URL.revokeObjectURL(url);
    };
  }, [orderId]);
  const preview = async (row: MediaRecord) => {
    setBusy(row.id);
    setError("");
    try {
      const response = await fetch(
        `${baseUrl}/media/${encodeURIComponent(row.id)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (response.status === 401)
        window.dispatchEvent(new Event("sam:auth-expired"));
      if (!response.ok) throw new Error(`凭证读取失败（${response.status}）`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      urls.current.add(url);
      setPreviews((v) => ({ ...v, [row.id]: url }));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy("");
    }
  };
  const upload = async () => {
    if (!file) return;
    setBusy("upload");
    setError("");
    setSuccess("");
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024 ||
        file.size === 0
      )
        throw new Error("请选择不超过5MB的PNG、JPEG或WebP图片。");
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("图片读取失败"));
        reader.readAsDataURL(file);
      });
      await api(`/admin/orders/${orderId}/media`, "POST", {
        kind,
        filename: file.name,
        contentBase64,
      });
      setFile(null);
      if (input.current) input.current.value = "";
      await load();
      setSuccess("真实凭证已保存为私有图片，服务端已去除EXIF。");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy("");
    }
  };
  return (
    <section className="operations-section">
      <div className="card-title">
        <h3>真实小票与采购照片</h3>
        <button
          type="button"
          className="button link"
          onClick={() => void load()}
        >
          刷新凭证
        </button>
      </div>
      <p className="muted">
        图片经身份校验访问，支持PNG/JPEG/WebP，单张不超过5MB。上传后由服务端转JPEG并移除EXIF。
      </p>
      <div className="actions">
        <select
          aria-label="凭证类别"
          value={kind}
          onChange={(e) => setKind(e.target.value as "receipt" | "photo")}
        >
          <option value="receipt">原始采购小票</option>
          <option value="photo">真实采购照片</option>
        </select>
        <input
          ref={input}
          aria-label="选择真实凭证图片"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button
          type="button"
          className="button"
          disabled={!file || !!busy}
          onClick={() => void upload()}
        >
          {busy === "upload" ? "上传中…" : "上传并保存"}
        </button>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {success && <Notice type="success">{success}</Notice>}
      <div className="media-grid">
        {rows.map((row) => (
          <article className="media-item" key={row.id}>
            <div className="card-title">
              <strong>
                {row.kind === "receipt" ? "原始小票" : "采购照片"}
              </strong>
              <small>{(row.size / 1024).toFixed(0)} KB</small>
            </div>
            {previews[row.id] ? (
              <>
                <img
                  src={previews[row.id]}
                  alt={row.kind === "receipt" ? "真实采购小票" : "真实采购照片"}
                />
                <div className="actions">
                  <a
                    href={previews[row.id]}
                    download={
                      (row.filename || "凭证").replace(/\.[^.]+$/, "") + ".jpg"
                    }
                  >
                    下载图片
                  </a>
                  <button
                    className="button link"
                    onClick={() => {
                      const url = previews[row.id];
                      URL.revokeObjectURL(url);
                      urls.current.delete(url);
                      setPreviews((v) => {
                        const copy = { ...v };
                        delete copy[row.id];
                        return copy;
                      });
                    }}
                  >
                    收起
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="button small secondary"
                disabled={!!busy}
                onClick={() => void preview(row)}
              >
                {busy === row.id ? "读取中…" : "验证身份并预览"}
              </button>
            )}
            <p className="muted">{date(row.createdAt)}</p>
          </article>
        ))}
      </div>
      {!rows.length && !error && <p className="muted">尚未上传真实凭证。</p>}
    </section>
  );
}
