import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import ProductIntro from "./pages/ProductIntro";
import Search from "./pages/Search";
import Settings from "./pages/Settings";

function Router() {
  const [location] = useLocation();
  const pathname = location.split("?")[0];

  if (pathname === "/faro") return <ProductIntro />;
  if (!pathname || !["/", "/search", "/settings", "/profile", "/saved", "/monitors", "/provider"].includes(pathname)) return <NotFound />;

  // The workspace shell remains mounted while only its page content changes.
  // This keeps the Faro mark, member image, and fixed sidebar stable in motion.
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/search"} component={Search} />
        <Route path={"/settings"} component={Settings} />
        <Route path={"/profile"} component={Profile} />
        <Route path={"/saved"} component={Settings} />
        <Route path={"/monitors"} component={Settings} />
        <Route path={"/provider"} component={Settings} />
      </Switch>
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
