import { useEffect, useState } from "react";
import { date } from "./api";
import { Empty, Notice } from "./ui";
import type { Api } from "./ui";

interface TestUser {
  id: string;
  nickname: string;
  enabled: boolean;
  registeredAt?: string;
  updatedAt?: string;
}

export function UatNotice() {
  return (
    <Notice>
      <strong>线上测试环境 · 虚拟资金</strong>
      <span>付款、退款和钱包流水均为测试记录。</span>
    </Notice>
  );
}

export function TestUsersPanel({ api }: { api: Api }) {
  const [users, setUsers] = useState<TestUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setUsers(await api<TestUser[]>("/admin/test-users"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法加载测试用户。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const update = async (user: TestUser) => {
    setUpdating(user.id);
    setError("");
    setMessage("");
    try {
      const saved = await api<TestUser>(
        `/admin/test-users/${encodeURIComponent(user.id)}`,
        "POST",
        { enabled: !user.enabled },
      );
      setUsers((current) =>
        current.map((row) => (row.id === saved.id ? saved : row)),
      );
      setMessage(
        saved.enabled ? "已批准虚拟付款资格。" : "已撤销虚拟付款资格。",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "审批失败，请重试。");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <section className="card">
      <div className="card-title">
        <h2>已登录的微信顾客</h2>
        <button
          type="button"
          className="button secondary"
          disabled={loading || updating !== null}
          onClick={() => void refresh()}
        >
          {loading ? "刷新中…" : "刷新名单"}
        </button>
      </div>
      <p className="muted">
        顾客首次用微信登录测试版后会出现在这里。批准只开放测试库内的虚拟付款资格。
      </p>
      {error && <Notice type="error">{error}</Notice>}
      {message && <Notice type="success">{message}</Notice>}
      <div className="table-wrap">
        <table
          className="table"
          aria-label="测试用户审批名单"
          aria-busy={loading || updating !== null}
        >
          <thead>
            <tr>
              <th>顾客</th>
              <th>注册时间</th>
              <th>资格更新时间</th>
              <th>虚拟付款资格</th>
              <th>审批</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  {user.nickname || "微信顾客"}
                  <small>{user.id}</small>
                </td>
                <td>{date(user.registeredAt)}</td>
                <td>{date(user.updatedAt)}</td>
                <td>
                  <span
                    className={`badge ${user.enabled ? "green" : "orange"}`}
                  >
                    {user.enabled
                      ? "已批准"
                      : user.updatedAt
                        ? "已撤销"
                        : "待审批"}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className={`button small${user.enabled ? " secondary" : ""}`}
                    disabled={loading || updating !== null}
                    onClick={() => void update(user)}
                  >
                    {updating === user.id
                      ? "保存中…"
                      : user.enabled
                        ? "撤销资格"
                        : "批准测试"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !error && !users.length && (
          <Empty
            title="暂无测试顾客"
            hint="请让顾客先在测试版完成一次微信登录。"
          />
        )}
      </div>
    </section>
  );
}
