import { cookies } from "next/headers";
import BetaSignIn from "../../components/BetaSignIn";
import { DeepSeekKeyField, DeepSeekKeyProvider } from "../../components/DeepSeekKey";
import Sidebar from "../../components/Sidebar";
import { getCookieName, getInviteSettings, requireInvite, sessionUser } from "../../lib/serverAccess";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  if (requireInvite()) {
    const settings = getInviteSettings();
    const cookie = (await cookies()).get(getCookieName())?.value;
    if (!sessionUser(cookie)) return <BetaSignIn available={Boolean(settings)} />;
  }

  return (
    <DeepSeekKeyProvider>
      <div className="tuda-shell">
        <Sidebar />
        <main className="tuda-content">
          <DeepSeekKeyField />
          {children}
        </main>
      </div>
    </DeepSeekKeyProvider>
  );
}
