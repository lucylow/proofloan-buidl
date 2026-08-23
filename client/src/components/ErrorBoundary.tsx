import { reportClientError } from "@/lib/clientErrorReporter";
import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, Fragment, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryKey: number;
}

export function getNextRetryKey(currentKey: number): number {
  return Number.isSafeInteger(currentKey) && currentKey < Number.MAX_SAFE_INTEGER ? currentKey + 1 : 0;
}

export function getRuntimeErrorMessage(error: Error | null): string {
  const message = error?.message?.trim();
  return message && message.length <= 180 ? message : "The application encountered an unexpected problem.";
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    reportClientError("runtime", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main role="alert" aria-live="assertive" className="flex min-h-screen items-center justify-center bg-[#070b12] px-4 py-8 text-slate-100 sm:px-6">
          <section className="w-full max-w-lg rounded-3xl border border-rose-300/20 bg-[#0b121d] p-5 shadow-2xl shadow-black/30 sm:p-8">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-rose-400/10 text-rose-300"><AlertTriangle size={21} /></div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[.2em] text-rose-300">ProofLoan recovery</p>
                <h2 className="mt-2 text-xl font-bold text-white sm:text-2xl">The app needs a fresh start.</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">An unexpected problem interrupted this screen. Your saved credit-file data is not changed by this display error.</p>
              </div>
            </div>
            <p className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-500">{getRuntimeErrorMessage(this.state.error)}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => this.setState(previous => ({ hasError: false, error: null, retryKey: getNextRetryKey(previous.retryKey) }))} className={cn("min-h-11 rounded-xl border border-cyan-300/30 px-4 text-sm font-semibold text-cyan-200", "hover:bg-cyan-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300")}>Try again</button>
              <button type="button" onClick={() => window.location.reload()} className={cn("flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950", "hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300")}><RotateCcw size={16} /> Reload page</button>
            </div>
          </section>
        </main>
      );
    }

    return <Fragment key={this.state.retryKey}>{this.props.children}</Fragment>;
  }
}

export default ErrorBoundary;
