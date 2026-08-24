from pathlib import Path

path = Path('/home/ubuntu/proofloan-buidl/client/src/pages/Home.tsx')
text = path.read_text()
lines = text.splitlines()
replacement = '''            {replayRefreshTimeline.length > 0 && (
              <div className="mt-5 border-t border-white/10 pt-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Recent refresh attempts</h3>
                    <span className="text-[10px] text-slate-500">Last six · no identifiers</span>
                  </div>
                  <div className="flex rounded-full border border-white/10 p-0.5" role="group" aria-label="Filter refresh attempts">
                    <button type="button" aria-pressed={replayTimelineFilter === "all"} onClick={() => setReplayTimelineFilter("all")} className={`rounded-full px-2 py-1 text-[10px] font-semibold ${replayTimelineFilter === "all" ? "bg-white/10 text-white" : "text-slate-500"}`}>All</button>
                    <button type="button" aria-pressed={replayTimelineFilter === "failures"} onClick={() => setReplayTimelineFilter("failures")} className={`rounded-full px-2 py-1 text-[10px] font-semibold ${replayTimelineFilter === "failures" ? "bg-rose-400/15 text-rose-100" : "text-slate-500"}`}>Failures</button>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${replayRefreshTimelineSummary.status === "critical" ? "text-rose-200" : replayRefreshTimelineSummary.status === "watch" ? "text-amber-200" : "text-emerald-300"}`}>{replayRefreshTimelineSummary.failureRatePercent}% failed</div>
                    <div className="text-[10px] text-slate-500">{replayRefreshTimelineSummary.failures}/{replayRefreshTimelineSummary.attempts} attempts</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-semibold ${replayRefreshTrend.direction === "rising" ? "text-rose-200" : replayRefreshTrend.direction === "falling" ? "text-emerald-200" : "text-slate-300"}`}>{replayRefreshTrend.direction === "insufficient" ? "Trend pending" : replayRefreshTrend.direction === "rising" ? "Failure trend rising" : replayRefreshTrend.direction === "falling" ? "Failure trend falling" : "Failure trend flat"}</div>
                    {replayRefreshTrend.direction !== "insufficient" && <div className="text-[10px] text-slate-500">{replayRefreshTrend.priorFailureRatePercent}% → {replayRefreshTrend.recentFailureRatePercent}% · {replayRefreshTrend.confidence} confidence</div>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">{replayRefreshCategoryCounts.filter(item => item.count > 0).map(item => <span key={item.category} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-slate-400">{item.label}: {item.count}</span>)}</div>
                {filteredReplayRefreshTimeline.length === 0 ? <p className="mt-3 rounded-lg border border-dashed border-white/10 px-3 py-3 text-xs text-slate-500" role="status">No failed refresh attempts in the current window.</p> : <ol aria-label="Recent replay diagnostics refresh attempts" className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[...filteredReplayRefreshTimeline].reverse().map(event => <li key={event.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0d1622] px-3 py-2"><span className={`h-2 w-2 shrink-0 rounded-full ${event.outcome === "success" ? "bg-emerald-300" : "bg-rose-300"}`} /><span className="min-w-0 text-xs text-slate-300">{event.outcome === "success" ? "Refresh completed" : getReplayRefreshFailureLabel(event.category)}</span><time className="ml-auto shrink-0 text-[10px] text-slate-500">{formatReplayDiagnosticsTimestamp(event.occurredAt)}</time></li>)}</ol>}
              </div>
            )}'''.splitlines()
for index, line in enumerate(lines):
    if 'replayRefreshTimeline.length > 0 &&' in line:
        lines[index:index+1] = replacement
        break
else:
    raise SystemExit('timeline line not found')
path.write_text('\n'.join(lines) + '\n')
print('rewrote replay timeline JSX')
