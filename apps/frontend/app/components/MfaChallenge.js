"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

function challengeErrorMessage(error) {
  if (error?.status === 429 || error?.code === "over_request_rate_limit") {
    return "Muitas tentativas. Aguarde um pouco antes de tentar novamente.";
  }
  return "Código inválido ou expirado. Confira o aplicativo autenticador.";
}

export default function MfaChallenge({ onVerified, onLogout }) {
  const [factors, setFactors] = useState([]);
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getSupabaseBrowserClient().auth.mfa.listFactors()
      .then(({ data, error: listError }) => {
        if (!active) return;
        if (listError) {
          setError("Não foi possível carregar o segundo fator.");
        } else {
          setFactors(data.totp);
          setFactorId(data.totp[0]?.id || "");
          if (!data.totp.length) setError("Nenhum autenticador verificado foi encontrado.");
        }
      })
      .catch(() => { if (active) setError("Não foi possível carregar o segundo fator."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function verify(event) {
    event.preventDefault();
    if (!factorId || code.length !== 6 || busy) return;
    setBusy(true);
    setError("");
    try {
      const { error: verifyError } = await getSupabaseBrowserClient().auth.mfa.challengeAndVerify({
        factorId,
        code,
      });
      if (verifyError) {
        setError(challengeErrorMessage(verifyError));
        setCode("");
        return;
      }
      await onVerified();
    } catch {
      setError("Não foi possível verificar o código agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="authShell">
      <section className="authIntro">
        <div className="authMessage">
          <p className="eyebrow">SEGUNDO FATOR</p>
          <h1>Sua senha abriu a primeira porta.</h1>
          <p>Agora confirme que o aplicativo autenticador também está com você.</p>
        </div>
      </section>
      <section className="authPanel" aria-labelledby="mfa-challenge-title">
        <div>
          <p className="eyebrow">AUTENTICAÇÃO</p>
          <h2 id="mfa-challenge-title">Digite o código de 6 números</h2>
          <p className="authHint">Abra o autenticador usado quando você ativou o MFA.</p>
        </div>
        <form className="authForm" onSubmit={verify}>
          {factors.length > 1 && (
            <>
              <label htmlFor="mfa-factor">Autenticador</label>
              <select id="mfa-factor" value={factorId} onChange={(event) => setFactorId(event.target.value)} disabled={busy}>
                {factors.map((factor, index) => (
                  <option value={factor.id} key={factor.id}>{factor.friendly_name || `Autenticador ${index + 1}`}</option>
                ))}
              </select>
            </>
          )}
          <label htmlFor="mfa-code">Código temporário</label>
          <input
            id="mfa-code"
            className="mfaCodeInput"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            disabled={loading || busy}
            autoFocus
            required
          />
          {error && <p className="formError" role="alert">{error}</p>}
          <button type="submit" disabled={loading || busy || !factorId || code.length !== 6}>
            {busy ? "Verificando..." : loading ? "Carregando..." : "Confirmar código"}
          </button>
          <button className="authSecondaryButton" type="button" onClick={onLogout} disabled={busy}>Sair desta conta</button>
        </form>
      </section>
    </main>
  );
}
