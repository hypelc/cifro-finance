export const PASSWORD_REQUIREMENT_TEXT =
  "Use 8 caracteres ou mais, com maiúscula, minúscula, número e símbolo.";

export function getPasswordRequirements(password) {
  return [
    { id: "length", label: "8 caracteres ou mais", met: password.length >= 8 },
    { id: "lowercase", label: "Uma letra minúscula", met: /[a-z]/.test(password) },
    { id: "uppercase", label: "Uma letra maiúscula", met: /[A-Z]/.test(password) },
    { id: "number", label: "Um número", met: /\d/.test(password) },
    { id: "symbol", label: "Um símbolo", met: /[^A-Za-z0-9\s]/.test(password) },
  ];
}

export function isPasswordValid(password) {
  return getPasswordRequirements(password).every((requirement) => requirement.met);
}
