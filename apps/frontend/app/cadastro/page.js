"use client";

import Link from "next/link";
import { useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import TurnstileWidget from "../components/TurnstileWidget";

const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function signUpErrorMessage(error) {
  if (error?.code === "weak_password") {
    return "A senha não cumpre os requisitos de segurança.";
  }
  if (error?.code === "captcha_failed") {
    return "A verificação de segurança falhou. Tente novamente.";
  }
  if (error?.code === "over_email_send_rate_limit") {
    return "Muitas solicitações foram feitas. Aguarde antes de tentar novamente.";
  }
  return "Não foi possível criar a conta agora. Revise os dados e tente novamente.";
}

export default function CadastroPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!captchaToken || busy) return;

    setError("");

    if (!PASSWORD_PATTERN.test(password)) {
      setError("Use 8 caracteres ou mais, com maiúscula, minúscula, número e símbolo.");
      return;
    }

    if (password !== confirmation) {
      setError("As duas senhas precisam ser iguais.");
      return;
    }

    setBusy(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/confirmacao`,
          captchaToken,
        },
      });

      if (signUpError) {
        setError(signUpErrorMessage(signUpError));
      } else {
        setCreated(true);
      }
    } catch {
      setError("Não foi possível criar a conta agora. Tente novamente.");
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
          <p className="eyebrow">NOVA CONTA</p>
          <h1>Comece a enxergar seu dinheiro à frente.</h1>
          <p>Crie sua conta e confirme o endereço de e-mail antes do primeiro acesso.</p>
        </div>
      </section>

      <section className="authPanel" aria-labelledby="signup-title">
        <div>
          <p className="eyebrow">CADASTRO</p>
          <h2 id="signup-title">Criar conta</h2>
          <p className="authHint">
            A senha deve ter 8 caracteres ou mais, com maiúscula, minúscula, número e símbolo.
          </p>
        </div>

        {created ? (
          <div className="authResult">
            <p className="formSuccess" role="status">
              Se o cadastro puder ser realizado, enviaremos um link de confirmação para o e-mail informado.
            </p>
            <Link className="authTextLink" href="/">Voltar para o login</Link>
          </div>
        ) : (
          <form className="authForm" onSubmit={handleSubmit}>
            <label htmlFor="signup-email">E-mail</label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />

            <label htmlFor="signup-password">Senha</label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />

            <label htmlFor="signup-password-confirmation">Confirmar senha</label>
            <input
              id="signup-password-confirmation"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />

            <TurnstileWidget
              onVerify={setCaptchaToken}
              resetKey={captchaResetKey}
              action="signup"
            />

            {error && <p className="formError" role="alert">{error}</p>}

            <button type="submit" disabled={busy || !captchaToken}>
              {busy ? "Criando..." : "Criar conta"}
            </button>

            <p className="authAlternate">
              Já possui uma conta?{" "}
              <Link className="authTextLink" href="/">Entrar</Link>
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
