"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

const MAX_CIFRO_FACTORS = 2;

function factorLabel(factor, index) {
  return factor.friendly_name || `Autenticador ${index + 1}`;
}

export default function MfaSettings({ refreshMfaStatus }) {
  const [factors, setFactors] = useState([]);
  const [pendingFactors, setPendingFactors] = useState([]);
  const [enrollment, setEnrollment] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [removalId, setRemovalId] = useState("");

  const loadFactors = useCallback(async () => {
    const { data, error: listError } = await getSupabaseBrowserClient().auth.mfa.listFactors();
    if (listError) throw listError;
    setFactors(data.all.filter((factor) => factor.status === "verified" && factor.factor_type === "totp"));
    setPendingFactors(data.all.filter((factor) => factor.status === "unverified" && factor.factor_type === "totp"));
  }, []);

  useEffect(() => {
    let active = true;
    loadFactors()
      .catch(() => { if (active) setError("Não foi possível carregar os autenticadores."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadFactors]);

  async function startEnrollment() {
    if (busy || enrollment || factors.length >= MAX_CIFRO_FACTORS) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data, error: enrollError } = await getSupabaseBrowserClient().auth.mfa.enroll({
        factorType: "totp",
        friendlyName: factors.length ? "Cifro reserva" : "Cifro principal",
        issuer: "Cifro",
      });
      if (enrollError) throw enrollError;
      setEnrollment({ id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    } catch {
      setError("Não foi possível iniciar a ativação do MFA.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnrollment() {
    if (!enrollment || busy) return;
    setBusy(true);
    setError("");
    try {
      const { error: removeError } = await getSupabaseBrowserClient().auth.mfa.unenroll({ factorId: enrollment.id });
      if (removeError) throw removeError;
      setEnrollment(null);
      setCode("");
      await loadFactors();
    } catch {
      setError("Não foi possível cancelar esta ativação.");
    } finally {
      setBusy(false);
    }
  }

  async function discardPending(factorId) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { error: removeError } = await getSupabaseBrowserClient().auth.mfa.unenroll({ factorId });
      if (removeError) throw removeError;
      await loadFactors();
      setNotice("Ativação incompleta removida.");
    } catch {
      setError("Não foi possível remover a ativação incompleta.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyEnrollment(event) {
    event.preventDefault();
    if (!enrollment || code.length !== 6 || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error: verifyError } = await getSupabaseBrowserClient().auth.mfa.challengeAndVerify({
        factorId: enrollment.id,
        code,
      });
      if (verifyError) {
        setError("Código inválido ou expirado. Confira o autenticador.");
        setCode("");
        return;
      }
      setEnrollment(null);
      setCode("");
      await loadFactors();
      await refreshMfaStatus();
      setNotice("MFA ativado. Os próximos acessos exigirão o autenticador.");
    } catch {
      setError("Não foi possível concluir a ativação do MFA.");
    } finally {
      setBusy(false);
    }
  }

  async function removeFactor(factorId) {
    if (busy || removalId !== factorId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error: removeError } = await getSupabaseBrowserClient().auth.mfa.unenroll({ factorId });
      if (removeError) throw removeError;
      setRemovalId("");
      await loadFactors();
      await refreshMfaStatus();
      setNotice("Autenticador removido da conta.");
    } catch {
      setError("Não foi possível remover o autenticador. Confirme o MFA novamente e tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settingsSection mfaSettings" id="seguranca-mfa" aria-labelledby="mfa-settings-title">
      <div className="settingsSectionHeading">
        <div><p className="eyebrow">SEGURANÇA DA CONTA</p><h2 id="mfa-settings-title">Autenticação em duas etapas</h2></div>
        <span className={`settingsBadge ${factors.length ? "mfaEnabled" : ""}`}>{factors.length ? "ativa" : "recomendada"}</span>
      </div>
      <p className="settingsDescription">
        Use um aplicativo como Aegis, Google Authenticator, Microsoft Authenticator ou 2FAS. O código muda a cada 30 segundos e será exigido após sua senha.
      </p>

      {loading && <p className="mfaStatusText">Verificando autenticadores...</p>}

      {!loading && factors.length > 0 && (
        <div className="mfaFactorList">
          {factors.map((factor, index) => (
            <div className="mfaFactor" key={factor.id}>
              <div><strong>{factorLabel(factor, index)}</strong><span>Aplicativo autenticador · verificado</span></div>
              {removalId === factor.id ? (
                <div className="mfaFactorActions">
                  <button type="button" onClick={() => setRemovalId("")} disabled={busy}>Cancelar</button>
                  <button className="dangerTextButton" type="button" onClick={() => removeFactor(factor.id)} disabled={busy}>{busy ? "Removendo..." : "Confirmar remoção"}</button>
                </div>
              ) : (
                <button className="dangerTextButton" type="button" onClick={() => setRemovalId(factor.id)} disabled={busy}>Remover</button>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && pendingFactors.length > 0 && !enrollment && (
        <div className="mfaPendingList">
          <strong>Há uma ativação que não foi concluída.</strong>
          {pendingFactors.map((factor) => (
            <button type="button" key={factor.id} onClick={() => discardPending(factor.id)} disabled={busy}>Descartar ativação incompleta</button>
          ))}
        </div>
      )}

      {enrollment && (
        <form className="mfaEnrollment" onSubmit={verifyEnrollment}>
          <div className="mfaEnrollmentSteps">
            <div><b>1</b><span>Escaneie o QR no seu aplicativo autenticador.</span></div>
            <div><b>2</b><span>Guarde o autenticador em local protegido. Não compartilhe este QR nem o segredo.</span></div>
            <div><b>3</b><span>Digite abaixo o código de 6 números exibido pelo aplicativo.</span></div>
          </div>
          <img className="mfaQrCode" src={enrollment.qrCode} alt="QR code temporário para ativar o autenticador" />
          <details className="mfaSecret">
            <summary>Não consigo escanear o QR</summary>
            <p>Digite este segredo manualmente no autenticador:</p>
            <code>{enrollment.secret}</code>
          </details>
          <label className="settingsField mfaVerificationField">
            <span>Código temporário</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              required
            />
          </label>
          <div className="mfaEnrollmentActions">
            <button className="secondaryButton" type="button" onClick={cancelEnrollment} disabled={busy}>Cancelar</button>
            <button className="confirmButton" type="submit" disabled={busy || code.length !== 6}>{busy ? "Verificando..." : "Confirmar e ativar"}</button>
          </div>
        </form>
      )}

      {!loading && !enrollment && factors.length < MAX_CIFRO_FACTORS && pendingFactors.length === 0 && (
        <button className="secondaryButton mfaAddButton" type="button" onClick={startEnrollment} disabled={busy}>
          {busy ? "Preparando..." : factors.length ? "Adicionar autenticador reserva" : "Ativar autenticação em duas etapas"}
        </button>
      )}

      {factors.length === 1 && <p className="settingsWarning">O Supabase não fornece códigos de recuperação. Um segundo autenticador pode servir como reserva.</p>}
      {factors.length >= MAX_CIFRO_FACTORS && <p className="settingsWarning">Limite do Cifro atingido: um autenticador principal e um de reserva.</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      {error && <p className="formError" role="alert">{error}</p>}
    </section>
  );
}
