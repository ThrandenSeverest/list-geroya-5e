"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type Account = { authenticated: boolean; email?: string; emailVerified?: boolean; authProvider?: string };

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetToken, setResetToken] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("reset_token") || "";
    queueMicrotask(() => {
      if (token) { setResetToken(token); setMode("reset"); }
      if (params.get("verified") === "success") setMessage("Почта подтверждена.");
      if (params.get("verified") === "invalid") setMessage("Ссылка подтверждения недействительна или устарела.");
    });
    fetch("/api/account", { cache: "no-store" }).then(response => response.json()).then(setAccount).catch(() => setAccount({ authenticated: false }));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const endpoint = mode === "register" ? "register" : mode === "forgot" ? "forgot-password" : mode === "reset" ? "reset-password" : "login";
    const body = mode === "forgot" ? { email } : mode === "reset" ? { token: resetToken, password } : { email, password };
    try {
      const response = await fetch(`/api/auth/${endpoint}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string; emailSent?: boolean };
      if (!response.ok) throw new Error(result.error || "Не удалось выполнить запрос");
      if (mode === "forgot") setMessage("Если аккаунт существует, письмо со ссылкой отправлено.");
      else if (mode === "reset") { setMessage("Пароль изменён. Теперь войдите снова."); setMode("login"); setPassword(""); }
      else { location.href = "/"; }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Произошла ошибка"); }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/";
  }

  return <main className="auth-shell">
    <Link className="auth-back" href="/">← Вернуться к персонажам</Link>
    <section className="auth-card">
      <p className="eyebrow">Лист Героя 5e · аккаунт</p>
      <h1>{account?.authenticated ? "Ваш аккаунт" : mode === "register" ? "Создать аккаунт" : mode === "forgot" ? "Забыли пароль?" : mode === "reset" ? "Новый пароль" : "Войти"}</h1>
      <div className="auth-hosting-warning"><b>Важно для chatgpt.site</b><span>Собственная авторизация по почте может не работать на домене chatgpt.site. Для полноценной работы используйте самостоятельный хостинг с базой данных и переменными окружения.</span></div>
      {account?.authenticated ? <div className="auth-profile"><p><b>Почта:</b> {account.email}</p><p><b>Подтверждение:</b> {account.emailVerified ? "подтверждена" : "ожидает подключения почтовой отправки"}</p><p>Персонажи синхронизируются с этим аккаунтом и доступны после входа с другого устройства.</p><button onClick={logout}>Выйти</button></div> : <>
        <form onSubmit={submit}>
          {mode !== "reset" && <label>Почта<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>}
          {mode !== "forgot" && <label>Пароль<input type="password" minLength={10} maxLength={128} autoComplete={mode === "register" ? "new-password" : "current-password"} required value={password} onChange={event => setPassword(event.target.value)} /><small>Не менее 10 символов. Пароль хранится только как защищённый хэш.</small></label>}
          <button className="primary-action" disabled={busy}>{busy ? "Подождите…" : mode === "register" ? "Зарегистрироваться" : mode === "forgot" ? "Отправить ссылку" : mode === "reset" ? "Сменить пароль" : "Войти"}</button>
        </form>
        <nav className="auth-switches">
          {mode !== "login" && <button onClick={() => setMode("login")}>Уже есть аккаунт</button>}
          {mode !== "register" && <button onClick={() => setMode("register")}>Создать аккаунт</button>}
          {mode !== "forgot" && <button onClick={() => setMode("forgot")}>Забыли пароль?</button>}
        </nav>
      </>}
      {message && <p className="auth-message">{message}</p>}
    </section>
  </main>;
}
