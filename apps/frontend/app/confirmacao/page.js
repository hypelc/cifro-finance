"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

export default function ConfirmacaoPage() {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const queryParams = new URLSearchParams(window.location.search);
    const errorCode =
      hashParams.get("error_code") ||
      queryParams.get("error_code") ||
      hashParams.get("error") ||
      queryParams.get("error");

    if (errorCode) {
      setStatus("error");
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    let active = true;

    getSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data, error }) => {
        if (!active) return;
        setStatus(!error && data.user ? "success" : "error");
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="authShell">
      <section className="authIntro">
        <div className="authMessage">
          <p className="eyebrow">CONFIRMAÇÃO</p>
          <h1>Seu acesso começa com um e-mail verificado.</h1>
          <p>Essa etapa impede que outra pessoa cadastre um endereço que não controla.</p>
        </div>
      </section>

      <section className="authPanel" aria-labelledby="confirmation-title">
        <div>
          <p className="eyebrow">CONTA</p>
          <h2 id="confirmation-title">Confirmação de e-mail</h2>
        </div>

        {status === "loading" && (
          <p className="authHint">Validando sua confirmação...</p>
        )}

        {status === "success" && (
          <div className="authResult">
            <p className="formSuccess" role="status">
              E-mail confirmado. Sua conta está pronta para uso.
            </p>
            <Link className="authTextLink" href="/">Abrir o Cifro</Link>
          </div>
        )}

        {status === "error" && (
          <div className="authResult">
            <p className="formError" role="alert">
              Este link de confirmação expirou, já foi utilizado ou não é válido.
            </p>
            <Link className="authTextLink" href="/cadastro">Voltar ao cadastro</Link>
          </div>
        )}
      </section>
    </main>
  );
}
