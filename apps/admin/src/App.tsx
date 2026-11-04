import { useContext, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  CommunityPanel,
  InventoryDialog,
  BatchCancelDialog,
  AfterSalesPanel,
  ReconciliationPanel,
  AuditPanel,
  OrderOperations,
  MediaPanel,
} from "./Operations";
import { TestUsersPanel, UatNotice } from "./TestUsers";
import {
  DraftScope,
  useDraftState,
  operationId,
  clearAccountDrafts,
  DraftNotice,
  Field,
  Modal,
  Notice,
  Empty,
} from "./ui";
import {
  request,
  money,
  date,
  cents,
  cleanUrl,
  defaultApiUrl,
  isUatBuild,
} from "./api";
import type {
  Batch,
  Catalog,
  Merchant,
  Order,
  Overview,
  PaymentConfig,
  Product,
  Role,
  Session,
  SplitOption,
  Wallet,
} from "./api";

const labels: Record<string, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
  paused: "暂停经营",
  open: "接单中",
  closed: "已截单",
  recruiting: "拼单中",
  full: "已成团",
  unpaid: "待支付",
  awaiting_topup: "待补差价",
  pending_payment: "待支付",
  paid: "已支付 · 待采购",
  purchasing: "采购中",
  portioning: "分装中",
  ready_for_pickup: "待自提",
  ready_for_delivery: "待配送",
  delivering: "配送中",
  completed: "已完成",
  cancelled: "已取消",
  refunded: "已退款",
  failed: "未成团",
  pickup: "到点自提",
  delivery: "送货到家",
  refund: "退款入账",
  weight_refund: "称重退差",
  payment: "余额支付",
  topup: "补款",
  group_refund: "未成团退款",
  active: "接单中",
  settled: "已结清",
  topup_due: "待补款",
  partially_refunded: "部分退款",
};
const tabs = [
  { id: "overview", label: "经营概览" },
  { id: "merchants", label: "商户管理" },
  { id: "communities", label: "社区与自提点" },
  { id: "products", label: "商品与拆分" },
  { id: "batches", label: "采购批次" },
  { id: "orders", label: "订单与履约" },
  { id: "after-sales", label: "售后处理" },
  { id: "wallet", label: "钱包流水" },
  { id: "reconciliation", label: "交易对账" },
  { id: "audit", label: "操作审计" },
];
const sessionKey = isUatBuild
  ? "wxsam.admin.uat.session"
  : "wxsam.admin.session";
const statusOptions = [
  "purchasing",
  "portioning",
  "ready_for_pickup",
  "delivering",
  "completed",
];
const nextOrderStatus = (order: Order) =>
  ({
    paid: "purchasing",
    purchasing: "portioning",
    portioning:
      order.fulfillment === "pickup" ? "ready_for_pickup" : "delivering",
    delivering: "completed",
  })[order.status] || "";
const label = (value?: string) => (value ? labels[value] || value : "—");
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "操作失败，请重试。";
function Badge({ value }: { value?: string }) {
  const tone = ["approved", "completed", "full"].includes(value || "")
    ? "green"
    : ["pending", "unpaid", "pending_payment", "portioning"].includes(
          value || "",
        )
      ? "orange"
      : ["rejected", "cancelled", "refunded", "failed"].includes(value || "")
        ? "red"
        : "";
  return <span className={`badge ${tone}`}>{label(value)}</span>;
}
function useSession(base: string) {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(sessionKey) || "null");
      if (stored && !stored.apiUrl) return null;
      if (stored?.apiUrl && stored.apiUrl !== cleanUrl(base)) return null;
      if (
        stored &&
        (!stored.token || !["admin", "merchant"].includes(stored.user?.role))
      )
        return null;
      return stored;
    } catch {
      return null;
    }
  });
  const save = (value: Session | null) => {
    const bound = value ? { ...value, apiUrl: cleanUrl(base) } : null;
    setSession(bound);
    if (bound) sessionStorage.setItem(sessionKey, JSON.stringify(bound));
    else sessionStorage.removeItem(sessionKey);
  };
  return [session, save] as const;
}

function Login({
  apiUrl,
  setApiUrl,
  onLogin,
  message,
}: {
  apiUrl: string;
  setApiUrl: (value: string) => void;
  onLogin: (value: Session) => void;
  message?: string;
}) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [development, setDevelopment] = useState(false);
  const [role, setRole] = useState<Role>("admin"),
    [merchantId, setMerchantId] = useState(""),
    [merchants, setMerchants] = useState<Merchant[]>([]);
  const [config, setConfig] = useState<PaymentConfig | null>(null),
    [configError, setConfigError] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setConfig(null);
    setConfigError("");
    request<PaymentConfig>(apiUrl, "/config")
      .then(async (settings) => {
        if (!active) return;
        setConfig(settings);
        if (isUatBuild && settings?.uatEnabled !== true) {
          setConfigError("接口未确认线上测试环境。请刷新后重试或联系平台运营。");
        }
        if (isUatBuild || !settings?.devAuthEnabled) {
          setDevelopment(false);
          return;
        }
        const catalog = await request<Catalog>(apiUrl, "/catalog");
        if (!active) return;
        setMerchants(catalog.merchants || []);
        setMerchantId(catalog.merchants?.[0]?.id || "");
      })
      .catch((err) => {
        if (active) setConfigError(errorMessage(err));
      });
    return () => {
      active = false;
    };
  }, [apiUrl]);
  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || (isUatBuild && config?.uatEnabled !== true)) return;
    setBusy(true);
    setError("");
    try {
      const result = await request<Session>(
        apiUrl,
        development ? "/auth/dev-login" : "/auth/management/login",
        undefined,
        "POST",
        development
          ? {
              role,
              ...(role === "merchant" ? { merchantId } : {}),
              nickname: role === "admin" ? "平台运营" : "商户运营",
            }
          : { username: username.trim(), password },
      );
      if (!result.token || !["admin", "merchant"].includes(result.user?.role))
        throw new Error("服务未返回有效的管理会话。");
      setPassword("");
      onLogin({ ...result, development });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-layout">
      <div className="login-hero">
        <div className="brand">
          <strong>山姆邻里拼</strong>
          <span>烟台 · 多商户代购协作平台</span>
        </div>
        <div className="line" />
        <h1>
          把每一份邻里信任，
          <br />
          变成有序的日常。
        </h1>
        <p>
          商品、拼单、采购、分装与履约，在同一处协作。清晰记录每一笔交易和每一次交付。
        </p>
      </div>
      <div className="login-side">
        <form className="login-card" onSubmit={login}>
          <p className="muted">山姆邻里拼 / 运营管理台</p>
          <h2>{development ? "本机开发测试" : "登录工作台"}</h2>
          <p className="muted">
            {development
              ? "仅用于本机联调，不产生真实资金。"
              : "使用平台分配的管理员或商户账号登录。"}
          </p>
          {isUatBuild && <UatNotice />}
          {isUatBuild && config?.uatEnabled !== true && (
            <p className="muted" role="status">
              {configError ||
                (config
                  ? "测试服务未启用。请联系平台运营。"
                  : "正在确认线上测试服务…")}
            </p>
          )}
          {development ? (
            <>
              <div className="role-tabs">
                <button
                  type="button"
                  className={role === "admin" ? "active" : ""}
                  onClick={() => setRole("admin")}
                >
                  平台运营
                </button>
                <button
                  type="button"
                  className={role === "merchant" ? "active" : ""}
                  onClick={() => setRole("merchant")}
                >
                  代购商户
                </button>
              </div>
              {role === "merchant" && (
                <Field label="测试商户">
                  <select
                    required
                    value={merchantId}
                    onChange={(e) => setMerchantId(e.target.value)}
                  >
                    {merchants.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Notice>
                开发身份由服务端显式开启，仅供测试。生产环境关闭此入口。
              </Notice>
            </>
          ) : (
            <>
              <Field label="账号">
                <input
                  required
                  name="username"
                  autoComplete="username"
                  maxLength={64}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </Field>
              <Field label="密码">
                <input
                  required
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
            </>
          )}
          {(error || message) && (
            <p className="inline-error" role="alert">
              {error || message}
            </p>
          )}
          <button
            className="button"
            disabled={busy || (isUatBuild && config?.uatEnabled !== true)}
          >
            {busy ? "正在登录…" : development ? "使用开发会话进入" : "登录"}
          </button>
          {!isUatBuild && config?.devAuthEnabled && (
            <button
              type="button"
              className="button link"
              onClick={() => {
                setDevelopment((v) => !v);
                setError("");
              }}
            >
              {development ? "返回账号密码登录" : "本机开发测试入口"}
            </button>
          )}
          {!isUatBuild && (
            <details className="login-advanced">
              <summary>连接设置</summary>
              <Field
                label="业务 API 地址"
                help="可填写 /api 或完整的 HTTPS API 地址。"
              >
                <input
                  required
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="/api"
                />
              </Field>
            </details>
          )}
          <p className="version">账号由平台运营分配。登录界面不保存密码。</p>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [apiUrl, changeApiUrl] = useState(() =>
    isUatBuild
      ? defaultApiUrl
      : localStorage.getItem("wxsam.admin.api") || defaultApiUrl,
  );
  const [session, saveSession] = useSession(apiUrl);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [merchantFilter, setMerchantFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [inventoryProduct, setInventoryProduct] = useState<Product | null>(
    null,
  );
  const [cancelBatch, setCancelBatch] = useState<Batch | null>(null);
  const [editProduct, setEditProduct] = useState<Product | "new" | null>(null);
  const [editBatch, setEditBatch] = useState<Batch | "new" | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    detail: string;
    reason?: boolean;
    onConfirm: (reason: string) => Promise<void>;
  } | null>(null);
  const [applyMerchant, setApplyMerchant] = useState(false);
  const [pickingBatchId, setPickingBatchId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState("");
  useEffect(() => {
    const expired = () => {
      saveSession(null);
      setConfig(null);
      setError("登录已过期，请重新登录。");
    };
    window.addEventListener("sam:auth-expired", expired);
    return () => window.removeEventListener("sam:auth-expired", expired);
  }, []);
  const setApiUrl = (value: string) => {
    if (isUatBuild) return;
    changeApiUrl(value);
    localStorage.setItem("wxsam.admin.api", value);
  };
  const api = <T,>(path: string, method = "GET", body?: unknown) =>
    request<T>(cleanUrl(apiUrl), path, session?.token, method, body);
  const load = async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const [summary, merchantRows, productRows, batchRows, orderRows] =
        await Promise.all([
          api<Overview>("/admin/overview"),
          api<Merchant[]>("/admin/merchants"),
          api<Product[]>("/admin/products"),
          api<Batch[]>("/admin/batches"),
          api<Order[]>("/admin/orders"),
        ]);
      setOverview(summary);
      setMerchants(merchantRows);
      setProducts(productRows);
      setBatches(batchRows);
      setOrders(orderRows);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!session) return;
    let active = true;
    if (!isUatBuild) void load();
    request<PaymentConfig>(apiUrl, "/config")
      .then((settings) => {
        if (!active) return;
        if (isUatBuild && settings?.uatEnabled !== true)
          throw new Error("线上测试服务未启用。");
        setConfig(settings);
        if (isUatBuild) void load();
      })
      .catch((err) => {
        if (!active) return;
        setConfig(null);
        if (isUatBuild) {
          saveSession(null);
          setError(errorMessage(err));
        }
      });
    return () => {
      active = false;
    };
  }, [session?.token]); // A session is bound to its API address.
  const mutate = async (
    key: string,
    path: string,
    method: string,
    body?: unknown,
    message = "操作已保存。",
  ) => {
    setBusyAction(key);
    setError("");
    setSuccess("");
    try {
      const result = await api<unknown>(path, method, body);
      setSuccess(message);
      await load();
      return result;
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    } finally {
      setBusyAction("");
    }
  };
  const nameForMerchant = (id: string) =>
    merchants.find((m) => m.id === id)?.name || id;
  const nameForBatch = (id: string) =>
    batches.find((b) => b.id === id)?.title || id;
  const changeTab = (id: string) => {
    setTab(id);
    setSearch("");
    setStatus("all");
    setSuccess("");
  };
  if (!session)
    return (
      <Login
        apiUrl={apiUrl}
        setApiUrl={setApiUrl}
        onLogin={(value) => {
          setTab("overview");
          setConfig(null);
          saveSession(value);
        }}
        message={error}
      />
    );
  if (isUatBuild && config?.uatEnabled !== true) {
    return (
      <main className="login-side">
        <div className="login-card">
          <UatNotice />
          <p role="status">正在确认线上测试服务…</p>
        </div>
      </main>
    );
  }
  const isAdmin = session.user.role === "admin";
  const canReviewUat =
    isUatBuild &&
    config?.uatEnabled === true &&
    isAdmin &&
    !session.development;
  const visibleTabs = canReviewUat
    ? [...tabs, { id: "test-users", label: "测试用户审批" }]
    : tabs;
  const filteredOrders = orders.filter(
    (o) =>
      (status === "all" || o.status === status) &&
      (merchantFilter === "all" || o.merchantId === merchantFilter) &&
      (batchFilter === "all" || o.batchId === batchFilter) &&
      `${o.id} ${o.orderId || ""} ${o.recipientName || ""} ${o.recipientPhone || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  return (
    <DraftScope.Provider value={`${cleanUrl(apiUrl)}:${session.user.id}`}>
      <div className="layout">
        <aside className="sidebar">
          <div className="brand">
            <strong>山姆邻里拼</strong>
            <span>烟台 · 运营管理台</span>
          </div>
          <nav className="nav" aria-label="主导航">
            {visibleTabs.map((item, index) => (
              <button
                key={item.id}
                className={tab === item.id ? "active" : ""}
                onClick={() => changeTab(item.id)}
              >
                <span className="number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {item.id === "merchants" && !isAdmin ? "商户资料" : item.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-foot">
            自提 + 送货到家
            <br />
            多商户独立经营 · 平台统一协作
          </div>
        </aside>
        <main className="main">
          <header className="topbar">
            <span className="breadcrumb">
              运营管理台 / {visibleTabs.find((t) => t.id === tab)?.label}
            </span>
            <div className="account">
              <span className="avatar">{isAdmin ? "平" : "商"}</span>
              <span>
                {isAdmin
                  ? "平台运营"
                  : nameForMerchant(session.user.merchantId || "")}
              </span>
              <span className="badge gray">
                {session.development || session.user.id.startsWith("dev-")
                  ? "开发会话"
                  : "管理会话"}
              </span>
              <button
                className="button link"
                onClick={() => {
                  void api("/auth/logout", "POST").catch(() => undefined);
                  clearAccountDrafts(`${cleanUrl(apiUrl)}:${session.user.id}`);
                  saveSession(null);
                  setConfig(null);
                  setOverview(null);
                  setOrders([]);
                }}
              >
                退出
              </button>
            </div>
          </header>
          <div className="page-head">
            <div>
              <h1>
                {tab === "merchants" && !isAdmin
                  ? "商户资料"
                  : visibleTabs.find((t) => t.id === tab)?.label}
              </h1>
              <p className="muted">
                {(
                  {
                    communities: "维护社区与真实自提地址，停用不影响历史订单。",
                    "after-sales": "处理顾客申请，记录原因并按规则退款至余额。",
                    reconciliation:
                      "按商户与批次核对实收、退款、待补款及钱包流水。",
                    audit: "查看操作人、时间、处理原因及变更前后记录。",
                    "test-users":
                      "管理已在测试版登录的微信顾客的虚拟付款资格。",
                  } as Record<string, string>
                )[tab] ||
                  (tab === "overview"
                    ? "从接单到交付，每一步清晰可见。"
                    : tab === "products"
                      ? "统一管理整件商品与拆分规格，价格以人民币元填写。"
                      : tab === "batches"
                        ? "设定截单时间，集中采购，按批次完成履约。"
                        : tab === "orders"
                          ? "查看订单、更新采购进度、处理称重差价与交付核销。"
                          : tab === "wallet"
                            ? "按顾客查询余额及退款、支付流水。"
                            : "管理烟台代购商户及入驻审核。")}
              </p>
            </div>
            <div className="actions">
              <button
                className="button secondary"
                disabled={loading}
                onClick={() => void load()}
              >
                {loading ? "刷新中…" : "刷新数据"}
              </button>
              {tab === "products" && (
                <button
                  className="button"
                  onClick={() => setEditProduct("new")}
                >
                  ＋ 新建商品
                </button>
              )}
              {tab === "batches" && (
                <button className="button" onClick={() => setEditBatch("new")}>
                  ＋ 新建批次
                </button>
              )}
              {tab === "merchants" && isAdmin && (
                <button
                  className="button"
                  onClick={() => setApplyMerchant(true)}
                >
                  ＋ 录入入驻申请
                </button>
              )}
            </div>
          </div>
          {isUatBuild ? (
            <UatNotice />
          ) : (
            <Notice>
              {!config?.wechatPayConfigured &&
                "微信支付尚未配置。正式收款需完成微信支付商户接入。"}
              {config?.devPaymentsEnabled && "本机开发测试支付已开启。"}
              {config?.wechatPayConfigured &&
                !config.devPaymentsEnabled &&
                "微信支付已配置。"}
            </Notice>
          )}
          {error && (
            <Notice type="error">
              {error}
              <button className="button link" onClick={() => setError("")}>
                关闭
              </button>
            </Notice>
          )}
          {success && <Notice type="success">{success}</Notice>}
          {tab === "overview" && (
            <>
              <div className="cards">
                <Stat
                  label="订单总数"
                  value={overview?.orders ?? "—"}
                  hint="当前会话可访问的订单"
                />
                <Stat
                  label={isUatBuild ? "虚拟净收款" : "净收款（含货款）"}
                  value={overview ? money(overview.revenueCents) : "—"}
                  hint={
                    isUatBuild
                      ? "按测试订单已收减已退统计"
                      : "按订单已收减已退统计，含商品货款"
                  }
                />
                <Stat
                  label="商品总数"
                  value={overview?.products ?? "—"}
                  hint="含上架与下架的商品"
                />
                <Stat
                  label={isAdmin ? "待审核商户" : "采购批次数"}
                  value={
                    overview
                      ? isAdmin
                        ? overview.pendingReviews
                        : overview.batches
                      : "—"
                  }
                  hint={isAdmin ? "审核通过后开放经营" : "按批次管理采购与交付"}
                />
              </div>
              <div className="grid-two">
                <section className="card">
                  <div className="card-title">
                    <h2>近期订单</h2>
                    <button
                      className="button link"
                      onClick={() => changeTab("orders")}
                    >
                      查看全部 →
                    </button>
                  </div>
                  {orders.length ? (
                    orders.slice(0, 5).map((o) => (
                      <div className="record" key={o.id}>
                        <div>
                          <button
                            className="button link mono"
                            onClick={() => setSelectedOrderId(o.id)}
                          >
                            {o.id}
                          </button>
                          <p>
                            {o.recipientName || "顾客"} · {date(o.createdAt)}
                          </p>
                        </div>
                        <div>
                          <Badge value={o.status} />
                          <p>{orderTotal(o)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <Empty title="还没有订单" hint="顾客下单后会在这里显示。" />
                  )}
                </section>
                <section className="card">
                  <h2>运营规则</h2>
                  <Rule
                    title="代购服务费"
                    value="商品金额的 6%，最低 ¥4，最高 ¥25"
                  />
                  <Rule title="冷链包装" value="¥3 / 单，商品满 ¥199 免收" />
                  <Rule
                    title="送货到家"
                    value="¥8 / 单，商品满 ¥299 免收；自提免费"
                  />
                  <Rule
                    title="未成团处理"
                    value="截单后自动处理未成团退款，退入顾客余额"
                  />
                  <Rule
                    title="称重商品"
                    value="按实际金额多退少补，退差进入余额"
                  />
                </section>
              </div>
              <section className="card">
                <div className="card-title">
                  <h2>即将截单的批次</h2>
                  <button
                    className="button link"
                    onClick={() => changeTab("batches")}
                  >
                    管理批次 →
                  </button>
                </div>
                {batches.filter((b) => b.status === "open" && !b.closedAt)
                  .length ? (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>批次</th>
                          <th>商户 / 门店</th>
                          <th>截单时间</th>
                          <th>状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batches
                          .filter((b) => b.status === "open" && !b.closedAt)
                          .sort((a, b) => a.cutoffAt.localeCompare(b.cutoffAt))
                          .slice(0, 5)
                          .map((b) => (
                            <tr key={b.id}>
                              <td className="name">{b.title}</td>
                              <td>
                                {nameForMerchant(b.merchantId)}
                                <small>{b.storeName}</small>
                              </td>
                              <td>{date(b.cutoffAt)}</td>
                              <td>
                                <Badge value={b.status} />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="暂无接单中的批次"
                    hint="新建采购批次后即可开始接单。"
                  />
                )}
              </section>
            </>
          )}
          {tab === "merchants" && (
            <section className="card">
              <div className="filters">
                <input
                  aria-label="搜索商户"
                  placeholder="搜索商户名称、联系人或电话"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label="审核状态"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">全部状态</option>
                  <option value="pending">待审核</option>
                  <option value="approved">已通过</option>
                  <option value="rejected">已拒绝</option>
                  <option value="paused">暂停经营</option>
                </select>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>商户</th>
                      <th>联系人</th>
                      <th>服务城市</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {merchants
                      .filter(
                        (m) =>
                          (status === "all" || m.status === status) &&
                          `${m.name} ${m.contactName} ${m.contactPhone}`.includes(
                            search,
                          ),
                      )
                      .map((m) => (
                        <tr key={m.id}>
                          <td className="name">
                            {m.name}
                            <small>{m.id}</small>
                          </td>
                          <td>
                            {m.contactName || "—"}
                            <small>{m.contactPhone}</small>
                          </td>
                          <td>{m.city || "烟台"}</td>
                          <td>
                            <Badge value={m.status} />
                            <small>{m.reviewReason || m.reason}</small>
                          </td>
                          <td>
                            {isAdmin ? (
                              <div className="actions">
                                <button
                                  className="button small secondary"
                                  disabled={
                                    !!busyAction || m.status === "approved"
                                  }
                                  onClick={() =>
                                    void mutate(
                                      m.id,
                                      `/admin/merchants/${m.id}/review`,
                                      "POST",
                                      { status: "approved" },
                                      "商户已审核通过。",
                                    ).catch(() => undefined)
                                  }
                                >
                                  {m.status === "paused" ? "恢复经营" : "通过"}
                                </button>
                                <button
                                  className="button small danger"
                                  disabled={
                                    !!busyAction || m.status === "rejected"
                                  }
                                  onClick={() =>
                                    setConfirmation({
                                      title: "拒绝商户入驻申请",
                                      detail: `请填写拒绝「${m.name}」的原因，商户可据此补充资料。`,
                                      reason: true,
                                      onConfirm: async (reason) => {
                                        await mutate(
                                          m.id,
                                          `/admin/merchants/${m.id}/review`,
                                          "POST",
                                          { status: "rejected", reason },
                                          "已记录拒绝原因。",
                                        );
                                        setConfirmation(null);
                                      },
                                    })
                                  }
                                >
                                  拒绝
                                </button>
                                <button
                                  className="button small secondary"
                                  disabled={
                                    !!busyAction || m.status !== "approved"
                                  }
                                  onClick={() =>
                                    setConfirmation({
                                      title: "暂停商户经营",
                                      detail: `暂停「${m.name}」后不再接受新单，历史订单仍可处理。请填写原因。`,
                                      reason: true,
                                      onConfirm: async (reason) => {
                                        await mutate(
                                          m.id,
                                          `/admin/merchants/${m.id}/review`,
                                          "POST",
                                          { status: "paused", reason },
                                          "商户已暂停经营。",
                                        );
                                        setConfirmation(null);
                                      },
                                    })
                                  }
                                >
                                  暂停经营
                                </button>
                              </div>
                            ) : (
                              <span className="muted">平台审核</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!merchants.length && <Empty />}
              </div>
            </section>
          )}
          {tab === "products" && (
            <section className="card">
              <div className="filters">
                <input
                  aria-label="搜索商品"
                  placeholder="搜索商品名称、分类或标签"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {isAdmin && (
                  <MerchantSelect
                    merchants={merchants}
                    value={merchantFilter}
                    onChange={setMerchantFilter}
                  />
                )}
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>商品</th>
                      <th>所属商户</th>
                      <th>整件价格</th>
                      <th>拆分规格</th>
                      <th>库存</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products
                      .filter(
                        (p) =>
                          (merchantFilter === "all" ||
                            p.merchantId === merchantFilter) &&
                          `${p.name} ${p.categoryId} ${p.tags.join(" ")}`.includes(
                            search,
                          ),
                      )
                      .map((p) => (
                        <tr key={p.id}>
                          <td className="name">
                            {p.name}
                            <small>
                              {p.originalSpecs}{" "}
                              {p.requiresColdChain ? "· 冷链" : ""}{" "}
                              {p.active === false ? "· 已下架" : ""}
                            </small>
                          </td>
                          <td>{nameForMerchant(p.merchantId)}</td>
                          <td>{money(p.originalPriceCents)}</td>
                          <td>
                            <div className="pill-list">
                              {p.options.map((o) => (
                                <span className="badge gray" key={o.id}>
                                  {o.name} · {money(o.priceCents)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            {(p.inventoryUnits !== undefined && p.inventoryScale
                              ? p.inventoryUnits / p.inventoryScale
                              : p.stock
                            ).toLocaleString("zh-CN", {
                              maximumFractionDigits: 4,
                            })}{" "}
                            整包
                            {p.inventoryNeedsReview && (
                              <small className="danger-text">待盘点确认</small>
                            )}
                          </td>
                          <td>
                            <div className="actions">
                              <button
                                className="button small secondary"
                                onClick={() => setInventoryProduct(p)}
                              >
                                库存盘点
                              </button>
                              <button
                                className="button small secondary"
                                onClick={() => setEditProduct(p)}
                              >
                                编辑
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!products.length && (
                  <Empty
                    title="暂无商品"
                    hint="新建商品并设置整件与拆分规格。"
                  />
                )}
              </div>
            </section>
          )}
          {tab === "batches" && (
            <section className="card">
              <div className="filters">
                <input
                  aria-label="搜索批次"
                  placeholder="搜索批次名称或门店"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {isAdmin && (
                  <MerchantSelect
                    merchants={merchants}
                    value={merchantFilter}
                    onChange={setMerchantFilter}
                  />
                )}
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>批次</th>
                      <th>商户 / 门店</th>
                      <th>截单时间 / 自提时间</th>
                      <th>订单数</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches
                      .filter(
                        (b) =>
                          (merchantFilter === "all" ||
                            b.merchantId === merchantFilter) &&
                          `${b.title} ${b.storeName}`.includes(search),
                      )
                      .map((b) => (
                        <tr key={b.id}>
                          <td className="name">
                            {b.title}
                            <small>{b.id}</small>
                          </td>
                          <td>
                            {nameForMerchant(b.merchantId)}
                            <small>{b.storeName}</small>
                          </td>
                          <td>
                            {date(b.cutoffAt)}
                            <small>
                              {date(b.pickupStartAt)} — {date(b.pickupEndAt)}
                            </small>
                          </td>
                          <td>
                            {orders.filter((o) => o.batchId === b.id).length}
                          </td>
                          <td>
                            <Badge value={b.status} />
                          </td>
                          <td>
                            <div className="actions">
                              <button
                                className="button small secondary"
                                onClick={() => setEditBatch(b)}
                              >
                                编辑
                              </button>
                              <button
                                className="button small secondary"
                                onClick={() => setPickingBatchId(b.id)}
                              >
                                采购清单
                              </button>
                              <button
                                className="button small secondary"
                                onClick={() => {
                                  setBatchFilter(b.id);
                                  changeTab("orders");
                                }}
                              >
                                订单
                              </button>
                              <button
                                className="button small"
                                disabled={
                                  !!busyAction ||
                                  !!b.closedAt ||
                                  ["cancelled", "completed"].includes(b.status)
                                }
                                onClick={() =>
                                  setConfirmation({
                                    title: "确认采购批次截单",
                                    detail: `截单「${b.title}」后，系统将停止该批次接单，取消未支付订单，并按规则将未成团份额退款至顾客余额。截单后不可重新开放。`,
                                    onConfirm: async () => {
                                      await mutate(
                                        b.id,
                                        `/admin/batches/${b.id}/close`,
                                        "POST",
                                        {},
                                        "已截单，未成团退款已由服务端处理。",
                                      );
                                      setConfirmation(null);
                                    },
                                  })
                                }
                              >
                                截单
                              </button>
                              <button
                                className="button small danger"
                                disabled={["completed", "cancelled"].includes(
                                  b.status,
                                )}
                                onClick={() => setCancelBatch(b)}
                              >
                                取消批次
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!batches.length && (
                  <Empty
                    title="暂无采购批次"
                    hint="创建批次并设定截单与自提时间。"
                  />
                )}
              </div>
            </section>
          )}
          {tab === "orders" && (
            <section className="card">
              <div className="filters">
                <input
                  aria-label="搜索订单"
                  placeholder="订单号、收货人或手机号"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label="订单状态"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">全部订单状态</option>
                  {Array.from(
                    new Set([
                      ...orders.map((o) => o.status),
                      "paid",
                      ...statusOptions,
                    ]),
                  ).map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </select>
                {isAdmin && (
                  <MerchantSelect
                    merchants={merchants}
                    value={merchantFilter}
                    onChange={setMerchantFilter}
                  />
                )}
                <select
                  aria-label="采购批次"
                  value={batchFilter}
                  onChange={(e) => setBatchFilter(e.target.value)}
                >
                  <option value="all">全部批次</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>订单 / 时间</th>
                      <th>顾客</th>
                      <th>商户 / 批次</th>
                      <th>履约方式</th>
                      <th>金额</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((o) => (
                      <tr key={o.id}>
                        <td className="name mono">
                          {o.id}
                          <small>{date(o.createdAt)}</small>
                        </td>
                        <td>
                          {o.recipientName || "—"}
                          <small>{o.recipientPhone}</small>
                        </td>
                        <td>
                          {nameForMerchant(o.merchantId)}
                          <small>{nameForBatch(o.batchId)}</small>
                        </td>
                        <td>{label(o.fulfillment)}</td>
                        <td>
                          {orderTotal(o)}
                          {!!o.topupCents && (
                            <small className="danger-text">
                              待补 {money(o.topupCents)}
                            </small>
                          )}
                        </td>
                        <td>
                          <Badge value={o.status} />
                        </td>
                        <td>
                          <button
                            className="button small secondary"
                            onClick={() => setSelectedOrderId(o.id)}
                          >
                            查看 / 履约
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filteredOrders.length && (
                  <Empty title="暂无匹配订单" hint="尝试调整筛选条件。" />
                )}
              </div>
            </section>
          )}
          {tab === "wallet" && !isAdmin && (
            <Notice>
              顾客完整钱包及资金流水仅限平台运营查看。商户可在订单详情查看该订单的退款与待补款。
            </Notice>
          )}
          {tab === "wallet" && isAdmin && (
            <WalletPanel
              api={api}
              customerIds={Array.from(
                new Set(
                  orders
                    .map((o) => o.customerId || o.userId)
                    .filter((x): x is string => !!x),
                ),
              )}
            />
          )}
          {tab === "communities" && (
            <CommunityPanel
              api={api}
              merchants={merchants}
              merchantId={session.user.merchantId}
            />
          )}
          {tab === "after-sales" && (
            <AfterSalesPanel
              api={api}
              orders={orders}
              onOpenOrder={setSelectedOrderId}
              onChanged={load}
            />
          )}
          {tab === "reconciliation" && (
            <ReconciliationPanel
              api={api}
              merchants={merchants}
              batches={batches}
              isAdmin={isAdmin}
              onOpenOrder={setSelectedOrderId}
            />
          )}
          {tab === "audit" && <AuditPanel api={api} />}
          {tab === "test-users" && canReviewUat && <TestUsersPanel api={api} />}
          <p className="footer-note">
            山姆邻里拼 ·
            烟台运营管理台　所有金额、权限与状态变更均由业务服务校验。
          </p>
        </main>
        {inventoryProduct && (
          <InventoryDialog
            product={inventoryProduct}
            api={api}
            onClose={() => setInventoryProduct(null)}
            onSaved={async () => {
              setInventoryProduct(null);
              await load();
            }}
          />
        )}
        {cancelBatch && (
          <BatchCancelDialog
            batch={cancelBatch}
            api={api}
            onClose={() => setCancelBatch(null)}
            onSaved={async () => {
              setCancelBatch(null);
              await load();
            }}
          />
        )}
        {confirmation && (
          <ConfirmAction
            {...confirmation}
            onClose={() => setConfirmation(null)}
          />
        )}
        {pickingBatchId && (
          <PickingList
            batchId={pickingBatchId}
            api={api}
            onClose={() => setPickingBatchId(null)}
          />
        )}
        {editProduct && (
          <ProductEditor
            product={editProduct === "new" ? undefined : editProduct}
            merchants={merchants}
            merchantId={session.user.merchantId}
            onClose={() => setEditProduct(null)}
            onSave={async (body) => {
              await mutate(
                "product",
                editProduct === "new"
                  ? "/admin/products"
                  : `/admin/products/${editProduct.id}`,
                editProduct === "new" ? "POST" : "PATCH",
                body,
                "商品及规格已保存。",
              );
              setEditProduct(null);
            }}
          />
        )}
        {editBatch && (
          <BatchEditor
            batch={editBatch === "new" ? undefined : editBatch}
            merchants={merchants}
            merchantId={session.user.merchantId}
            onClose={() => setEditBatch(null)}
            onSave={async (body) => {
              await mutate(
                "batch",
                editBatch === "new"
                  ? "/admin/batches"
                  : `/admin/batches/${editBatch.id}`,
                editBatch === "new" ? "POST" : "PATCH",
                body,
                "采购批次已保存。",
              );
              setEditBatch(null);
            }}
          />
        )}
        {applyMerchant && (
          <MerchantApply
            onClose={() => setApplyMerchant(false)}
            onSave={async (body) => {
              await mutate(
                "apply",
                "/merchants/apply",
                "POST",
                body,
                "入驻申请已提交，等待平台审核。",
              );
              setApplyMerchant(false);
            }}
          />
        )}
        {selectedOrder && (
          <OrderDetail
            order={selectedOrder}
            api={api}
            mediaBase={cleanUrl(apiUrl)}
            token={session.token}
            onReload={load}
            merchantName={
              selectedOrder.merchantSnapshot?.name ||
              nameForMerchant(selectedOrder.merchantId)
            }
            batchName={
              selectedOrder.batchSnapshot?.title ||
              nameForBatch(selectedOrder.batchId)
            }
            onClose={() => setSelectedOrderId(null)}
            onAction={async (action, body, message) => {
              await mutate(
                selectedOrder.id,
                `/admin/orders/${selectedOrder.id}/${action}`,
                "POST",
                body,
                message,
              );
            }}
          />
        )}
      </div>
    </DraftScope.Provider>
  );
}
function Stat({
  label: title,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="card stat">
      <div className="label">{title}</div>
      <div className="value">{value}</div>
      <div className="hint">{hint}</div>
    </div>
  );
}
function Rule({ title, value }: { title: string; value: string }) {
  return (
    <div className="record">
      <span>{title}</span>
      <span className="muted">{value}</span>
    </div>
  );
}
function MerchantSelect({
  merchants,
  value,
  onChange,
}: {
  merchants: Merchant[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label="所属商户"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="all">全部商户</option>
      {merchants.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
function orderPricing(order: Order) {
  return (
    order.finalPricing || order.pricing || order.quote || order.totals || {}
  );
}
function orderTotal(order: Order) {
  const p = orderPricing(order);
  return money(
    Math.max(
      0,
      (p.totalCents ??
        p.totalPayableCents ??
        order.totalCents ??
        order.totalPaidCents ??
        order.paidCents ??
        0) - (order.afterSalesCreditCents || 0),
    ),
  );
}

function ProductEditor({
  product,
  merchants,
  merchantId,
  onClose,
  onSave,
}: {
  product?: Product;
  merchants: Merchant[];
  merchantId?: string;
  onClose: () => void;
  onSave: (body: unknown) => Promise<void>;
}) {
  const [form, setForm, clearForm, resetForm, restoredForm] = useDraftState(
    `product-${product?.id || "new"}`,
    {
      merchantId:
        product?.merchantId ||
        merchantId ||
        merchants.find((m) => m.status === "approved")?.id ||
        "",
      name: product?.name || "",
      subtitle: product?.subtitle || "",
      categoryId: product?.categoryId || "bakery",
      originalPrice: ((product?.originalPriceCents || 0) / 100).toString(),
      originalSpecs: product?.originalSpecs || "",
      canSplit: product?.canSplit ?? true,
      requiresColdChain: product?.requiresColdChain ?? false,
      stock: String(
        product?.inventoryUnits !== undefined && product.inventoryScale
          ? product.inventoryUnits / product.inventoryScale
          : (product?.stock ?? 100),
      ),
      tags: product?.tags.join("，") || "",
      iconType: product?.iconType || "bakery",
      accentColor: product?.accentColor || "#0755a5",
      active: product?.active ?? true,
    },
  );
  const [options, setOptions, clearOptions, resetOptions] = useDraftState<
    (SplitOption & { priceInput: string })[]
  >(
    `options-${product?.id || "new"}`,
    product?.options.map((o) => ({
      ...o,
      priceInput: (o.priceCents / 100).toFixed(2),
    })) || [
      {
        id: "whole",
        name: "整件原装",
        ratio: 1,
        slots: 1,
        weightEstimate: "",
        priceCents: 0,
        priceInput: "",
        description: "",
      },
    ],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));
  const changeOption = (
    index: number,
    key: keyof (SplitOption & { priceInput: string }),
    value: string | number,
  ) =>
    setOptions((current) =>
      current.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!form.merchantId) throw new Error("请选择所属商户。");
      if (!options.length || options.length > 10)
        throw new Error("请配置 1 至 10 个购买规格。");
      const normalizedOptions = options.map((o) => {
        const priceCents = cents(o.priceInput ?? String(o.priceCents / 100));
        if (
          !o.name.trim() ||
          o.ratio <= 0 ||
          o.ratio > 1 ||
          o.slots < 1 ||
          o.slots > 20 ||
          Math.abs(o.ratio * o.slots - 1) > 0.01 ||
          !Number.isInteger(o.slots) ||
          priceCents < 1 ||
          !Number.isSafeInteger(priceCents)
        )
          throw new Error(
            "请检查规格：售价至少0.01元，比例×成团份数应等于1，每团最多20份。",
          );
        const { priceInput, ...value } = o;
        void priceInput;
        return { ...value, priceCents, name: o.name.trim() };
      });
      const { stock, ...productForm } = form;
      void stock;
      await onSave({
        ...productForm,
        name: form.name.trim(),
        originalPriceCents: cents(form.originalPrice),
        ...(product ? {} : { stock: Number(form.stock) }),
        tags: form.tags
          .split(/[，,]/)
          .map((t) => t.trim())
          .filter(Boolean),
        options: normalizedOptions,
      });
      clearForm();
      clearOptions();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={product ? "编辑商品与拆分规格" : "新建商品"}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          <DraftNotice
            restored={restoredForm}
            onReset={() => {
              resetForm();
              resetOptions();
            }}
          />
          <div className="form-grid">
            <Field label="所属商户">
              <select
                required
                value={form.merchantId}
                disabled={!!merchantId || !!product}
                onChange={(e) => change("merchantId", e.target.value)}
              >
                <option value="">请选择</option>
                {merchants
                  .filter(
                    (m) => m.status === "approved" || m.id === form.merchantId,
                  )
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="商品名称">
              <input
                required
                maxLength={100}
                value={form.name}
                onChange={(e) => change("name", e.target.value)}
              />
            </Field>
            <Field label="商品副标题">
              <input
                value={form.subtitle}
                onChange={(e) => change("subtitle", e.target.value)}
              />
            </Field>
            <Field label="原装规格">
              <input
                required
                value={form.originalSpecs}
                onChange={(e) => change("originalSpecs", e.target.value)}
                placeholder="例如：16片 / 1.2kg"
              />
            </Field>
            <Field label="整件原价（元）">
              <input
                required
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                value={form.originalPrice}
                onChange={(e) => change("originalPrice", e.target.value)}
              />
            </Field>
            <Field
              label="可售整包库存"
              help={
                product
                  ? "已有商品请在列表中使用「库存盘点」记录调整原因。"
                  : "整包装数量，拆分份额由服务端换算占用。"
              }
            >
              <input
                required
                type="number"
                min="0"
                max="1000000"
                step="1"
                disabled={!!product}
                value={form.stock}
                onChange={(e) => change("stock", e.target.value)}
              />
            </Field>
            <Field label="分类标识">
              <input
                required
                value={form.categoryId}
                onChange={(e) => change("categoryId", e.target.value)}
              />
            </Field>
            <Field label="标签（逗号分隔）">
              <input
                value={form.tags}
                onChange={(e) => change("tags", e.target.value)}
                placeholder="人气推荐，冷藏"
              />
            </Field>
            <Field label="商品插画类型">
              <select
                value={form.iconType}
                onChange={(e) => change("iconType", e.target.value)}
              >
                {["bakery", "meat", "drink", "snack", "grocery", "fresh"].map(
                  (v, i) => (
                    <option key={v} value={v}>
                      {["烘焙", "肉类", "饮品", "零食", "日用", "生鲜"][i]}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <Field label="商品主题色">
              <input
                type="color"
                value={form.accentColor}
                onChange={(e) => change("accentColor", e.target.value)}
              />
            </Field>
            <div className="actions span-two">
              <label className="check">
                <input
                  type="checkbox"
                  checked={form.canSplit}
                  onChange={(e) => change("canSplit", e.target.checked)}
                />
                允许拆分拼单
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={form.requiresColdChain}
                  onChange={(e) =>
                    change("requiresColdChain", e.target.checked)
                  }
                />
                需要冷链包装
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => change("active", e.target.checked)}
                />
                上架销售
              </label>
            </div>
          </div>
          <hr className="section-divider" />
          <div className="card-title">
            <h3>购买规格</h3>
            <button
              type="button"
              className="button small secondary"
              onClick={() =>
                setOptions((current) => [
                  ...current,
                  {
                    id: `opt_${crypto.randomUUID().slice(0, 8)}`,
                    name: "",
                    ratio: 0.5,
                    slots: 2,
                    weightEstimate: "",
                    priceCents: 0,
                    priceInput: "",
                    description: "",
                  },
                ])
              }
            >
              ＋ 添加规格
            </button>
          </div>
          <p className="muted">
            比例为占整件的份额，例如半份填 0.5；整件规格填 1，成团份数填
            1。售价为每份实付商品价。
          </p>
          {options.map((option, index) => (
            <div className="subtle-panel" key={option.id}>
              <div className="split-row split-labels">
                <span>规格名称</span>
                <span>每份售价 / 元</span>
                <span>拆分比例</span>
                <span>成团份数</span>
                <span />
              </div>
              <div className="split-row">
                <input
                  required
                  aria-label={`规格${index + 1}名称`}
                  value={option.name}
                  onChange={(e) => changeOption(index, "name", e.target.value)}
                  placeholder="例如：半盒"
                />
                <input
                  required
                  aria-label={`规格${index + 1}售价`}
                  type="number"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  value={option.priceInput ?? String(option.priceCents / 100)}
                  onChange={(e) =>
                    changeOption(index, "priceInput", e.target.value)
                  }
                />
                <input
                  required
                  aria-label={`规格${index + 1}比例`}
                  type="number"
                  min="0.001"
                  max="1"
                  step="any"
                  value={option.ratio}
                  onChange={(e) =>
                    changeOption(index, "ratio", Number(e.target.value))
                  }
                />
                <input
                  required
                  aria-label={`规格${index + 1}成团份数`}
                  type="number"
                  min="1"
                  max="20"
                  step="1"
                  value={option.slots}
                  onChange={(e) =>
                    changeOption(index, "slots", Number(e.target.value))
                  }
                />
                <button
                  type="button"
                  className="close"
                  aria-label={`删除规格${index + 1}`}
                  onClick={() =>
                    setOptions((current) =>
                      current.filter((_, i) => i !== index),
                    )
                  }
                >
                  ×
                </button>
              </div>
              <div className="form-grid">
                <Field label="预计重量">
                  <input
                    value={option.weightEstimate}
                    onChange={(e) =>
                      changeOption(index, "weightEstimate", e.target.value)
                    }
                    placeholder="约600g"
                  />
                </Field>
                <Field label="规格说明">
                  <input
                    value={option.description}
                    onChange={(e) =>
                      changeOption(index, "description", e.target.value)
                    }
                  />
                </Field>
              </div>
            </div>
          ))}
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="button secondary" onClick={onClose}>
            取消
          </button>
          <button className="button" disabled={busy}>
            {busy ? "保存中…" : "保存商品"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function localDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}
function BatchEditor({
  batch,
  merchants,
  merchantId,
  onClose,
  onSave,
}: {
  batch?: Batch;
  merchants: Merchant[];
  merchantId?: string;
  onClose: () => void;
  onSave: (body: unknown) => Promise<void>;
}) {
  const [form, setForm, clearDraft, resetDraft, restoredDraft] = useDraftState(
    `batch-${batch?.id || "new"}`,
    {
      merchantId:
        batch?.merchantId ||
        merchantId ||
        merchants.find((m) => m.status === "approved")?.id ||
        "",
      title: batch?.title || "",
      storeName: batch?.storeName || "烟台山姆会员店",
      cutoffAt: localDate(batch?.cutoffAt),
      pickupStartAt: localDate(batch?.pickupStartAt),
      pickupEndAt: localDate(batch?.pickupEndAt),
      status: batch?.status || "open",
      shopperName: batch?.shopperName || "",
      shopperPhone: batch?.shopperPhone || "",
      note: batch?.note || "",
    },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!form.merchantId) throw new Error("请选择所属商户。");
      if (
        new Date(form.pickupEndAt).getTime() <=
        new Date(form.pickupStartAt).getTime()
      )
        throw new Error("自提结束时间应晚于开始时间。");
      if (
        new Date(form.pickupStartAt).getTime() <
        new Date(form.cutoffAt).getTime()
      )
        throw new Error("自提开始时间应在截单之后。");
      await onSave({
        ...form,
        cutoffAt: new Date(form.cutoffAt).toISOString(),
        pickupStartAt: new Date(form.pickupStartAt).toISOString(),
        pickupEndAt: new Date(form.pickupEndAt).toISOString(),
      });
      clearDraft();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={batch ? "编辑采购批次" : "新建采购批次"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <DraftNotice restored={restoredDraft} onReset={resetDraft} />
          <div className="form-grid">
            <Field label="所属商户">
              <select
                required
                disabled={!!merchantId || !!batch}
                value={form.merchantId}
                onChange={(e) => change("merchantId", e.target.value)}
              >
                <option value="">请选择</option>
                {merchants
                  .filter(
                    (m) => m.status === "approved" || m.id === form.merchantId,
                  )
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="批次名称">
              <input
                required
                value={form.title}
                onChange={(e) => change("title", e.target.value)}
                placeholder="例如：周五烟台山姆专场"
              />
            </Field>
            <Field label="采购门店">
              <input
                required
                value={form.storeName}
                onChange={(e) => change("storeName", e.target.value)}
              />
            </Field>
            <Field
              label="批次状态"
              help="截单及退款请使用批次列表中的「截单」操作。"
            >
              <select
                disabled={
                  !batch ||
                  !batch.closedAt ||
                  ["completed", "cancelled"].includes(batch.status)
                }
                value={form.status}
                onChange={(e) => change("status", e.target.value)}
              >
                {(batch
                  ? (
                      {
                        open: ["open"],
                        purchasing: ["purchasing", "portioning"],
                        portioning: ["portioning", "ready_for_pickup"],
                        ready_for_pickup: ["ready_for_pickup", "completed"],
                        completed: ["completed"],
                        cancelled: ["cancelled"],
                      } as Record<string, string[]>
                    )[batch.status] || [batch.status]
                  : ["open"]
                ).map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="截单时间（本机时区）">
              <input
                required
                type="datetime-local"
                value={form.cutoffAt}
                onChange={(e) => change("cutoffAt", e.target.value)}
              />
            </Field>
            <Field label="自提开始时间">
              <input
                required
                type="datetime-local"
                value={form.pickupStartAt}
                onChange={(e) => change("pickupStartAt", e.target.value)}
              />
            </Field>
            <Field label="自提结束时间">
              <input
                required
                type="datetime-local"
                value={form.pickupEndAt}
                onChange={(e) => change("pickupEndAt", e.target.value)}
              />
            </Field>
            <Field label="采购负责人">
              <input
                value={form.shopperName}
                onChange={(e) => change("shopperName", e.target.value)}
              />
            </Field>
            <Field label="负责人电话">
              <input
                type="tel"
                value={form.shopperPhone}
                onChange={(e) => change("shopperPhone", e.target.value)}
              />
            </Field>
            <Field label="批次说明" className="span-two">
              <textarea
                rows={3}
                value={form.note}
                onChange={(e) => change("note", e.target.value)}
              />
            </Field>
          </div>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="button secondary" onClick={onClose}>
            取消
          </button>
          <button className="button" disabled={busy}>
            {busy ? "保存中…" : "保存批次"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function MerchantApply({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (body: unknown) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: "",
    contactName: "",
    contactPhone: "",
    city: "烟台",
    description: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(form);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="录入商户入驻申请" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <Notice>提交后进入待审核状态，由平台运营审核通过后开放经营。</Notice>
          <div className="form-grid">
            {[
              ["name", "商户名称"],
              ["contactName", "联系人"],
              ["contactPhone", "联系电话"],
            ].map(([key, title]) => (
              <Field key={key} label={title}>
                <input
                  required
                  value={form[key as keyof typeof form]}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      [key]: e.target.value,
                    }))
                  }
                />
              </Field>
            ))}
            <Field label="服务城市">
              <input value="烟台" readOnly />
            </Field>
            <Field label="经营说明" className="span-two">
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    description: e.target.value,
                  }))
                }
              />
            </Field>
          </div>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="button secondary" onClick={onClose}>
            取消
          </button>
          <button className="button" disabled={busy}>
            {busy ? "提交中…" : "提交申请"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function parseUrls(value: string) {
  const urls = value
    .split(/[\n，,]/)
    .map((v) => v.trim())
    .filter(Boolean);
  for (const item of urls) {
    let url: URL;
    try {
      url = new URL(item);
    } catch {
      throw new Error("凭证链接必须为完整的 https 地址。");
    }
    if (url.protocol !== "https:") throw new Error("凭证链接仅支持 https。");
  }
  return urls;
}
function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
function OrderDetail({
  order,
  merchantName,
  batchName,
  onClose,
  onAction,
  api,
  mediaBase,
  token,
  onReload,
}: {
  order: Order;
  merchantName: string;
  batchName: string;
  onClose: () => void;
  onAction: (action: string, body: unknown, message: string) => Promise<void>;
  api: import("./ui").Api;
  mediaBase: string;
  token: string;
  onReload: () => Promise<void>;
}) {
  const [section, setSection] = useState<"progress" | "weight" | "verify">(
    "progress",
  );
  const [nextStatus, setNextStatus] = useState(nextOrderStatus(order));
  const [note, setNote] = useDraftState(`progress-note-${order.id}`, "");
  const [photos, setPhotos] = useDraftState(`progress-photos-${order.id}`, "");
  const [receipts, setReceipts] = useDraftState(
    `progress-receipts-${order.id}`,
    "",
  );
  const draftScope = useContext(DraftScope);
  const [actualGoods, setActualGoods] = useDraftState(
    `weight-goods-${order.id}`,
    String(
      (order.finalPricing?.subtotalCents ?? order.pricing?.subtotalCents ?? 0) /
        100,
    ),
  );
  const [adjustmentNote, setAdjustmentNote] = useDraftState(
    `weight-note-${order.id}`,
    "",
  );

  const [pickupCode, setPickupCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  useEffect(() => {
    setNextStatus(nextOrderStatus(order));
  }, [order.status]);
  const pricing = order.finalPricing || orderPricing(order);
  const progress = order.progress || order.timeline || [];
  const weightUnavailable = [
    "unpaid",
    "cancelled",
    "refunded",
    "completed",
    "ready_for_pickup",
    "delivering",
  ].includes(order.status);
  const unavailable = ["unpaid", "cancelled", "refunded", "completed"].includes(
    order.status,
  );
  const actions = async (
    event: FormEvent,
    action: string,
    body: () => unknown,
    message: string,
  ) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setDone("");
    try {
      await onAction(action, body(), message);
      setDone(message);
      if (action === "weight-adjustment") {
        setActualGoods("");
        setAdjustmentNote("");
      }
      if (action === "verify-pickup") setPickupCode("");
      if (action === "progress" || action === "attachments") {
        setNote("");
        setPhotos("");
        setReceipts("");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={`订单详情 · ${order.id}`} onClose={onClose} wide>
      <div className="modal-body">
        <div className="card-title">
          <div className="actions">
            <Badge value={order.status} />
            {order.financialStatus && <Badge value={order.financialStatus} />}
          </div>
          <span className="muted">下单时间 {date(order.createdAt)}</span>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>所属商户</dt>
            <dd>{merchantName}</dd>
          </div>
          <div>
            <dt>采购批次</dt>
            <dd>{batchName}</dd>
          </div>
          <div>
            <dt>履约方式</dt>
            <dd>{label(order.fulfillment)}</dd>
          </div>
          <div>
            <dt>收货人</dt>
            <dd>
              {order.recipientName || "—"} · {order.recipientPhone || "—"}
            </dd>
          </div>
          <div>
            <dt>顾客 ID</dt>
            <dd className="mono">{order.customerId || order.userId || "—"}</dd>
          </div>
          <div>
            <dt>
              {order.fulfillment === "delivery" ? "配送地址" : "自提站点"}
            </dt>
            <dd>
              {order.address ||
                order.communitySnapshot?.station ||
                order.communityId ||
                "—"}
            </dd>
          </div>
          {order.notes && (
            <div className="span-two">
              <dt>顾客备注</dt>
              <dd>{order.notes}</dd>
            </div>
          )}
        </dl>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>商品</th>
                <th>购买规格</th>
                <th>单价</th>
                <th>份数</th>
                <th>金额</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={`${item.productId}-${index}`}>
                  <td className="name">
                    {item.name || item.productName || item.productId}
                    {item.state === "refunded" && (
                      <small className="danger-text">未成团已退款</small>
                    )}
                  </td>
                  <td>
                    {item.optionName || item.optionId || "—"}
                    {item.groupId && <small>拼团 {item.groupId}</small>}
                  </td>
                  <td>{money(item.unitPriceCents ?? item.priceCents)}</td>
                  <td>
                    有效{" "}
                    {item.state === "refunded"
                      ? 0
                      : Math.max(
                          0,
                          item.quantity - (item.cancelledQuantity || 0),
                        )}{" "}
                    份
                    <small>
                      原单 {item.quantity} 份 · 已取消{" "}
                      {item.cancelledQuantity || 0} 份
                    </small>
                  </td>
                  <td>
                    {money(
                      item.state === "refunded"
                        ? 0
                        : (item.settlementGoodsCents ??
                            (item.unitPriceCents ?? item.priceCents ?? 0) *
                              Math.max(
                                0,
                                item.quantity - (item.cancelledQuantity || 0),
                              )),
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid-two" style={{ marginTop: 20 }}>
          <div className="subtle-panel">
            <div className="money-row">
              <span>商品金额</span>
              <span>
                {money(
                  pricing.subtotalCents ??
                    pricing.goodsCents ??
                    pricing.itemsSubtotalCents,
                )}
              </span>
            </div>
            <div className="money-row">
              <span>代购服务费</span>
              <span>{money(pricing.proxyFeeCents)}</span>
            </div>
            <div className="money-row">
              <span>冷链包装费</span>
              <span>{money(pricing.packagingFeeCents)}</span>
            </div>
            <div className="money-row">
              <span>配送费</span>
              <span>{money(pricing.deliveryFeeCents)}</span>
            </div>
            {!!order.afterSalesCreditCents && (
              <div className="money-row">
                <span>售后协商抵减</span>
                <span>−{money(order.afterSalesCreditCents)}</span>
              </div>
            )}
            <div className="money-row total">
              <span>当前订单应付</span>
              <span>
                {money(
                  Math.max(
                    0,
                    (pricing.totalCents ?? pricing.totalPayableCents ?? 0) -
                      (order.afterSalesCreditCents || 0),
                  ),
                )}
              </span>
            </div>
          </div>
          <div className="subtle-panel">
            <div className="money-row">
              <span>已支付</span>
              <span>{money(order.paidCents)}</span>
            </div>
            <div className="money-row">
              <span>已退款至余额</span>
              <span>{money(order.refundedCents)}</span>
            </div>
            <div className="money-row total">
              <span>待补款</span>
              <span className={order.topupCents ? "danger-text" : ""}>
                {money(order.topupCents)}
              </span>
            </div>
            <p className="muted">
              称重差额及服务费变化由服务端计算。补款完成后方可交付。
            </p>
          </div>
        </div>
        <MediaPanel
          orderId={order.id}
          api={api}
          baseUrl={mediaBase}
          token={token}
        />
        <OrderOperations order={order} api={api} onSaved={onReload} />
        {!!(order.photoUrls?.length || order.receiptUrls?.length) && (
          <>
            <h3>采购照片与原始小票</h3>
            <div className="receipt-links">
              {[
                ...(order.receiptUrls || []).map((url, i) => ({
                  url,
                  title: `原始小票 ${i + 1}`,
                })),
                ...(order.photoUrls || []).map((url, i) => ({
                  url,
                  title: `采购照片 ${i + 1}`,
                })),
              ]
                .filter((v) => safeUrl(v.url))
                .map((v, i) => (
                  <a
                    key={i}
                    href={safeUrl(v.url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {v.title} ↗
                  </a>
                ))}
            </div>
          </>
        )}
        <hr className="section-divider" />
        <div className="role-tabs three">
          <button
            className={section === "progress" ? "active" : ""}
            onClick={() => setSection("progress")}
          >
            采购进度 / 凭证
          </button>
          <button
            className={section === "weight" ? "active" : ""}
            onClick={() => setSection("weight")}
          >
            称重多退少补
          </button>
          <button
            className={section === "verify" ? "active" : ""}
            onClick={() => setSection("verify")}
          >
            提货码核销
          </button>
        </div>
        {error && <Notice type="error">{error}</Notice>}
        {done && <Notice type="success">{done}</Notice>}
        {unavailable && (
          <Notice>当前订单{label(order.status)}，履约操作不可用。</Notice>
        )}
        {section === "progress" && (
          <form
            onSubmit={(event) =>
              void actions(
                event,
                "progress",
                () => ({
                  status: nextStatus,
                  note: note.trim(),
                  photoUrls: parseUrls(photos),
                  receiptUrls: parseUrls(receipts),
                }),
                "采购进度及凭证已更新。",
              )
            }
          >
            <div className="form-grid">
              <Field
                label="更新订单状态"
                help="自提订单请在「提货码核销」中完成交付。"
              >
                <select
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value)}
                >
                  {nextOrderStatus(order) ? (
                    <option value={nextOrderStatus(order)}>
                      {label(nextOrderStatus(order))}
                    </option>
                  ) : (
                    <option value="">当前无需推进状态</option>
                  )}
                </select>
              </Field>
              <Field label="给顾客的进度说明">
                <input
                  required
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="例如：已到店，正在挑选商品"
                />
              </Field>
              <Field label="真实采购照片 URL" help="每行一个已上传的图片地址。">
                <textarea
                  rows={3}
                  value={photos}
                  onChange={(e) => setPhotos(e.target.value)}
                  placeholder="https://…"
                />
              </Field>
              <Field
                label="真实小票 URL"
                help="录入真实凭证地址，顾客可在订单中查看。"
              >
                <textarea
                  rows={3}
                  value={receipts}
                  onChange={(e) => setReceipts(e.target.value)}
                  placeholder="https://…"
                />
              </Field>
            </div>
            <div className="actions" style={{ marginTop: 16 }}>
              <button
                className="button"
                disabled={busy || unavailable || !nextOrderStatus(order)}
              >
                {busy ? "保存中…" : "推进状态并保存凭证"}
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={busy || (!photos.trim() && !receipts.trim())}
                onClick={(event) =>
                  void actions(
                    event as unknown as FormEvent,
                    "attachments",
                    () => ({
                      photoUrls: [
                        ...new Set([
                          ...(order.photoUrls || []),
                          ...parseUrls(photos),
                        ]),
                      ],
                      receiptUrls: [
                        ...new Set([
                          ...(order.receiptUrls || []),
                          ...parseUrls(receipts),
                        ]),
                      ],
                    }),
                    "原始小票与采购照片已补充。",
                  )
                }
              >
                仅补充凭证
              </button>
            </div>
          </form>
        )}
        {section === "weight" && (
          <form
            onSubmit={(event) =>
              void actions(
                event,
                "weight-adjustment",
                () => {
                  if (!adjustmentNote.trim())
                    throw new Error("请填写差价说明。");
                  return {
                    adjustmentId: operationId(
                      draftScope,
                      `${order.id}-weight-adjustment`,
                      {
                        actualGoodsCents: cents(actualGoods),
                        note: adjustmentNote.trim(),
                      },
                    ),
                    actualGoodsCents: cents(actualGoods),
                    note: adjustmentNote.trim(),
                  };
                },
                "称重结算已更新，退款或待补款以服务端结果为准。",
              )
            }
          >
            <Notice>
              仅交付前可称重结算，商品总额必须大于0；全部缺货请按商品取消。填写整张订单本次最终商品金额（已退款商品不计入）。差额由服务端重新计算，多收部分退入顾客余额，少收部分形成待补款。
            </Notice>
            <div className="form-grid">
              <Field label="实际商品总额（元）">
                <input
                  required
                  type="number"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  value={actualGoods}
                  onChange={(e) => setActualGoods(e.target.value)}
                />
              </Field>
              <Field label="差价说明">
                <input
                  required
                  value={adjustmentNote}
                  onChange={(e) => setAdjustmentNote(e.target.value)}
                  placeholder="例如：牛肉实际称重 1.12kg，以小票为准"
                />
              </Field>
            </div>
            <div className="actions" style={{ marginTop: 16 }}>
              <button className="button" disabled={busy || weightUnavailable}>
                {busy ? "处理中…" : "提交称重结算"}
              </button>
            </div>
            {!!order.weightAdjustments?.length && (
              <div style={{ marginTop: 20 }}>
                <h3>称重结算记录</h3>
                {order.weightAdjustments.map((a) => (
                  <div className="record" key={a.adjustmentId}>
                    <div>
                      {a.note}
                      <p>{date(a.at)}</p>
                    </div>
                    <span>
                      {money(a.actualGoodsCents)}
                      <small className="muted">
                        　差额 {money(a.deltaCents)}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </form>
        )}
        {section === "verify" && (
          <form
            onSubmit={(event) =>
              void actions(
                event,
                "verify-pickup",
                () => ({ pickupCode: pickupCode.trim() }),
                "提货已核销，订单已完成。",
              )
            }
          >
            <Notice>
              请向顾客核对提货码，确认已交付实物后核销。存在未补差价时服务端会拒绝核销。
            </Notice>
            {order.fulfillment !== "pickup" ? (
              <p className="muted">
                这是送货到家订单，请通过采购进度更新配送及完成状态。
              </p>
            ) : (
              <div className="actions">
                <Field label="顾客出示的提货码">
                  <input
                    required
                    value={pickupCode}
                    onChange={(e) => setPickupCode(e.target.value)}
                    placeholder="输入提货码"
                    autoComplete="off"
                  />
                </Field>
                <button
                  className="button"
                  style={{ alignSelf: "end" }}
                  disabled={
                    busy || unavailable || order.status !== "ready_for_pickup"
                  }
                >
                  {busy ? "核销中…" : "确认交付并核销"}
                </button>
              </div>
            )}
          </form>
        )}
        <hr className="section-divider" />
        <h3>履约记录</h3>
        {progress.length ? (
          <div className="progress-steps">
            {[...progress].reverse().map((entry, index) => (
              <div className="progress-step" key={index}>
                <strong>
                  {label(entry.status)} · {entry.note || "状态已更新"}
                </strong>
                <p>{date(entry.at || entry.createdAt)}</p>
                <div className="receipt-links">
                  {[...(entry.photoUrls || []), ...(entry.receiptUrls || [])]
                    .filter((url) => safeUrl(url))
                    .map((url, i) => (
                      <a
                        key={i}
                        href={safeUrl(url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        凭证 {i + 1} ↗
                      </a>
                    ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">暂无履约记录。</p>
        )}
      </div>
      <div className="modal-foot">
        <button className="button secondary" onClick={onClose}>
          关闭详情
        </button>
      </div>
    </Modal>
  );
}
function WalletPanel({
  api,
  customerIds,
}: {
  api: <T>(path: string, method?: string, body?: unknown) => Promise<T>;
  customerIds: string[];
}) {
  const [customerId, setCustomerId] = useState(customerIds[0] || "");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [queriedId, setQueriedId] = useState("");
  const query = async (event: FormEvent) => {
    event.preventDefault();
    if (!customerId.trim()) return;
    setBusy(true);
    setError("");
    setWallet(null);
    try {
      const result = await api<Wallet>(
        `/admin/wallet?customerId=${encodeURIComponent(customerId.trim())}`,
      );
      setWallet(result);
      setQueriedId(customerId.trim());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <section className="card">
        <form className="filters" onSubmit={query}>
          <input
            required
            aria-label="顾客 ID"
            list="customer-ids"
            placeholder="输入顾客 ID，或从订单顾客中选择"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          />
          <datalist id="customer-ids">
            {customerIds.map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
          <button className="button" disabled={busy}>
            {busy ? "查询中…" : "查询余额与流水"}
          </button>
        </form>
        <p className="muted">
          可在订单详情查看顾客 ID。完整钱包流水仅限平台运营查询。
        </p>
        {error && <Notice type="error">{error}</Notice>}
      </section>
      {wallet && (
        <>
          <div className="cards">
            <Stat
              label="顾客当前余额"
              value={money(wallet.balanceCents)}
              hint={queriedId}
            />
            <Stat
              label="流水条数"
              value={wallet.entries.length}
              hint="包含退款入账与余额支付"
            />
          </div>
          <section className="card">
            <h2>资金流水</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>时间 / 流水号</th>
                    <th>类型</th>
                    <th>金额</th>
                    <th>变动后余额</th>
                    <th>关联订单</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {wallet.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        {date(entry.createdAt)}
                        <small className="mono">{entry.id}</small>
                      </td>
                      <td>
                        <Badge value={entry.kind || entry.type} />
                      </td>
                      <td
                        className={
                          entry.amountCents > 0 ? "success-text" : "danger-text"
                        }
                      >
                        {entry.amountCents > 0 ? "+" : ""}
                        {money(entry.amountCents)}
                      </td>
                      <td>
                        {money(entry.balanceAfterCents ?? entry.balanceCents)}
                      </td>
                      <td className="mono">{entry.orderId || "—"}</td>
                      <td>{entry.note || entry.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!wallet.entries.length && (
                <Empty
                  title="暂无资金流水"
                  hint="退款入账或余额支付后将显示记录。"
                />
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}

interface PickingData {
  batch: Batch;
  orderCount: number;
  items: {
    productId: string;
    name: string;
    optionId: string;
    optionName: string;
    quantity: number;
  }[];
  groups: {
    id: string;
    productName: string;
    slotDescription: string;
    paidSlots: number;
    totalSlots: number;
    status: string;
  }[];
}
function PickingList({
  batchId,
  api,
  onClose,
}: {
  batchId: string;
  api: <T>(path: string, method?: string, body?: unknown) => Promise<T>;
  onClose: () => void;
}) {
  const [data, setData] = useState<PickingData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<PickingData>(`/admin/batches/${batchId}/picking-list`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      });
    return () => {
      active = false;
    };
  }, [batchId]);
  return (
    <Modal title="批次采购汇总清单" onClose={onClose} wide>
      <div className="modal-body">
        {error && <Notice type="error">{error}</Notice>}
        {!data && !error && <div className="loading">读取采购清单…</div>}
        {data && (
          <>
            <div className="card-title">
              <div>
                <h2>{data.batch.title}</h2>
                <p className="muted">
                  {data.batch.storeName} · {data.orderCount} 笔已支付有效订单
                </p>
              </div>
              <Badge value={data.batch.status} />
            </div>
            {!data.batch.closedAt && (
              <Notice>
                本批次尚未截单，汇总会随支付变化。请先截单处理未成团份额后，按最终清单采购。
              </Notice>
            )}
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>商品</th>
                    <th>购买 / 拆分规格</th>
                    <th>需备份数</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={`${item.productId}-${item.optionId}`}>
                      <td className="name">{item.name}</td>
                      <td>{item.optionName}</td>
                      <td>
                        <strong>{item.quantity}</strong> 份
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.items.length && (
                <Empty
                  title="暂无需要采购的商品"
                  hint="未支付或已退款商品不计入采购汇总。"
                />
              )}
            </div>
            <hr className="section-divider" />
            <h3>拼团份额核对</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>商品 / 拼团</th>
                    <th>规格</th>
                    <th>已支付份数</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {data.groups.map((g) => (
                    <tr key={g.id}>
                      <td className="name">
                        {g.productName}
                        <small className="mono">{g.id}</small>
                      </td>
                      <td>{g.slotDescription}</td>
                      <td>
                        {g.paidSlots} / {g.totalSlots}
                      </td>
                      <td>
                        <Badge value={g.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.groups.length && (
                <Empty
                  title="本批次暂无拼团"
                  hint="整件订单直接计入采购清单。"
                />
              )}
            </div>
          </>
        )}
      </div>
      <div className="modal-foot">
        <button className="button secondary" onClick={onClose}>
          关闭清单
        </button>
      </div>
    </Modal>
  );
}
function ConfirmAction({
  title,
  detail,
  reason = false,
  onConfirm,
  onClose,
}: {
  title: string;
  detail: string;
  reason?: boolean;
  onConfirm: (value: string) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onConfirm(text.trim());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <p style={{ fontSize: 14, lineHeight: 1.9 }}>{detail}</p>
          {reason && (
            <Field label="拒绝原因">
              <textarea
                required
                rows={3}
                maxLength={500}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </Field>
          )}
          {error && <p className="inline-error">{error}</p>}
        </div>
        <div className="modal-foot">
          <button type="button" className="button secondary" onClick={onClose}>
            取消
          </button>
          <button className="button" disabled={busy}>
            {busy ? "处理中…" : "确认执行"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
