/**
 * URL base da API. Em desenvolvimento o backend sobe em http://localhost:3000;
 * em outros ambientes basta definir VITE_API_URL no build.
 */
export const API_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:3000"
).replace(/\/$/, "");
