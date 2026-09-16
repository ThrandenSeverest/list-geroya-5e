"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type Account = { authenticated: boolean; legacyRecovery?: boolean; email?: string; emailVerified?: boolean; authProvider?: string; linkedProviders?: string[]; authConfig?: { emailVerificationEnabled: boolean; emailDeliveryEnabled: boolean; registrationEnabled?: boolean; loginEnabled?: boolean; legacyEmailRecoveryEnabled?: boolean } };

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset" | "legacy">("login");
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
    const endpoint = mode === "register" ? "register" : mode === "forgot" ? "forgot-password" : mode === "reset" ? "reset-password" : mode === "legacy" ? "legacy-recovery" : "login";
    const body = mode === "forgot" ? { email } : mode === "reset" ? { token: resetToken, password } : { email, password };
    try {
      const response = await fetch(`/api/auth/${endpoint}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось выполнить запрос");
      if (mode === "forgot") setMessage("Если аккаунт существует, письмо со ссылкой отправлено.");
      else if (mode === "reset") { setMessage("Пароль изменён. Теперь войдите снова."); setMode("login"); setPassword(""); }
      else if (mode === "legacy") location.reload();
      else location.href = "/";
    } catch (error) { setMessage(error instanceof Error ? error.message : "Произошла ошибка"); }
    finally { setBusy(false); }
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); location.href = "/"; }
  async function loginTelegram(linkExisting = false) {
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
          const complete = await fetch(linkExisting ? "/api/auth/external/link" : "/api/auth/external/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: status.token }) });
          const completed = await complete.json() as { error?: string };
          if (!complete.ok) throw new Error(completed.error || (linkExisting ? "Не удалось привязать Telegram" : "Не удалось создать сессию HeroList"));
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
      <h1>{account?.legacyRecovery ? "Перенос старого аккаунта" : account?.authenticated ? "Ваш аккаунт" : mode === "register" ? "Создать аккаунт" : mode === "forgot" ? "Забыли пароль?" : mode === "reset" ? "Новый пароль" : mode === "legacy" ? "Доступ к старому аккаунту" : "Войти"}</h1>
      {account?.legacyRecovery ? <div className="auth-profile">
        <p><b>Старый аккаунт:</b> {account.email}</p>
        <p>Обычная запись отключена. Сначала скачайте полную резервную копию, затем привяжите Telegram. Персонажи и хоумбрю останутся у того же аккаунта.</p>
        <a className="primary-action" href="/api/legacy/export" download>Скачать персонажей и хоумбрю</a>
        <button type="button" className="primary-action" disabled={busy} onClick={() => loginTelegram(true)}>Привязать Telegram и продолжить</button>
        {messengerLink && <p><a href={messengerLink} target="_blank" rel="noopener noreferrer">Открыть Telegram и подтвердить привязку</a></p>}
        <button onClick={logout}>Выйти</button>
      </div> : account?.authenticated ? <div className="auth-profile">
        <p><b>Почта:</b> {account.email}</p>
        <p><b>Подтверждение:</b> {!account.authConfig?.emailVerificationEnabled ? "сейчас не требуется" : account.emailVerified ? "подтверждена" : "не подтверждена"}</p>
        <p>Персонажи объединяются с локальной коллекцией и синхронизируются между устройствами.</p>
        {account.authProvider === "email" && !account.linkedProviders?.includes("telegram") && <button type="button" className="primary-action" disabled={busy} onClick={() => loginTelegram(true)}>Привязать Telegram без потери персонажей</button>}
        {account.linkedProviders?.includes("telegram") && <p><b>Telegram:</b> привязан. Через него открывается эта же коллекция персонажей.</p>}
        {messengerLink && <p><a href={messengerLink} target="_blank" rel="noopener noreferrer">Открыть Telegram и подтвердить привязку</a></p>}
        {account.authConfig?.emailVerificationEnabled && !account.emailVerified && <button onClick={resendVerification}>Отправить подтверждение повторно</button>}
        <button onClick={logout}>Выйти</button>
      </div> : <>
        <button type="button" className="primary-action" disabled={busy} onClick={() => loginTelegram(false)}>Войти через Telegram</button>
        {messengerLink && <p><a href={messengerLink} target="_blank" rel="noopener noreferrer">Открыть Telegram и подтвердить вход</a></p>}
        <form onSubmit={submit}>
          {mode !== "reset" && <label>Почта<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>}
          {mode !== "forgot" && <label>Пароль<input type="password" minLength={10} maxLength={128} autoComplete={mode === "register" ? "new-password" : "current-password"} required value={password} onChange={event => setPassword(event.target.value)} /><small>Не менее 10 символов. Пароль хранится только как защищённый хэш.</small></label>}
          <button className="primary-action" disabled={busy}>{busy ? "Подождите…" : mode === "register" ? "Зарегистрироваться" : mode === "forgot" ? "Отправить ссылку" : mode === "reset" ? "Сменить пароль" : mode === "legacy" ? "Открыть восстановление" : "Войти"}</button>
        </form>
        <nav className="auth-switches">
          {mode !== "login" && <button onClick={() => setMode("login")}>Уже есть аккаунт</button>}
          {mode !== "register" && <button onClick={() => setMode("register")}>Создать аккаунт</button>}
          {mode !== "forgot" && <button onClick={() => setMode("forgot")}>Забыли пароль?</button>}
          {mode !== "legacy" && <button onClick={() => setMode("legacy")}>Перенести старый E-mail аккаунт</button>}
        </nav>
      </>}
      {message && <p className="auth-message">{message}</p>}
    </section>
  </main>;
}
