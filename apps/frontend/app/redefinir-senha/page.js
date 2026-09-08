"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export default function RedefinirSenhaPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

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

        {success ? (
          <div>
            <p>Senha alterada. Todas as sessões foram encerradas.</p>
            <a href="/">Voltar para o login</a>
          </div>
        ) : (
          <form className="authForm" onSubmit={handleSubmit}>
            <label htmlFor="new-password">Nova senha</label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />

            <label htmlFor="confirm-password">Confirmar nova senha</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
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
        )}
      </section>
    </main>
  );
}