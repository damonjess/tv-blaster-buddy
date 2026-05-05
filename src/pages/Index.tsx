import { useEffect, useState } from "react";
import { Power, Wifi, WifiOff } from "lucide-react";
import { IR } from "@/lib/ir-plugin";
import { POWER_OFF_CODES } from "@/lib/tv-codes";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [hasIR, setHasIR] = useState<boolean | null>(null);
  const [firing, setFiring] = useState(false);
  const [currentBrand, setCurrentBrand] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    document.title = "TV-Off · One-tap universal power off";
    IR.hasIR()
      .then((r) => setHasIR(!!r?.hasIR))
      .catch(() => setHasIR(false));
  }, []);

  const fire = async () => {
    if (firing) return;
    if (hasIR === false) {
      toast({
        title: "No IR blaster detected",
        description: "This device doesn't expose an infrared transmitter.",
        variant: "destructive",
      });
      return;
    }
    setFiring(true);
    setProgress(0);
    try {
      for (let i = 0; i < POWER_OFF_CODES.length; i++) {
        const { brand, code } = POWER_OFF_CODES[i];
        setCurrentBrand(brand);
        setProgress(Math.round(((i + 1) / POWER_OFF_CODES.length) * 100));
        try {
          await IR.transmit(code);
        } catch {
          /* keep going */
        }
        await new Promise((r) => setTimeout(r, 120));
      }
      toast({ title: "Done", description: "Sent power-off codes for all brands." });
    } finally {
      setFiring(false);
      setCurrentBrand(null);
      setTimeout(() => setProgress(0), 800);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_50%_0%,hsl(var(--primary)/0.12),transparent_70%)]" />

      <header className="relative z-10 flex items-center justify-between px-6 pt-8">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
          <span className="text-sm font-medium tracking-widest text-muted-foreground">TV-OFF</span>
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs backdrop-blur",
            hasIR === false && "text-destructive"
          )}
        >
          {hasIR ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {hasIR === null ? "Checking IR…" : hasIR ? "IR Ready" : "No IR"}
        </div>
      </header>

      <section className="relative z-10 mx-auto flex max-w-md flex-col items-center px-6 pt-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">One tap. All TVs off.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Cycles through power-off codes for {POWER_OFF_CODES.length}+ major TV brands using your phone's IR blaster.
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

        <div className="mt-10 h-12 w-full">
          {firing ? (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
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
            <p className="text-xs text-muted-foreground">
              Point the top edge of your phone at the TV, then tap.
            </p>
          )}
        </div>
      </section>

      <footer className="absolute bottom-6 left-0 right-0 px-6 text-center text-[11px] text-muted-foreground/70">
        Requires an Android device with an IR blaster.
      </footer>
    </main>
  );
};

export default Index;
