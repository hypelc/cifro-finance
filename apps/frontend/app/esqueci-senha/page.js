"use client";

import Link from "next/link";
import { useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import TurnstileWidget from "../components/TurnstileWidget";

function recoveryErrorMessage(error) {
  if (error?.code === "captcha_failed") {
    return "A verificação de segurança falhou. Tente novamente.";
  }
  if (error?.code === "over_email_send_rate_limit") {
    return "O limite temporário de envio de e-mails foi atingido. Tente novamente mais tarde.";
  }
  return "Não foi possível processar a solicitação agora. Tente novamente.";
}

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!captchaToken || busy) return;

    setBusy(true);
    setError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/redefinir-senha`,
          captchaToken,
        },
      );

      if (resetError) {
        setError(recoveryErrorMessage(resetError));
      } else {
        setSent(true);
      }
    } catch {
      setError("Não foi possível processar a solicitação agora. Tente novamente.");
    } finally {
      setCaptchaToken("");
      setCaptchaResetKey((current) => current + 1);
      setBusy(false);
    }
  }

  return (
    <main className="authShell">
      <section className="authIntro">
        <div className="authMessage">
          <p className="eyebrow">RECUPERAÇÃO</p>
          <h1>Recupere o acesso com segurança.</h1>
          <p>Enviaremos um link temporário para o endereço informado.</p>
        </div>
      </section>

      <section className="authPanel" aria-labelledby="recovery-title">
        <div>
          <p className="eyebrow">ACESSO</p>
          <h2 id="recovery-title">Esqueci minha senha</h2>
          <p className="authHint">
            Por segurança, a resposta será a mesma exista ou não uma conta para o e-mail.
          </p>
        </div>

        {sent ? (
          <div className="authResult">
            <p className="formSuccess" role="status">
              Se o endereço estiver cadastrado, você receberá um link para redefinir a senha.
            </p>
            <Link className="authTextLink" href="/">Voltar para o login</Link>
          </div>
        ) : (
          <form className="authForm" onSubmit={handleSubmit}>
            <label htmlFor="recovery-email">E-mail</label>
            <input
              id="recovery-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />

            <TurnstileWidget
              onVerify={setCaptchaToken}
              resetKey={captchaResetKey}
              action="password_reset"
            />

            {error && <p className="formError" role="alert">{error}</p>}

            <button type="submit" disabled={busy || !captchaToken}>
              {busy ? "Enviando..." : "Enviar link de recuperação"}
            </button>

            <p className="authAlternate">
              <Link className="authTextLink" href="/">Voltar para o login</Link>
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
