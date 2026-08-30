import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Home() {
  return (
    <main
      className="relative min-h-[100dvh] overflow-hidden bg-background px-5 py-6 text-foreground sm:px-8 sm:py-8"
      data-testid="starter-page"
    >
      <div className="starter-grain absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-[calc(100dvh-3rem)] max-w-5xl flex-col sm:min-h-[calc(100dvh-4rem)]">
        <header
          className="flex items-center justify-between border-b border-border/80 pb-5"
          data-testid="starter-header"
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary text-sm font-bold text-primary-foreground shadow-sm"
              aria-hidden="true"
            >
              /
            </div>
            <span
              className="text-sm font-semibold tracking-[-0.01em]"
              data-testid="text-app-name"
            >
              Blank React App
            </span>
          </div>
          <div
            className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
            data-testid="status-ready"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent-foreground))]" />
            Ready
          </div>
        </header>

        <section className="starter-surface flex flex-1 flex-col justify-center py-16 sm:py-24">
          <div className="max-w-2xl">
            <p
              className="mb-5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-primary"
              data-testid="text-starter-label"
            >
              Starter surface
            </p>
            <h1
              className="max-w-xl text-[clamp(2.45rem,7vw,5.5rem)] font-semibold leading-[0.98] tracking-[-0.065em]"
              data-testid="text-starter-heading"
            >
              Your component
              <br />
              goes here.
            </h1>
            <p
              className="mt-7 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg"
              data-testid="text-starter-description"
            >
              This is a clean starting point for your React code. Replace the
              starter component below and the app is ready to take shape.
            </p>
          </div>

          <div
            className="mt-12 max-w-2xl overflow-hidden rounded-2xl border border-card-border bg-card shadow-[0_18px_45px_-30px_rgba(37,42,51,0.35)]"
            data-testid="code-panel"
          >
            <div className="flex items-center justify-between border-b border-card-border bg-secondary/45 px-4 py-3 sm:px-5">
              <span
                className="font-mono text-[11px] font-bold tracking-[0.03em] text-secondary-foreground"
                data-testid="text-component-path"
              >
                src/App.tsx
              </span>
              <span
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
                data-testid="text-replace-hint"
              >
                Replace this
              </span>
            </div>
            <pre
              className="starter-code overflow-x-auto px-4 py-5 font-mono text-[11px] leading-6 text-muted-foreground sm:px-5 sm:text-xs"
              data-testid="code-starter-example"
            >
              <code>
                <span className="text-muted-foreground">function </span>
                <span className="font-bold text-foreground">Home</span>
                <span className="text-muted-foreground">() {'{'}</span>
                {'\n  '}
                <span className="text-primary">return</span>
                <span className="text-muted-foreground"> (</span>
                {'\n    '}
                <span className="text-accent-foreground">&lt;main&gt;</span>
                {'\n      '}
                <span className="text-muted-foreground">
                  {'{/* Paste your component here */}'}
                </span>
                {'\n    '}
                <span className="text-accent-foreground">&lt;/main&gt;</span>
                {'\n  '}
                <span className="text-muted-foreground">);</span>
                {'\n'}
                <span className="text-muted-foreground">{'}'}</span>
              </code>
            </pre>
          </div>

          <p
            className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"
            data-testid="text-preserved-setup"
          >
            <span className="h-px w-5 bg-border" aria-hidden="true" />
            Routing and the error boundary are already wired.
          </p>
        </section>

        <footer
          className="flex flex-col gap-2 border-t border-border/80 pt-5 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
          data-testid="starter-footer"
        >
          <span>Nothing to configure before you begin.</span>
          <span className="font-mono tracking-[0.04em]">/</span>
        </footer>
      </div>
    </main>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
