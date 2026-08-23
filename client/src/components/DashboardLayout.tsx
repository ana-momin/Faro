import { useAuth } from "@/_core/hooks/useAuth";
import FaroLogo from "@/components/FaroLogo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { Activity, LogOut, PanelLeft, ShieldCheck } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [{ icon: Activity, label: "Workspace", path: "/" }];
const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 248;
const MIN_WIDTH = 200;
const MAX_WIDTH = 420;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)) || DEFAULT_WIDTH);
  const { loading, user } = useAuth();
  useEffect(() => localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth)), [sidebarWidth]);
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <div className="flex min-h-screen items-center justify-center bg-[#fbfbfa]"><div className="w-full max-w-sm space-y-7 p-8"><FaroLogo /><div><h1 className="text-2xl font-bold tracking-[-0.05em]">Review signals with context.</h1><p className="mt-2 text-sm text-muted-foreground">Sign in to access your private Faro workspace.</p></div><Button onClick={() => startLogin()} size="lg" className="w-full rounded-xl bg-[#111214]">Sign in</Button></div></div>;
  return <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}><DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent></SidebarProvider>;
}

function DashboardLayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (width: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isCollapsed = state === "collapsed";
  const isMobile = useIsMobile();
  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (!isResizing) return;
      const width = event.clientX - (sidebarRef.current?.getBoundingClientRect().left ?? 0);
      if (width >= MIN_WIDTH && width <= MAX_WIDTH) setSidebarWidth(width);
    };
    const up = () => setIsResizing(false);
    if (isResizing) { document.addEventListener("mousemove", move); document.addEventListener("mouseup", up); }
    return () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
  }, [isResizing, setSidebarWidth]);
  return <><div className="relative" ref={sidebarRef}><Sidebar collapsible="icon" className="border-r border-[#ececeb] bg-[#fbfbfa]" disableTransition={isResizing}><SidebarHeader className="h-[76px] justify-center"><div className="flex w-full items-center gap-3 px-3"><button onClick={toggleSidebar} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#71716f] hover:bg-[#f1f1ef]" aria-label="Toggle navigation"><PanelLeft className="h-4 w-4" /></button>{!isCollapsed && <FaroLogo />}</div></SidebarHeader><SidebarContent className="px-2"><p className="px-3 pt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#969692] group-data-[collapsible=icon]:hidden">Your research</p><SidebarMenu className="mt-2">{menuItems.map(item => <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={location === item.path} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-10 rounded-lg text-[#30302f] data-[active=true]:bg-[#111214] data-[active=true]:text-white"><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarContent><SidebarFooter className="p-3"><div className="mb-3 flex items-center gap-2 rounded-lg bg-[#f1f1ef] px-3 py-2 text-[11px] text-[#5f5f5b] group-data-[collapsible=icon]:justify-center"><ShieldCheck className="h-3.5 w-3.5" /><span className="group-data-[collapsible=icon]:hidden">Human review only</span></div><DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left hover:bg-[#f1f1ef] group-data-[collapsible=icon]:justify-center"><Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-[#e8e8e5] text-[11px] font-semibold">{user?.name?.charAt(0).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="truncate text-xs font-semibold">{user?.name || "-"}</p><p className="truncate text-[10px] text-muted-foreground">{user?.email || "-"}</p></div></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={logout} className="text-destructive"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu></SidebarFooter></Sidebar>{!isCollapsed && <div className="absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize" onMouseDown={() => setIsResizing(true)} />}</div><SidebarInset>{isMobile && <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#ececeb] bg-[#fbfbfa]/95 px-3 backdrop-blur"><div className="flex items-center gap-2"><SidebarTrigger className="h-9 w-9" /><FaroLogo /></div><span className="text-xs text-[#777773]">Workspace</span></div>}<main className="flex-1 p-3 sm:p-5 lg:p-7">{children}</main></SidebarInset></>;
}
