import { useAuth } from "@/_core/hooks/useAuth";
import FaroLogo from "@/components/FaroLogo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import Onboarding from "@/pages/Onboarding";
import { useIsMobile } from "@/hooks/useMobile";
import { useWarmProfileImage } from "@/hooks/useWarmProfileImage";
import { PRODUCT_INTRO_PATH } from "@/lib/productIntro";
import { CircleUserRound, Compass, History, LogOut, MoreHorizontal, Search, Settings2, UserRound } from "lucide-react";
import { CSSProperties } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: Compass, label: "Feed", path: "/" },
  { icon: Search, label: "Search", path: "/search" },
  { icon: History, label: "History", path: "/monitors" },
  { icon: Settings2, label: "Settings", path: "/settings" },
  { icon: UserRound, label: "Profile", path: "/profile" },
];
const DEFAULT_WIDTH = 248;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  useWarmProfileImage(user?.avatarUrl);
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <Onboarding />;
  return <SidebarProvider style={{ "--sidebar-width": `${DEFAULT_WIDTH}px`, "--sidebar-width-icon": "4.5rem" } as CSSProperties}><DashboardLayoutContent>{children}</DashboardLayoutContent></SidebarProvider>;
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { state } = useSidebar();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const activeLabel = menuItems.find(item => item.path === location)?.label ?? (["/saved", "/monitors", "/provider"].includes(location.split("?")[0]) ? "Settings" : "Faro AI");
  const collapsed = state === "collapsed";
  return <><Sidebar collapsible="icon" className="border-r border-[#eadfd2] bg-[#fffdfa]"><SidebarHeader className={`h-[112px] justify-center ${collapsed ? "items-center px-0" : ""}`}><div className={`flex w-full ${collapsed ? "justify-center px-0" : "justify-center px-3"}`}><button onClick={() => setLocation(PRODUCT_INTRO_PATH)} className="rounded-2xl outline-none transition hover:scale-[1.02] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[#bd674c]" title="About Faro AI" aria-label="Open Faro AI product introduction"><FaroLogo compact={collapsed} className="[&>span:first-child]:h-11 [&>span:first-child]:w-11 [&>span:first-child]:rounded-[14px] [&>span:last-child]:text-[24px]" /></button></div></SidebarHeader><SidebarContent className={collapsed ? "px-3" : "px-2"}><SidebarMenu className={`mt-2 ${collapsed ? "flex items-center" : ""}`}>{menuItems.map(item => <SidebarMenuItem key={item.path} className={collapsed ? "flex w-full justify-center" : ""}><SidebarMenuButton isActive={location.split("?")[0] === item.path} onClick={() => setLocation(item.path)} tooltip={item.label} className={`rounded-xl text-[#4b3b2f] transition-transform data-[active=true]:bg-[#f1d7b9] data-[active=true]:text-[#75432e] data-[active=true]:shadow-[inset_0_0_0_1px_rgba(185,105,77,0.16)] ${collapsed ? "!h-11 !w-11 !justify-center !px-0 data-[active=true]:-translate-x-1" : "!h-10 !w-full !justify-start !gap-3 !px-3"}`}><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarContent><SidebarFooter className={collapsed ? "p-3" : "p-3"}><div className={`mb-2 flex px-1 ${collapsed ? "justify-center" : "justify-end"}`}><SidebarTrigger className="h-8 w-8 rounded-xl border border-[#eadfd2] bg-white text-[#85533d] hover:bg-[#fff4e8]" aria-label={collapsed ? "Expand sidebar" : "Minimize sidebar"} title={collapsed ? "Expand sidebar" : "Minimize sidebar"} /></div><DropdownMenu><DropdownMenuTrigger asChild><button className={`flex w-full items-center gap-2.5 rounded-xl py-1.5 text-left transition hover:bg-[#fbf2e5] active:scale-[0.98] ${collapsed ? "justify-center px-0" : "px-1"}`} aria-label="Open account actions" title="Account actions"><Avatar className="h-8 w-8 shrink-0"><AvatarImage src={user?.avatarUrl || undefined} alt={user?.name || "Faro member"} /><AvatarFallback className="bg-[#f8e4c8] text-[11px] font-semibold text-[#9c573f]">{user?.name?.charAt(0).toUpperCase() || "F"}</AvatarFallback></Avatar><div className={`min-w-0 flex-1 ${collapsed ? "hidden" : ""}`}><p className="truncate text-xs font-semibold">{user?.name || "Faro member"}</p><p className="truncate text-[10px] text-muted-foreground">{user?.email || "Private account"}</p></div><MoreHorizontal className={`h-4 w-4 shrink-0 text-[#a07862] ${collapsed ? "hidden" : ""}`} aria-hidden="true" /></button></DropdownMenuTrigger><DropdownMenuContent side="top" align="end" className="w-56 rounded-2xl border-[#eadfd2] bg-[#fffdfa] p-1.5 shadow-[0_16px_34px_rgba(82,48,27,0.14)]"><DropdownMenuLabel className="px-3 py-2"><span className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#9c7561]"><CircleUserRound className="h-3.5 w-3.5" />Account</span></DropdownMenuLabel><DropdownMenuItem onClick={() => setLocation("/profile")} className="rounded-xl px-3 py-2 text-xs font-bold text-[#563b2d]"><UserRound className="mr-2 h-4 w-4" />Open Profile</DropdownMenuItem><DropdownMenuSeparator className="my-1 bg-[#eadfd2]" /><DropdownMenuItem onClick={logout} className="rounded-xl px-3 py-2 text-xs font-bold text-[#a14941]"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu></SidebarFooter></Sidebar><SidebarInset>{isMobile && <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#eadfd2] bg-[#fffdfa]/95 px-3 backdrop-blur"><div className="flex items-center gap-2"><SidebarTrigger className="h-9 w-9" /><button onClick={() => setLocation(PRODUCT_INTRO_PATH)} className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#bd674c]" aria-label="Open Faro AI product introduction"><FaroLogo /></button></div><span className="text-xs font-semibold text-[#856d5b]">{activeLabel}</span></div>}<main className="flex-1 p-3 sm:p-5 lg:p-7">{children}</main></SidebarInset></>;
}
