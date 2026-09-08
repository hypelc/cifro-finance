"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export default function RedefinirSenhaPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [linkError, setLinkError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [canReset, setCanReset] = useState(false);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const queryParams = new URLSearchParams(window.location.search);

    const errorCode =
      hashParams.get("error_code") ||
      queryParams.get("error_code") ||
      hashParams.get("error") ||
      queryParams.get("error");

    if (errorCode) {
      const expiredCodes = new Set([
        "otp_expired",
        "flow_state_expired",
        "flow_state_not_found",
      ]);

      setLinkError(
        expiredCodes.has(errorCode)
          ? "Este link expirou ou já foi utilizado."
          : "Não foi possível validar este link de recuperação.",
      );
      setCheckingSession(false);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    let active = true;

    getSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data, error: userError }) => {
        if (!active) return;
        if (userError || !data.user) {
          setLinkError("Abra um link de recuperação válido para redefinir sua senha.");
        } else {
          setCanReset(true);
        }
        setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!PASSWORD_PATTERN.test(password)) {
      setError(
        "Use pelo menos 8 caracteres, com maiúscula, minúscula, número e símbolo."
      );
      return;
    }

    if (password !== confirmation) {
      setError("As duas senhas precisam ser iguais.");
      return;
    }

    setBusy(true);

    const supabase = getSupabaseBrowserClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("O link de recuperação expirou ou não é válido.");
      setBusy(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }

    await supabase.auth.signOut({ scope: "global" });

    setSuccess(true);
    setBusy(false);
  }

  return (
    <main className="authShell">
      <section className="authIntro">
        <div className="authMessage">
          <p className="eyebrow">SEGURANÇA</p>
          <h1>Proteja sua conta.</h1>
          <p>Defina uma senha nova e diferente das utilizadas em outros sites.</p>
        </div>
      </section>

      <section className="authPanel" aria-labelledby="reset-title">
        <div>
          <p className="eyebrow">RECUPERAÇÃO</p>
          <h2 id="reset-title">Redefinir senha</h2>
          <p className="authHint">
            Use pelo menos 8 caracteres, com maiúscula, minúscula, número e símbolo.
          </p>
        </div>

        {checkingSession ? (
          <p className="authHint">Validando o link de recuperação...</p>
        ) : linkError ? (
          <div>
            <p className="formError" role="alert">
              {linkError}
            </p>
            <div className="authResultActions">
              <Link className="authTextLink" href="/esqueci-senha">
                Solicitar novo link
              </Link>
              <Link className="authTextLink" href="/">
                Voltar para o login
              </Link>
            </div>
          </div>
        ) : success ? (
          <div className="authResult">
            <p className="formSuccess" role="status">
              Senha alterada. Todas as sessões foram encerradas.
            </p>
            <Link className="authTextLink" href="/">Voltar para o login</Link>
          </div>
        ) : canReset ? (
          <form className="authForm" onSubmit={handleSubmit}>
            <label htmlFor="new-password">Nova senha</label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />

            <label htmlFor="confirm-password">Confirmar nova senha</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />

            {error && (
              <p className="formError" role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={busy}>
              {busy ? "Alterando..." : "Alterar senha"}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
