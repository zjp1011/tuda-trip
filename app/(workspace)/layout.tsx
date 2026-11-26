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
      <div className="flex h-screen flex-col overflow-hidden bg-[#070707] text-gray-950 md:flex-row">
        <Sidebar />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <DeepSeekKeyField />
          {children}
        </main>
      </div>
    </DeepSeekKeyProvider>
  );
}
