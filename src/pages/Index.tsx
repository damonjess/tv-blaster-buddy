import { useEffect, useState, useRef } from "react";
import { Power, Wifi, WifiOff, Trash2, ChevronDown, Square, Star } from "lucide-react";
import { IR } from "@/lib/ir-plugin";
import { BRANDS, PROTOCOL_TIMING, POWER_OFF_CODES, type Brand } from "@/lib/tv-codes";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LogEntry {
  id: number;
  time: string;
  type: "info" | "error" | "success";
  message: string;
}

const LAST_BRAND_KEY = "tvoff:lastBrand";

const Index = () => {
  const [hasIR, setHasIR] = useState<boolean | null>(null);
  const [irReason, setIrReason] = useState<string | null>(null);
  const [irInfo, setIrInfo] = useState<any>(null);
  const [firing, setFiring] = useState(false);
  const [currentBrand, setCurrentBrand] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const [showBrands, setShowBrands] = useState(false);
  const [lastBrand, setLastBrand] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const cancelRef = useRef(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    const newLog = {
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      type,
      message,
    };
    setLogs((prev) => [newLog, ...prev].slice(0, 100));
  };

  useEffect(() => {
    document.title = "TV-Off · One-tap universal power off";
    const saved = localStorage.getItem(LAST_BRAND_KEY);
    if (saved) setLastBrand(saved);
    addLog("App initialized. Checking hardware...");

    IR.hasIR()
      .then((r) => {
        setHasIR(!!r?.hasIR);
        setIrInfo(r);
        if (r?.hasIR) {
          addLog(`IR Blaster found! Supported ranges: ${JSON.stringify(r.frequencies)}`, "success");
        } else if (r?.exists) {
          const msg = "Infrared service exists, but this device won't expose the emitter — it may be locked by the manufacturer (common on Honor/Huawei) or blocked by permissions.";
          setIrReason(msg);
          addLog(msg, "error");
        } else {
          const msg = "No infrared transmitter on this device (ConsumerIrManager unavailable).";
          setIrReason(msg);
          addLog(msg, "error");
        }
      })
      .catch((err) => {
        setHasIR(false);
        const msg = `Hardware check failed: ${err?.message || err}. This usually means the IR permission was denied.`;
        setIrReason(msg);
        addLog(msg, "error");
      });
  }, []);

  const clearLogs = () => setLogs([]);

  // Fire a single code, repeating it per its protocol's cadence.
  const fireCode = async (code: (typeof POWER_OFF_CODES)[number]["code"]) => {
    const timing = PROTOCOL_TIMING[code.protocol ?? "nec"];
    await IR.transmitMany({
      codes: Array.from({ length: timing.repeat }, () => code),
      gapMs: timing.gapMs,
    });
  };

  const fireBrands = async (brands: Brand[], persistWinner = false) => {
    if (firing) return;
    if (hasIR === false) {
      toast({
        title: "No IR blaster detected",
        description: irReason ?? "This device doesn't expose an infrared transmitter.",
        variant: "destructive",
      });
      addLog("Fire aborted: No IR hardware.", "error");
      return;
    }

    cancelRef.current = false;
    setFiring(true);
    setProgress(0);
    addLog(`Starting transmission for ${brands.length} brand(s)...`);

    try {
      for (let i = 0; i < brands.length; i++) {
        if (cancelRef.current) {
          addLog("Transmission cancelled by user.", "info");
          break;
        }
        const brand = brands[i];
        setCurrentBrand(brand.name);
        setProgress(Math.round((i / brands.length) * 100));

        for (const code of brand.codes) {
          if (cancelRef.current) break;
          try {
            await fireCode(code);
          } catch (e: any) {
            addLog(`Bridge error (${brand.name}): ${e?.message || e}`, "error");
          }
        }
        addLog(`Sent ${brand.name} (${brand.codes.length} code${brand.codes.length > 1 ? "s" : ""})`, "info");
        await new Promise((r) => setTimeout(r, 80));
      }

      if (!cancelRef.current) {
        setProgress(100);
        addLog("Transmission sequence complete.", "success");
        if (persistWinner && brands.length === 1) {
          localStorage.setItem(LAST_BRAND_KEY, brands[0].name);
          setLastBrand(brands[0].name);
          toast({ title: `${brands[0].name} sent`, description: "Saved as your TV — it'll fire first next time." });
        } else {
          toast({ title: "Done", description: "Sent power-off sequence." });
        }
      }
    } finally {
      setFiring(false);
      setCurrentBrand(null);
      setTimeout(() => setProgress(0), 800);
    }
  };

  // Fire-all: last successful brand first, then the rest.
  const fireAll = () => {
    const ordered = lastBrand
      ? [...BRANDS].sort((a, b) => (a.name === lastBrand ? -1 : b.name === lastBrand ? 1 : 0))
      : BRANDS;
    fireBrands(ordered);
  };

  const stop = () => {
    cancelRef.current = true;
    addLog("Stop requested...", "info");
  };

  const onPower = () => {
    if (firing) stop();
    else fireAll();
  };

  // Long-press the logo to reveal the developer debug console.
  const startLongPress = () => {
    longPressRef.current = setTimeout(() => setShowDebug((v) => !v), 700);
  };
  const cancelLongPress = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground flex flex-col">
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_50%_0%,hsl(var(--primary)/0.12),transparent_70%)]" />

      <header className="relative z-10 flex items-center justify-between px-6 pt-8 shrink-0">
        <button
          onPointerDown={startLongPress}
          onPointerUp={cancelLongPress}
          onPointerLeave={cancelLongPress}
          className="flex items-center gap-2 select-none"
          aria-label="TV-Off"
        >
          <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
          <span className="text-sm font-medium tracking-widest text-muted-foreground uppercase">TV-OFF</span>
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
      </header>

      <div className="flex-1 overflow-y-auto relative z-10">
        <section className="mx-auto flex max-w-md flex-col items-center px-6 pt-12 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">One tap. All TVs off.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Cycles through codes for {BRANDS.length} brands using your hardware.
          </p>

          <button
            onClick={onPower}
            aria-label={firing ? "Stop transmission" : "Power off all TVs"}
            className={cn(
              "group relative mt-12 flex h-60 w-60 items-center justify-center rounded-full",
              "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
              "shadow-[0_0_60px_-10px_hsl(var(--primary)/0.7),inset_0_-8px_24px_hsl(0_0%_0%/0.35)]",
              "transition-all duration-200 active:scale-95",
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
            {firing ? <Square className="h-20 w-20" strokeWidth={2} /> : <Power className="h-24 w-24" strokeWidth={2} />}
          </button>

          <div className="mt-8 h-16 w-full">
            {firing ? (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-widest text-muted-foreground truncate px-4">
                  Sending · {currentBrand} · tap to stop
                </div>
                <div className="mx-auto h-1 w-56 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary transition-all duration-150" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground px-10">
                {lastBrand
                  ? `Point the top edge at your TV. ${lastBrand} fires first.`
                  : "Point the top edge of your phone at the TV and hold steady."}
              </p>
            )}
          </div>

          {/* Per-brand converge list */}
          <div className="w-full mt-4 mb-10">
            <button
              onClick={() => setShowBrands((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card/40 px-4 py-3 text-sm backdrop-blur hover:bg-card/60 transition-colors"
            >
              <span>Try a single brand</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", showBrands && "rotate-180")} />
            </button>

            {showBrands && (
              <div className="mt-2 grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                {BRANDS.map((brand) => (
                  <button
                    key={brand.name}
                    disabled={firing}
                    onClick={() => fireBrands([brand], true)}
                    className={cn(
                      "flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 text-sm text-left backdrop-blur transition-colors",
                      "hover:bg-card/60 disabled:opacity-50",
                      lastBrand === brand.name && "border-primary/60 bg-primary/10"
                    )}
                  >
                    <span className="truncate">
                      {brand.name}
                      {brand.shared && <span className="ml-1 text-[10px] text-muted-foreground/70">·shared</span>}
                    </span>
                    {lastBrand === brand.name && <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {showDebug && (
          <div className="mx-auto max-w-md px-6 mb-20 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="rounded-xl border border-border bg-card/50 backdrop-blur-xl overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
                <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">
                  Hardware Debug Console
                </span>
                <button onClick={clearLogs} className="p-1 hover:text-destructive transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              <ScrollArea className="h-64 p-4 font-mono text-[10px] leading-tight">
                <div className="space-y-2">
                  {logs.length === 0 && <div className="text-muted-foreground italic text-center py-8">No logs yet...</div>}
                  {logs.map((log) => (
                    <div key={log.id} className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">[{log.time}]</span>
                      <span
                        className={cn(
                          "break-words",
                          log.type === "error" ? "text-destructive" : log.type === "success" ? "text-emerald-400" : "text-foreground/80"
                        )}
                      >
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="px-4 py-2 bg-muted/20 border-t border-border flex flex-wrap gap-2">
                <div className="text-[9px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                  Frequencies: {irInfo?.frequencies?.length || 0} ranges
                </div>
                <div className="text-[9px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                  Codes: {POWER_OFF_CODES.length}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="shrink-0 pb-6 pt-2 px-6 text-center text-[10px] text-muted-foreground/60">
        Requires Android hardware with IR support · long-press the logo for diagnostics.
      </footer>
    </main>
  );
};

export default Index;
