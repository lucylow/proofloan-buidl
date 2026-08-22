import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
const Home = lazy(() => import("./pages/Home"));

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function AppLoadingScreen() {
  return <main role="status" aria-live="polite" className="grid min-h-screen place-items-center bg-[#070b12] px-6 text-center text-slate-100"><div><div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-2xl bg-cyan-300/80" /><p className="font-semibold">Loading ProofLoan</p><p className="mt-2 text-sm text-slate-500">Preparing your verifiable credit file.</p></div></main>;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Suspense fallback={<AppLoadingScreen />}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
