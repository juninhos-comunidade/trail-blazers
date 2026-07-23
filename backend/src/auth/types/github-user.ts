// Formato do usuário devolvido pela GithubStrategy e anexado em `req.user`

export type GithubUser = {
  githubId: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  accessToken: string;
};
