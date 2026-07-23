import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/useAuth";
import { paths } from "../../routes/paths";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";

/** Identificação do usuário logado (RF-1.4) e saída da sessão (RF-1.5). */
export function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className="flex items-center gap-2 rounded-full border border-border bg-surface py-[5px] pr-3 pl-[5px]">
        <Avatar username={user.username} src={user.avatarUrl} />
        <span className="font-mono text-[12.5px] text-fg">{user.username}</span>
      </span>

      <Button
        variant="ghost"
        size="sm"
        className="font-medium"
        onClick={() => {
          signOut();
          navigate(paths.landing, { replace: true });
        }}
      >
        Sair
      </Button>
    </div>
  );
}
