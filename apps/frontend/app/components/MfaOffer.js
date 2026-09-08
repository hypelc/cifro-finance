"use client";

import { useEffect, useState } from "react";

export default function MfaOffer({ userId }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // This preference controls only the reminder. Authorization never trusts localStorage.
    const key = `cifro:mfa-offer-dismissed:${userId}`;
    try {
      setVisible(window.localStorage.getItem(key) !== "true");
    } catch {
      setVisible(true);
    }
  }, [userId]);

  function rememberChoice() {
    try {
      window.localStorage.setItem(`cifro:mfa-offer-dismissed:${userId}`, "true");
    } catch {
      // The reminder can still be dismissed for the current page.
    }
    setVisible(false);
  }

  function activate() {
    rememberChoice();
    window.location.assign("/configuracoes#seguranca-mfa");
  }

  if (!visible) return null;

  return (
    <div className="confirmationDialogOverlay">
      <section className="confirmationDialog" role="dialog" aria-modal="true" aria-labelledby="mfa-offer-title" aria-describedby="mfa-offer-message">
        <p className="confirmationDialogLabel">SEGURANÇA RECOMENDADA</p>
        <h2 id="mfa-offer-title">Quer proteger sua conta com um autenticador?</h2>
        <p className="confirmationDialogMessage" id="mfa-offer-message">
          Além da senha, cada novo acesso exigirá um código temporário do seu celular. A ativação é opcional, mas recomendada.
        </p>
        <div className="confirmationDialogActions">
          <button className="dialogCancelButton" type="button" onClick={rememberChoice}>Agora não</button>
          <button className="dialogConfirmButton" type="button" onClick={activate}>Ativar MFA</button>
        </div>
      </section>
    </div>
  );
}
