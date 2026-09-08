"use client";

import { getPasswordRequirements } from "../../lib/password";

export default function PasswordRequirements({ password }) {
  const requirements = getPasswordRequirements(password);

  return (
    <ul className="passwordRequirements" aria-label="Requisitos da senha" aria-live="polite">
      {requirements.map((requirement) => (
        <li
          className={requirement.met ? "passwordRequirement isMet" : "passwordRequirement"}
          key={requirement.id}
        >
          <span aria-hidden="true">{requirement.met ? "✓" : "○"}</span>
          {requirement.label}
        </li>
      ))}
    </ul>
  );
}
