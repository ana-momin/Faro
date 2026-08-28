import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Search from "./pages/Search";

// Profile, Settings, and ProductIntro each load on their own chunk instead of one shared bundle,
// so opening the app only downloads what the current page needs. Home and Search stay eager:
// Search statically imports PostDetailDialog/RequestCard from Home, so splitting either one off
// would not actually shrink the eager bundle (Rollup still has to pull the dependency in), and
// "/" and "/search" are the two most common first destinations anyway.
const Profile = lazy(() => import("./pages/Profile"));
const ProductIntro = lazy(() => import("./pages/ProductIntro"));
const Settings = lazy(() => import("./pages/Settings"));

function Router() {
  const [location] = useLocation();
  const pathname = location.split("?")[0];

  if (pathname === "/faro") return <Suspense fallback={null}><ProductIntro /></Suspense>;
  if (!pathname || !["/", "/search", "/settings", "/profile", "/saved", "/monitors", "/provider"].includes(pathname)) return <NotFound />;

  // The workspace shell remains mounted while only its page content changes.
  // This keeps the Faro mark, member image, and fixed sidebar stable in motion.
  return (
    <DashboardLayout>
      <Suspense fallback={<DashboardLayoutSkeleton />}>
        <Switch>
          <Route path={"/"} component={Home} />
          <Route path={"/search"} component={Search} />
          <Route path={"/settings"} component={Settings} />
          <Route path={"/profile"} component={Profile} />
          <Route path={"/saved"} component={Settings} />
          <Route path={"/monitors"} component={Settings} />
          <Route path={"/provider"} component={Settings} />
        </Switch>
      </Suspense>
    </DashboardLayout>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
