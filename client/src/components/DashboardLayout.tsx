import { useAuth } from "@/_core/hooks/useAuth";
import FaroLogo from "@/components/FaroLogo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { PRODUCT_INTRO_PATH } from "@/lib/productIntro";
import { Compass, Inbox, LogOut, Radar, Search, ShieldCheck, UserRound } from "lucide-react";
import { CSSProperties } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [
  { icon: Compass, label: "Discover", path: "/" },
  { icon: Search, label: "Search", path: "/search" },
  { icon: Inbox, label: "Review", path: "/review" },
  { icon: UserRound, label: "Profile", path: "/profile" },
];
const DEFAULT_WIDTH = 248;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <div className="min-h-screen bg-[#f8f9f7] p-4 sm:p-8"><div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-5xl overflow-hidden rounded-[32px] border border-[#e5e7e1] bg-white lg:grid-cols-[1.1fr_0.9fr]"><section className="flex flex-col justify-between bg-[#171916] p-7 text-white sm:p-10"><FaroLogo className="[&>span:last-child]:text-white" /><div className="py-10"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-[#a8dfb8]"><Radar className="h-5 w-5" /></span><h1 className="mt-6 max-w-md text-4xl font-extrabold tracking-[-0.07em]">Find people already looking for help.</h1><p className="mt-4 max-w-sm text-sm leading-6 text-white/60">Faro maps service demand on X, filters the noise, and leaves every decision to you.</p></div><div className="flex items-center gap-2 text-[10px] text-white/50"><ShieldCheck className="h-3.5 w-3.5 text-[#9ee2ae]" />Human review stays in control.</div></section><section className="flex flex-col justify-center p-7 sm:p-10"><FaroLogo /><h2 className="mt-10 text-2xl font-extrabold tracking-[-0.055em]">Your signal desk.</h2><p className="mt-2 text-sm leading-6 text-[#777a73]">One agent, one clear review queue, and no automated outreach.</p><Button onClick={() => startLogin()} size="lg" className="mt-8 h-11 w-full rounded-xl bg-[#111214]">Continue to Faro</Button><div className="mt-5 grid grid-cols-3 gap-2"><span className="rounded-xl bg-[#f2f4f0] p-3 text-center text-[10px] font-bold text-[#5d615a]">Map</span><span className="rounded-xl bg-[#f2f4f0] p-3 text-center text-[10px] font-bold text-[#5d615a]">Filter</span><span className="rounded-xl bg-[#f2f4f0] p-3 text-center text-[10px] font-bold text-[#5d615a]">Review</span></div></section></div></div>;
  return <SidebarProvider style={{ "--sidebar-width": `${DEFAULT_WIDTH}px`, "--sidebar-width-icon": `${DEFAULT_WIDTH}px` } as CSSProperties}><DashboardLayoutContent>{children}</DashboardLayoutContent></SidebarProvider>;
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const activeLabel = menuItems.find(item => item.path === location)?.label ?? "Faro AI";
  return <><Sidebar collapsible="offcanvas" className="border-r border-[#eadfd2] bg-[#fffdfa]"><SidebarHeader className="h-[112px] justify-center"><div className="flex w-full justify-center px-3"><button onClick={() => setLocation(PRODUCT_INTRO_PATH)} className="rounded-2xl outline-none transition hover:scale-[1.02] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[#bd674c]" title="About Faro AI" aria-label="Open Faro AI product introduction"><FaroLogo className="[&>span:first-child]:h-11 [&>span:first-child]:w-11 [&>span:first-child]:rounded-[14px] [&>span:last-child]:text-[24px]" /></button></div></SidebarHeader><SidebarContent className="px-2"><SidebarMenu className="mt-2">{menuItems.map(item => <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={location === item.path} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-10 rounded-xl text-[#4b3b2f] data-[active=true]:bg-[#f1d7b9] data-[active=true]:text-[#75432e] data-[active=true]:shadow-[inset_0_0_0_1px_rgba(185,105,77,0.16)]"><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarContent><SidebarFooter className="p-3"><DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-2.5 rounded-xl px-1 py-1.5 text-left hover:bg-[#fbf2e5]"><Avatar className="h-8 w-8 shrink-0"><AvatarImage src={user?.avatarUrl || undefined} alt={user?.name || "Faro member"} /><AvatarFallback className="bg-[#f8e4c8] text-[11px] font-semibold text-[#9c573f]">{user?.name?.charAt(0).toUpperCase() || "F"}</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate text-xs font-semibold">{user?.name || "Faro member"}</p><p className="truncate text-[10px] text-muted-foreground">{user?.email || "Private account"}</p></div></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setLocation("/profile")}><UserRound className="mr-2 h-4 w-4" />Profile</DropdownMenuItem><DropdownMenuItem onClick={logout} className="text-destructive"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu></SidebarFooter></Sidebar><SidebarInset>{isMobile && <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#eadfd2] bg-[#fffdfa]/95 px-3 backdrop-blur"><div className="flex items-center gap-2"><SidebarTrigger className="h-9 w-9" /><button onClick={() => setLocation(PRODUCT_INTRO_PATH)} className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#bd674c]" aria-label="Open Faro AI product introduction"><FaroLogo /></button></div><span className="text-xs font-semibold text-[#856d5b]">{activeLabel}</span></div>}<main className="flex-1 p-3 sm:p-5 lg:p-7">{children}</main></SidebarInset></>;
}
