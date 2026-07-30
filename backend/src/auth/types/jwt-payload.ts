// Conteúdo do JWT emitido após o login. `sub` é o id do usuário na aplicação.

export type JwtPayload = {
  sub: string;
  username: string;
  email?: string;
  avatarUrl?: string;
};
