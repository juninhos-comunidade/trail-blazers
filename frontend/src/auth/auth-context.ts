import { createContext } from "react";

export interface AuthUser {
  /** Identificador do usuário no backend (claim `sub` do JWT). */
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** Motivo do fim da última sessão, para a tela de login explicar o que houve. */
  sessionEndReason: SessionEndReason | null;
  signIn: (accessToken: string) => boolean;
  signOut: (reason?: SessionEndReason) => void;
  clearSessionEndReason: () => void;
}

export type SessionEndReason = "expired" | "invalid";

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * O JWT vive no localStorage para sobreviver a reloads e abas novas. O token do
 * GitHub em si nunca chega ao frontend (RF-1.1): fica só no backend.
 */
export const TOKEN_STORAGE_KEY = "interviewtrail:token";
