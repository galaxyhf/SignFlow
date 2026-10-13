"use client";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTheme } from "next-themes";
import {
  FileSignature,
  LayoutDashboard,
  Users,
  Files,
  Layers,
  Settings,
  ShieldCheck,
  PanelLeftClose,
  Menu,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";
import { api, post, Actor, ApiError } from "../lib/api";
import { Button } from "../components/ui/button";
import { Loading, ErrorBox } from "../components/common";
import { Login } from "./login";
import { Dashboard } from "./dashboard";
import { Clients } from "./clients";
import { Templates, TemplateEditor } from "./templates";
import { Documents, NewRequest, DocumentDetails } from "./documents";
import { UsersPage, SettingsPage, AuditPage } from "./administration";
const nav = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/documentos", label: "Documentos", icon: Files },
  { href: "/modelos", label: "Modelos", icon: Layers },
  { href: "/clientes", label: "Clientes", icon: Users },
  {
    href: "/usuarios",
    label: "Funcionários",
    icon: Users,
    permission: "users.write",
  },
  {
    href: "/auditoria",
    label: "Auditoria",
    icon: ShieldCheck,
    permission: "audit.read",
  },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];
export function Workspace() {
  const path = usePathname(),
    router = useRouter(),
    { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<Actor>("auth/me"),
    retry: false,
  });
  if (
    path === "/login" ||
    (me.error instanceof ApiError && me.error.status === 401)
  )
    return <Login />;
  if (me.isPending)
    return (
      <div className="content">
        <Loading />
      </div>
    );
  if (me.error)
    return (
      <div className="content">
        <ErrorBox error={me.error} retry={() => me.refetch()} />
      </div>
    );
  const user = me.data!;
  const parts = path.split("/").filter(Boolean);
  let page: React.ReactNode;
  switch (parts[0]) {
    case "clientes":
      page = <Clients user={user} />;
      break;
    case "modelos":
      page = parts[1] ? (
        <TemplateEditor
          id={parts[1] === "novo" ? undefined : parts[1]}
          readOnly={parts[1] !== "novo" && parts[2] !== "editar"}
          user={user}
        />
      ) : (
        <Templates user={user} />
      );
      break;
    case "documentos":
      page =
        parts[1] === "novo" ? (
          <NewRequest user={user} />
        ) : parts[1] ? (
          <DocumentDetails id={parts[1]} user={user} />
        ) : (
          <Documents user={user} />
        );
      break;
    case "usuarios":
      page = user.permissions.includes("users.write") ? (
        <UsersPage />
      ) : (
        <ErrorBox error={new Error("Acesso não autorizado")} />
      );
      break;
    case "configuracoes":
      page = <SettingsPage user={user} />;
      break;
    case "auditoria":
      page = user.permissions.includes("audit.read") ? (
        <AuditPage />
      ) : (
        <ErrorBox error={new Error("Acesso não autorizado")} />
      );
      break;
    case "dashboard":
    case undefined:
      page = <Dashboard user={user} />;
      break;
    default:
      page = <ErrorBox error={new Error("Página não encontrada")} />;
  }
  return (
    <div className="app-shell">
      <a href="#main" className="sr-only focus:not-sr-only">
        Ir ao conteúdo
      </a>
      <aside
        className={`sidebar ${collapsed ? "collapsed" : ""} ${mobile ? "mobile-open" : ""}`}
      >
        <Link href="/dashboard" className="brand">
          <FileSignature size={26} />
          {(!collapsed || mobile) && "SignFlow"}
        </Link>
        <nav>
          {nav
            .filter(
              (n) => !n.permission || user.permissions.includes(n.permission),
            )
            .map((n) => (
              <Link
                key={n.href}
                href={n.href}
                title={n.label}
                className={path.startsWith(n.href) ? "active" : ""}
                onClick={() => setMobile(false)}
              >
                <n.icon size={18} />
                {(!collapsed || mobile) && n.label}
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <Button
            variant="ghost"
            onClick={() => {
              setCollapsed(!collapsed);
              setMobile(false);
            }}
            aria-label="Recolher menu"
          >
            <PanelLeftClose size={18} />
            {!collapsed && "Recolher menu"}
          </Button>
          {!collapsed && (
            <small className="muted">
              Documentos preservados.
              <br />
              Decisões registradas.
            </small>
          )}
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="actions">
            <Button
              variant="ghost"
              className="mobile-menu"
              onClick={() => setMobile(!mobile)}
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </Button>
            <span className="muted">Área de trabalho</span>
          </div>
          <div className="actions">
            <Button
              variant="ghost"
              aria-label="Alternar tema"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </Button>
            <span>{user.name}</span>
            <Button
              variant="ghost"
              aria-label="Sair"
              onClick={async () => {
                await post("auth/logout", {});
                for (let i = sessionStorage.length - 1; i >= 0; i--) {
                  const k = sessionStorage.key(i);
                  if (k?.startsWith("link:")) sessionStorage.removeItem(k);
                }
                await me.refetch();
                router.push("/login");
              }}
            >
              <LogOut size={17} />
            </Button>
          </div>
        </header>
        <main id="main" className="content">
          {page}
        </main>
      </div>
    </div>
  );
}
