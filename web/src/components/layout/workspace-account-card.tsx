import type { ReactNode } from "react";
import { Button } from "antd";
import { ArrowUpRight, Coins, LogOut, RefreshCw, Settings, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { useWorkspaceLogout } from "@/hooks/use-workspace-logout";
import { useUserStore } from "@/stores/use-user-store";
import { UserAvatar } from "./user-avatar";
import "./workspace-account-card.css";

/** 同一账户卡片用于顶部和侧栏；余额与退出均复用真实服务。 */
export function WorkspaceAccountCard({ onWallet, onNavigate, children }: { onWallet: () => void; onNavigate: () => void; children?: ReactNode }) {
    const user = useUserStore((state) => state.user);
    const creditsEnabled = useUserStore((state) => state.features.creditsEnabled);
    const { availableMicrocredits, refreshing, refresh } = useWalletBalance(user?.id, creditsEnabled);
    const { handleLogout, loggingOut } = useWorkspaceLogout();
    if (!user) return null;
    return (
        <section className="workspace-account-card" aria-label="我的账户">
            <header className="workspace-account-card-identity">
                <UserAvatar user={user} className="workspace-account-card-avatar" />
                <div className="workspace-account-card-profile">
                    <strong title={user.displayName || user.username}>{user.displayName || user.username}</strong>
                    <span title={`@${user.username}`}>@{user.username}</span>
                    <em>{user.role === "admin" ? "管理员" : "创作者"}</em>
                </div>
                {creditsEnabled ? (
                    <div className="workspace-account-card-wallet">
                        <div className="workspace-account-card-balance">
                            <span>
                                <Coins aria-hidden />
                                可用积分
                            </span>
                            <strong>{availableMicrocredits === null ? "—" : (availableMicrocredits / 1_000_000).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}</strong>
                        </div>
                        {availableMicrocredits === null ? (
                            <Button type="text" size="small" loading={refreshing} icon={<RefreshCw aria-hidden />} onClick={() => void refresh()}>
                                刷新余额
                            </Button>
                        ) : (
                            <button type="button" onClick={onWallet}>
                                充值 / 兑换
                                <ArrowUpRight aria-hidden />
                            </button>
                        )}
                    </div>
                ) : null}
            </header>
            <nav className="workspace-account-card-actions" aria-label="账户操作">
                <Link to="/settings?section=profile" onClick={onNavigate}>
                    <Settings aria-hidden />
                    <span>账户与设置</span>
                </Link>
                {user.role === "admin" ? (
                    <Link to="/admin" onClick={onNavigate}>
                        <ShieldCheck aria-hidden />
                        <span>管理员后台</span>
                    </Link>
                ) : null}
                {children}
                <div className="workspace-account-card-session">
                    <Button danger type="text" icon={<LogOut aria-hidden />} loading={loggingOut} onClick={() => void handleLogout()}>
                        退出登录
                    </Button>
                </div>
            </nav>
        </section>
    );
}
