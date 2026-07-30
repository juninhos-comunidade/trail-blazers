// Formato do usuário anexado em `req.user` nas rotas protegidas por JWT

export type AuthenticatedUser = {
  id: string;
  githubId: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
};
