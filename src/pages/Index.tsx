import { useEffect, useState, useRef } from "react";
import { Power, Wifi, WifiOff, Terminal, Trash2 } from "lucide-react";
import { IR } from "@/lib/ir-plugin";
import { POWER_OFF_CODES } from "@/lib/tv-codes";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LogEntry {
  id: number;
  time: string;
  type: "info" | "error" | "success";
  message: string;
}

const Index = () => {
  const [hasIR, setHasIR] = useState<boolean | null>(null);
  const [irInfo, setIrInfo] = useState<any>(null);
  const [firing, setFiring] = useState(false);
  const [currentBrand, setCurrentBrand] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const { toast } = useToast();

  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    const newLog = {
      id: Date.now(),
      time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type,
      message,
    };
    setLogs(prev => [newLog, ...prev].slice(0, 100));
  };

  useEffect(() => {
    document.title = "TV-Off · One-tap universal power off";
    addLog("App initialized. Checking hardware...");

    IR.hasIR()
      .then((r) => {
        setHasIR(!!r?.hasIR);
        setIrInfo(r);
        if (r?.hasIR) {
          addLog(`IR Blaster found! Supported ranges: ${JSON.stringify(r.frequencies)}`, "success");
        } else {
          addLog(r?.exists ? "Hardware reported no IR emitter." : "IR Manager not available.", "error");
        }
      })
      .catch((err) => {
        setHasIR(false);
        addLog(`Hardware check failed: ${err.message || err}`, "error");
      });
  }, []);

  const clearLogs = () => setLogs([]);

  const fire = async () => {
    if (firing) return;
    if (hasIR === false) {
      toast({
        title: "No IR blaster detected",
        description: "This device doesn't expose an infrared transmitter.",
        variant: "destructive",
      });
      addLog("Fire aborted: No IR hardware.", "error");
      return;
    }

    setFiring(true);
    setProgress(0);
    addLog(`Starting transmission of ${POWER_OFF_CODES.length} codes...`);

    try {
      const CHUNK_SIZE = 4;
      for (let i = 0; i < POWER_OFF_CODES.length; i += CHUNK_SIZE) {
        const chunk = POWER_OFF_CODES.slice(i, i + CHUNK_SIZE);
        const brands = chunk.map(c => c.brand).join(", ");
        setCurrentBrand(brands);
        setProgress(Math.round((i / POWER_OFF_CODES.length) * 100));

        try {
          const result = await IR.transmitMany({
            codes: chunk.map(c => c.code),
            gapMs: 150
          });

          if ((result as any).error) {
            addLog(`Error in chunk ${i/CHUNK_SIZE + 1}: ${(result as any).error}`, "error");
          } else {
            addLog(`Sent chunk ${i/CHUNK_SIZE + 1} (${chunk.length} codes)`, "info");
          }
        } catch (e: any) {
          addLog(`Bridge error: ${e.message || e}`, "error");
        }

        await new Promise((r) => setTimeout(r, 100));
      }
      setProgress(100);
      addLog("Transmission sequence complete.", "success");
      toast({ title: "Done", description: "Sent power-off sequence to all brands." });
    } finally {
      setFiring(false);
      setCurrentBrand(null);
      setTimeout(() => setProgress(0), 800);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground flex flex-col">
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_50%_0%,hsl(var(--primary)/0.12),transparent_70%)]" />

      <header className="relative z-10 flex items-center justify-between px-6 pt-8 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
          <span className="text-sm font-medium tracking-widest text-muted-foreground uppercase">TV-OFF</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs backdrop-blur hover:bg-card/60 transition-colors"
          >
            <Terminal className="h-3.5 w-3.5" />
            Debug
          </button>
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs backdrop-blur",
              hasIR === false && "text-destructive"
            )}
          >
            {hasIR ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {hasIR === null ? "Checking..." : hasIR ? "IR Ready" : "No IR"}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto relative z-10">
        <section className="mx-auto flex max-w-md flex-col items-center px-6 pt-16 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">One tap. All TVs off.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Cycles through codes for {POWER_OFF_CODES.length} brands using your hardware.
          </p>

          <button
            onClick={fire}
            disabled={firing}
            aria-label="Power off all TVs"
            className={cn(
              "group relative mt-16 flex h-64 w-64 items-center justify-center rounded-full",
              "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
              "shadow-[0_0_60px_-10px_hsl(var(--primary)/0.7),inset_0_-8px_24px_hsl(0_0%_0%/0.35)]",
              "transition-all duration-200 active:scale-95",
              "disabled:opacity-90",
              firing && "animate-pulse"
            )}
          >
            <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/10" />
            <span
              className={cn(
                "absolute -inset-3 rounded-full border border-[hsl(var(--primary)/0.5)]",
                firing && "animate-ping"
              )}
            />
            <Power className="h-24 w-24" strokeWidth={2} />
          </button>

          <div className="mt-10 h-16 w-full">
            {firing ? (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-widest text-muted-foreground truncate px-4">
                  Sending · {currentBrand}
                </div>
                <div className="mx-auto h-1 w-56 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-primary transition-all duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground px-10">
                Point the top edge of your phone at the TV and hold steady.
              </p>
            )}
          </div>
        </section>

        {showDebug && (
          <div className="mx-auto max-w-md px-6 mt-8 mb-20 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="rounded-xl border border-border bg-card/50 backdrop-blur-xl overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
                <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground flex items-center gap-1.5">
                  <Terminal className="w-3 h-3" /> Hardware Debug Console
                </span>
                <button onClick={clearLogs} className="p-1 hover:text-destructive transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              <ScrollArea className="h-64 p-4 font-mono text-[10px] leading-tight">
                <div className="space-y-2">
                  {logs.length === 0 && <div className="text-muted-foreground italic text-center py-8">No logs yet...</div>}
                  {logs.map(log => (
                    <div key={log.id} className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">[{log.time}]</span>
                      <span className={cn(
                        "break-words",
                        log.type === "error" ? "text-destructive" : log.type === "success" ? "text-emerald-400" : "text-foreground/80"
                      )}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="px-4 py-2 bg-muted/20 border-t border-border flex flex-wrap gap-2">
                <div className="text-[9px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                  Frequencies: {irInfo?.frequencies?.length || 0} ranges found
                </div>
                <div className="text-[9px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                  Device: {navigator.userAgent.split(';')[1]?.trim() || 'Android'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="shrink-0 pb-6 pt-2 px-6 text-center text-[10px] text-muted-foreground/60">
        Requires Android hardware with IR support. {POWER_OFF_CODES.length} codes in database.
      </footer>
    </main>
  );
};

export default Index;
