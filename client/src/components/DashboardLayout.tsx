import { useAuth } from "@/_core/hooks/useAuth";
import FaroLogo from "@/components/FaroLogo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { Compass, Inbox, LogOut, PanelLeft, Radar, ShieldCheck, UserRound } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [
  { icon: Compass, label: "Discover", path: "/" },
  { icon: Inbox, label: "Review", path: "/review" },
  { icon: Radar, label: "Signals", path: "/signals" },
  { icon: UserRound, label: "Profile", path: "/profile" },
];
const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 248;
const MIN_WIDTH = 200;
const MAX_WIDTH = 420;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)) || DEFAULT_WIDTH);
  const { loading, user } = useAuth();
  useEffect(() => localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth)), [sidebarWidth]);
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <div className="min-h-screen bg-[#f8f9f7] p-4 sm:p-8"><div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-5xl overflow-hidden rounded-[32px] border border-[#e5e7e1] bg-white lg:grid-cols-[1.1fr_0.9fr]"><section className="flex flex-col justify-between bg-[#171916] p-7 text-white sm:p-10"><FaroLogo className="[&>span:last-child]:text-white" /><div className="py-10"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-[#a8dfb8]"><Radar className="h-5 w-5" /></span><h1 className="mt-6 max-w-md text-4xl font-extrabold tracking-[-0.07em]">Find people already looking for help.</h1><p className="mt-4 max-w-sm text-sm leading-6 text-white/60">Faro maps service demand on X, filters the noise, and leaves every decision to you.</p></div><div className="flex items-center gap-2 text-[10px] text-white/50"><ShieldCheck className="h-3.5 w-3.5 text-[#9ee2ae]" />Human review stays in control.</div></section><section className="flex flex-col justify-center p-7 sm:p-10"><FaroLogo /><h2 className="mt-10 text-2xl font-extrabold tracking-[-0.055em]">Your signal desk.</h2><p className="mt-2 text-sm leading-6 text-[#777a73]">One agent, one clear review queue, and no automated outreach.</p><Button onClick={() => startLogin()} size="lg" className="mt-8 h-11 w-full rounded-xl bg-[#111214]">Continue to Faro</Button><div className="mt-5 grid grid-cols-3 gap-2"><span className="rounded-xl bg-[#f2f4f0] p-3 text-center text-[10px] font-bold text-[#5d615a]">Map</span><span className="rounded-xl bg-[#f2f4f0] p-3 text-center text-[10px] font-bold text-[#5d615a]">Filter</span><span className="rounded-xl bg-[#f2f4f0] p-3 text-center text-[10px] font-bold text-[#5d615a]">Review</span></div></section></div></div>;
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
  const activeLabel = menuItems.find(item => item.path === location)?.label ?? "Faro";
  return <><div className="relative" ref={sidebarRef}><Sidebar collapsible="icon" className="border-r border-[#ececeb] bg-[#fbfbfa]" disableTransition={isResizing}><SidebarHeader className="h-[78px] justify-center"><div className="flex w-full items-center gap-3 px-3"><button onClick={toggleSidebar} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#71716f] hover:bg-[#f1f1ef]" aria-label="Toggle navigation"><PanelLeft className="h-4 w-4" /></button>{!isCollapsed && <FaroLogo />}</div></SidebarHeader><SidebarContent className="px-2"><div className="mx-1 mt-3 rounded-2xl bg-[#f0f2ee] p-2 group-data-[collapsible=icon]:hidden"><div className="flex items-center gap-2 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#7f827b]"><Radar className="h-3.5 w-3.5" />Faro desk</div></div><SidebarMenu className="mt-3">{menuItems.map(item => <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={location === item.path} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-10 rounded-xl text-[#30302f] data-[active=true]:bg-[#111214] data-[active=true]:text-white"><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarContent><SidebarFooter className="p-3"><div className="mb-3 flex items-center gap-2 rounded-xl bg-[#edf5ef] px-3 py-2 text-[10px] font-semibold text-[#467053] group-data-[collapsible=icon]:justify-center"><ShieldCheck className="h-3.5 w-3.5" /><span className="group-data-[collapsible=icon]:hidden">Human-led review</span></div><DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-2.5 rounded-xl px-1 py-1.5 text-left hover:bg-[#f1f1ef] group-data-[collapsible=icon]:justify-center"><Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-[#dff5e6] text-[11px] font-semibold text-[#17643c]">{user?.name?.charAt(0).toUpperCase() || "F"}</AvatarFallback></Avatar><div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="truncate text-xs font-semibold">{user?.name || "Faro member"}</p><p className="truncate text-[10px] text-muted-foreground">{user?.email || "Private account"}</p></div></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setLocation("/profile")}><UserRound className="mr-2 h-4 w-4" />Profile</DropdownMenuItem><DropdownMenuItem onClick={logout} className="text-destructive"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu></SidebarFooter></Sidebar>{!isCollapsed && <div className="absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize" onMouseDown={() => setIsResizing(true)} />}</div><SidebarInset>{isMobile && <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#ececeb] bg-[#fbfbfa]/95 px-3 backdrop-blur"><div className="flex items-center gap-2"><SidebarTrigger className="h-9 w-9" /><FaroLogo /></div><span className="text-xs font-semibold text-[#777773]">{activeLabel}</span></div>}<main className="flex-1 p-3 sm:p-5 lg:p-7">{children}</main></SidebarInset></>;
}
