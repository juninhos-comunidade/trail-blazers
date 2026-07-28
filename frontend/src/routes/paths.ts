export const paths = {
  landing: "/",
  inProgress: "/em-desenvolvimento",

  login: "/login",
  /** Destino do redirect do backend após o OAuth (FRONTEND_URL + esta rota). */
  authCallback: "/auth/success",
  dashboard: "/dashboard",
  /** Fluxo de criação de entrevista — ainda em construção. */
  newInterview: "/em-desenvolvimento",
  repoChooser: "/repoChooser"
} as const;

export const sectionIds = {
  howItWorks: "como-funciona",
} as const;
