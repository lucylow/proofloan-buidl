from pathlib import Path

path = Path('/home/ubuntu/proofloan-buidl/client/src/pages/Home.tsx')
lines = path.read_text().splitlines()
start = next(i for i, line in enumerate(lines) if 'authQuery.data?.role === "admin" && <section' in line)
end = start
while '</section>}' not in lines[end]:
    end += 1
replacement = '''        {authQuery.data?.role === "admin" && (
          <section aria-label="Replay protection health" className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/80">Operator health</div>
                <h2 className="mt-1 text-lg font-bold text-white">Replay protection</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">Read-only counts; identifiers and payloads stay hidden.</p>
              </div>
              <div className="flex items-start gap-3">
                {safeReplayDiagnostics && <div className="text-right text-[11px] text-slate-500">Updated {formatReplayDiagnosticsTimestamp(safeReplayDiagnostics.generatedAt)}<div className={replayDiagnosticsFreshness === "fresh" ? "text-emerald-300" : "text-amber-200"}>{replayDiagnosticsFreshness === "fresh" ? "Current" : replayDiagnosticsFreshness === "future" ? "Clock skew detected" : "Refresh required"}</div></div>}
                <Button type="button" variant="outline" aria-label={replayDiagnosticsRefresh.label} disabled={!replayDiagnosticsRefresh.enabled} onClick={refreshReplayDiagnostics} className="min-h-9 rounded-lg border-white/15 px-3 text-xs text-slate-200 hover:bg-white/5 disabled:opacity-60"><RefreshCw size={13} className={replayDiagnostics.isFetching ? "animate-spin" : undefined} /> {replayDiagnosticsRefresh.label}</Button>
              </div>
            </div>
            {replayDiagnostics.isLoading && <p className="mt-4 text-xs text-slate-400">Loading protected diagnostics…</p>}
            {replayDiagnostics.error && <p role="alert" className="mt-4 text-xs text-rose-200">Replay diagnostics are temporarily unavailable.</p>}
            {replayDiagnostics.data && !safeReplayDiagnostics && <p role="alert" className="mt-4 text-xs text-amber-100">Replay diagnostics returned an invalid payload and are being withheld.</p>}
            {safeReplayDiagnostics && <div className="mt-4 grid gap-3 sm:grid-cols-2">{getReplayDiagnosticsRows(safeReplayDiagnostics, replayDiagnosticsFreshness).map(row => <div key={row.label} className="rounded-xl border border-white/10 bg-[#0d1622] p-3"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-slate-200">{row.label}</span><span className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${row.tone === "attention" ? "text-amber-200" : "text-emerald-300"}`}>{row.tone === "attention" ? "Attention" : "Clear"}</span></div><div className="mt-3 flex items-end justify-between"><div><div className="text-2xl font-black text-white">{row.pending}</div><div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Pending</div></div><div className="text-right"><div className="text-lg font-bold text-cyan-200">{row.stale}</div><div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Stale</div></div></div></div>)}</div>}
          </section>
        )}'''.splitlines()
path.write_text('\n'.join(lines[:start] + replacement + lines[end + 1:]) + '\n')
