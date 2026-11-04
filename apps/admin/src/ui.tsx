import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
export const DraftScope = createContext("anonymous");
export function useDraftState<T>(
  name: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>, () => void, () => void, boolean] {
  const scope = useContext(DraftScope),
    key = `wxsam.admin.draft.${encodeURIComponent(scope)}.${name}`;
  const baseline = useRef(initial);
  const [restored] = useState(() => {
    try {
      return !!sessionStorage.getItem(key);
    } catch {
      return false;
    }
  });
  const [state, setState] = useState<T>(() => {
    try {
      const item = JSON.parse(sessionStorage.getItem(key) || "null");
      if (item?.version !== 1) return initial;
      if (
        initial &&
        typeof initial === "object" &&
        !Array.isArray(initial) &&
        item.data &&
        typeof item.data === "object" &&
        !Array.isArray(item.data)
      )
        return { ...initial, ...item.data };
      return item.data;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      if (JSON.stringify(state) === JSON.stringify(baseline.current))
        sessionStorage.removeItem(key);
      else
        sessionStorage.setItem(
          key,
          JSON.stringify({ version: 1, data: state }),
        );
    } catch {
      /* The form remains usable when storage quota is unavailable. */
    }
  }, [key, state]);
  const clear = () => {
    try {
      sessionStorage.removeItem(key);
    } catch {}
  };
  return [
    state,
    setState,
    clear,
    () => {
      setState(baseline.current);
      clear();
    },
    restored,
  ];
}
export function operationId(scope: string, action: string, payload: unknown) {
  const key = `wxsam.admin.operation.${encodeURIComponent(scope)}.${action}`;
  const fingerprint = JSON.stringify(payload);
  try {
    const old = JSON.parse(sessionStorage.getItem(key) || "null");
    if (old?.fingerprint === fingerprint) return old.id;
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, JSON.stringify({ fingerprint, id }));
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
export function clearAccountDrafts(scope: string) {
  for (const key of Object.keys(sessionStorage)) {
    if (
      key.startsWith(`wxsam.admin.draft.${encodeURIComponent(scope)}.`) ||
      key.startsWith(`wxsam.admin.operation.${encodeURIComponent(scope)}.`)
    )
      sessionStorage.removeItem(key);
  }
}
export function Field({
  label,
  children,
  help,
  className = "",
}: {
  label: string;
  children: ReactNode;
  help?: string;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {help && <span className="help">{help}</span>}
    </label>
  );
}
export function Notice({
  children,
  type = "",
}: {
  children: ReactNode;
  type?: string;
}) {
  return (
    <div
      className={`notice ${type}`}
      role={type === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function Empty({
  title = "暂无数据",
  hint = "数据将从业务服务读取。",
}: {
  title?: string;
  hint?: string;
}) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {hint}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div className="modal-backdrop">
      <section
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button
            className="close"
            type="button"
            onClick={onClose}
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function DraftNotice({
  restored,
  onReset,
}: {
  restored: boolean;
  onReset: () => void;
}) {
  return (
    <div className="draft-note">
      {restored
        ? "已恢复本标签页的未提交草稿。"
        : "未提交输入会保留在本标签页，关闭弹窗后可继续。"}
      <button type="button" className="button link" onClick={onReset}>
        重置输入
      </button>
    </div>
  );
}
export function SubmitForm({
  children,
  onSubmit,
  label = "保存",
  onClose,
}: {
  children: ReactNode;
  onSubmit: () => Promise<void>;
  label?: string;
  onClose?: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit}>
      <div className="modal-body">
        {children}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="modal-foot">
        {onClose && (
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            关闭
          </button>
        )}
        <button className="button" disabled={busy}>
          {busy ? "处理中…" : label}
        </button>
      </div>
    </form>
  );
}
export type Api = <T>(
  path: string,
  method?: string,
  body?: unknown,
) => Promise<T>;
