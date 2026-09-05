"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type Account = { authenticated: boolean; email?: string; emailVerified?: boolean; authProvider?: string; authConfig?: { emailVerificationEnabled: boolean; emailDeliveryEnabled: boolean } };

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [messengerLink, setMessengerLink] = useState("");

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
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось выполнить запрос");
      if (mode === "forgot") setMessage("Если аккаунт существует, письмо со ссылкой отправлено.");
      else if (mode === "reset") { setMessage("Пароль изменён. Теперь войдите снова."); setMode("login"); setPassword(""); }
      else location.href = "/";
    } catch (error) { setMessage(error instanceof Error ? error.message : "Произошла ошибка"); }
    finally { setBusy(false); }
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); location.href = "/"; }
  async function loginTelegram() {
    setBusy(true); setMessage(""); setMessengerLink("");
    try {
      const startResponse = await fetch("/api/auth/external/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ platform: "telegram" }) });
      const started = await startResponse.json() as { code?: string; deep_link?: string; error?: string };
      if (!startResponse.ok || !started.code || !started.deep_link) throw new Error(started.error || "Не удалось начать вход через Telegram");
      setMessengerLink(started.deep_link); window.open(started.deep_link, "_blank", "noopener,noreferrer");
      const deadline = Date.now() + 600000;
      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 2500));
        const statusResponse = await fetch(`/api/auth/external/status?code=${encodeURIComponent(started.code)}&platform_name=telegram`, { cache: "no-store" });
        const status = await statusResponse.json() as { status?: string; token?: string };
        if (status.status === "expired") throw new Error("Код истёк. Начните вход заново.");
        if (status.status === "confirmed" && status.token) {
          const complete = await fetch("/api/auth/external/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: status.token }) });
          if (!complete.ok) throw new Error("Не удалось создать сессию HeroList");
          location.href = "/"; return;
        }
      }
      throw new Error("Время ожидания подтверждения истекло");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ошибка входа через Telegram"); }
    finally { setBusy(false); }
  }
  async function resendVerification() {
    const response = await fetch("/api/auth/resend-verification", { method: "POST" });
    const result = await response.json() as { error?: string };
    setMessage(response.ok ? "Письмо отправлено." : result.error || "Не удалось отправить письмо.");
  }

  return <main className="auth-shell modern-design">
    <Link className="auth-back" href="/">← Вернуться к персонажам</Link>
    <section className="auth-card">
      <p className="eyebrow">Лист Героя 5e · аккаунт</p>
      <h1>{account?.authenticated ? "Ваш аккаунт" : mode === "register" ? "Создать аккаунт" : mode === "forgot" ? "Забыли пароль?" : mode === "reset" ? "Новый пароль" : "Войти"}</h1>
      {account?.authenticated ? <div className="auth-profile">
        <p><b>Почта:</b> {account.email}</p>
        <p><b>Подтверждение:</b> {!account.authConfig?.emailVerificationEnabled ? "сейчас не требуется" : account.emailVerified ? "подтверждена" : "не подтверждена"}</p>
        <p>Персонажи объединяются с локальной коллекцией и синхронизируются между устройствами.</p>
        {account.authConfig?.emailVerificationEnabled && !account.emailVerified && <button onClick={resendVerification}>Отправить подтверждение повторно</button>}
        <button onClick={logout}>Выйти</button>
      </div> : <>
        <button type="button" className="primary-action" disabled={busy} onClick={loginTelegram}>Войти через Telegram</button>
        {messengerLink && <p><a href={messengerLink} target="_blank" rel="noopener noreferrer">Открыть Telegram и подтвердить вход</a></p>}
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
