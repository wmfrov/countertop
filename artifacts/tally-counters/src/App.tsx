import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Route, Switch, Router as WouterRouter } from "wouter";
import { RotateCcw, Minus, Plus, Settings, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/* ------------------------------------------------------------------ */
/* Config model + persistence                                          */
/* ------------------------------------------------------------------ */

type CounterConfig = {
  id: string;
  label: string;
  color: string;
  font: string;
};

type BoardConfig = {
  counters: CounterConfig[];
  numberHeight: number; // percentage of a counter cell's height (15–60)
};

const FONTS = [
  { key: "Roboto", label: "Roboto", stack: "'Roboto', sans-serif" },
  { key: "Inter", label: "Inter", stack: "'Inter', sans-serif" },
  { key: "Oswald", label: "Oswald (Condensed)", stack: "'Oswald', sans-serif" },
  { key: "Bebas Neue", label: "Bebas Neue", stack: "'Bebas Neue', sans-serif" },
  {
    key: "Poppins",
    label: "Poppins (Rounded)",
    stack: "'Poppins', sans-serif",
  },
  { key: "Rubik", label: "Rubik", stack: "'Rubik', sans-serif" },
  { key: "Space Mono", label: "Space Mono", stack: "'Space Mono', monospace" },
  {
    key: "Archivo Black",
    label: "Archivo Black",
    stack: "'Archivo Black', sans-serif",
  },
] as const;

const COLOR_PRESETS = [
  "#fafafa",
  "#f97316",
  "#22c55e",
  "#3b82f6",
  "#eab308",
  "#ec4899",
  "#a855f7",
  "#ef4444",
];

const DEFAULT_FONT = "Roboto";
const DEFAULT_COLOR = "#fafafa";
const DEFAULT_NUMBER_HEIGHT = 25;
const CONFIG_KEY = "tally-board-config-v1";

function fontStackFor(key: string): string {
  return FONTS.find((f) => f.key === key)?.stack ?? FONTS[0].stack;
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `c-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  }
}

function readLegacyLabel(id: string, fallback: string): string {
  try {
    const v = window.localStorage.getItem(`tally-label-${id}`);
    if (v === null) return fallback;
    const parsed = JSON.parse(v);
    return typeof parsed === "string" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function loadConfig(): BoardConfig {
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.counters)) {
        const counters: CounterConfig[] = parsed.counters
          .filter((c: unknown): c is Record<string, unknown> =>
            Boolean(c && typeof c === "object"),
          )
          .map((c: Record<string, unknown>) => ({
            id: typeof c.id === "string" ? c.id : newId(),
            label: typeof c.label === "string" ? c.label : "",
            color: typeof c.color === "string" ? c.color : DEFAULT_COLOR,
            font: typeof c.font === "string" ? c.font : DEFAULT_FONT,
          }));
        if (counters.length > 0) {
          const nh = Number(parsed.numberHeight);
          return {
            counters,
            numberHeight:
              Number.isFinite(nh) && nh >= 10 && nh <= 70
                ? nh
                : DEFAULT_NUMBER_HEIGHT,
          };
        }
      }
    }
  } catch {
    /* fall through to legacy migration */
  }

  // Migrate from the original two hardcoded counters so existing users keep data.
  return {
    counters: [
      {
        id: "1",
        label: readLegacyLabel("1", "LEFT"),
        color: DEFAULT_COLOR,
        font: DEFAULT_FONT,
      },
      {
        id: "2",
        label: readLegacyLabel("2", "RIGHT"),
        color: DEFAULT_COLOR,
        font: DEFAULT_FONT,
      },
    ],
    numberHeight: DEFAULT_NUMBER_HEIGHT,
  };
}

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

function useStickyState<T>(
  defaultValue: T,
  key: string,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stickyValue = window.localStorage.getItem(key);
      if (stickyValue === null) return defaultValue;
      const parsed = JSON.parse(stickyValue);
      return typeof parsed === typeof defaultValue
        ? (parsed as T)
        : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setSize({ width: rect.width, height: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size] as const;
}

/* ------------------------------------------------------------------ */
/* Counter                                                             */
/* ------------------------------------------------------------------ */

function Counter({
  config,
  numberHeight,
}: {
  config: CounterConfig;
  numberHeight: number;
}) {
  const [count, setCount] = useStickyState(0, `tally-count-${config.id}`);
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cellRef, cellSize] = useElementSize<HTMLDivElement>();

  const handleIncrement = () => {
    setCount((c) => c + 1);
    setIsAnimating(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsAnimating(false), 100);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCount((c) => Math.max(0, c - 1));
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCount(0);
  };

  // Scale the number to fill the chosen band height, capped so it never
  // overflows the column width (accounting for how many digits are shown).
  const bandHeightPx = cellSize.height * (numberHeight / 100);
  const digits = Math.max(1, String(count).length);
  const maxByHeight = bandHeightPx * 1.05;
  const maxByWidth = (cellSize.width * 0.9) / (digits * 0.6);
  const fontSize = Math.max(8, Math.min(maxByHeight, maxByWidth));

  return (
    <div
      ref={cellRef}
      className="flex flex-col h-full min-w-0 border-r border-b border-border relative group cursor-pointer overflow-hidden transition-colors hover:bg-white/[0.02] active:bg-white/[0.05]"
      onClick={handleIncrement}
      style={{ fontFamily: fontStackFor(config.font) }}
    >
      <div className="absolute top-0 left-0 w-full p-2 z-10">
        <div
          className="tracking-[0.2em] font-bold uppercase truncate"
          style={{
            color: config.color,
            opacity: 0.85,
            fontSize: "min(0.8rem, 3.5vw)",
          }}
        >
          {config.label || "\u00A0"}
        </div>
      </div>

      <div
        className="mt-auto flex items-center justify-center pointer-events-none overflow-hidden"
        style={{ height: `${numberHeight}%` }}
      >
        <span
          className="font-bold tracking-tighter leading-none transition-transform"
          style={{
            color: config.color,
            fontSize: `${fontSize}px`,
            transform: isAnimating ? "scale(0.92)" : "scale(1)",
          }}
        >
          {count}
        </span>
      </div>

      <div className="absolute bottom-2 right-2 flex gap-1 z-10 opacity-60 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          onClick={handleDecrement}
          className="p-1.5 md:p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
          title="Decrement"
        >
          <Minus size={16} strokeWidth={2.5} />
        </button>
        <button
          onClick={handleReset}
          className="p-1.5 md:p-2 text-muted-foreground hover:text-accent hover:bg-muted rounded transition-colors"
          title="Reset"
        >
          <RotateCcw size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Settings panel                                                      */
/* ------------------------------------------------------------------ */

function SettingsPanel({
  open,
  onOpenChange,
  config,
  setConfig,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: BoardConfig;
  setConfig: React.Dispatch<React.SetStateAction<BoardConfig>>;
}) {
  const updateCounter = (id: string, patch: Partial<CounterConfig>) => {
    setConfig((prev) => ({
      ...prev,
      counters: prev.counters.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    }));
  };

  const addCounter = () => {
    setConfig((prev) => ({
      ...prev,
      counters: [
        ...prev.counters,
        {
          id: newId(),
          label: `COUNTER ${prev.counters.length + 1}`,
          color: DEFAULT_COLOR,
          font: prev.counters[0]?.font ?? DEFAULT_FONT,
        },
      ],
    }));
  };

  const removeCounter = (id: string) => {
    setConfig((prev) => {
      if (prev.counters.length <= 1) return prev;
      return { ...prev, counters: prev.counters.filter((c) => c.id !== id) };
    });
    try {
      window.localStorage.removeItem(`tally-count-${id}`);
    } catch {
      /* ignore */
    }
  };

  const setAllFonts = (font: string) => {
    setConfig((prev) => ({
      ...prev,
      counters: prev.counters.map((c) => ({ ...c, font })),
    }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto flex flex-col gap-6"
      >
        <SheetHeader>
          <SheetTitle>Board Settings</SheetTitle>
          <SheetDescription>
            Manage counters and how the board looks. Everything is saved in your
            browser.
          </SheetDescription>
        </SheetHeader>

        {/* Global settings */}
        <section className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Global
          </h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Number height</span>
              <span className="text-muted-foreground tabular-nums">
                {config.numberHeight}%
              </span>
            </div>
            <Slider
              value={[config.numberHeight]}
              min={15}
              max={100}
              step={1}
              onValueChange={([v]) =>
                setConfig((prev) => ({ ...prev, numberHeight: v }))
              }
            />
          </div>

          <div className="space-y-2">
            <span className="text-sm">Font for all counters</span>
            <Select onValueChange={setAllFonts}>
              <SelectTrigger>
                <SelectValue placeholder="Apply a font to every counter…" />
              </SelectTrigger>
              <SelectContent>
                {FONTS.map((f) => (
                  <SelectItem
                    key={f.key}
                    value={f.key}
                    style={{ fontFamily: f.stack }}
                  >
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Counters */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Counters ({config.counters.length})
            </h3>
            <Button size="sm" variant="secondary" onClick={addCounter}>
              <Plus size={16} className="mr-1" /> Add
            </Button>
          </div>

          <div className="space-y-4">
            {config.counters.map((c, i) => (
              <div
                key={c.id}
                className="rounded-lg border border-border p-3 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={c.label}
                    onChange={(e) =>
                      updateCounter(c.id, { label: e.target.value })
                    }
                    placeholder={`Counter ${i + 1}`}
                    spellCheck={false}
                    className="h-8"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeCounter(c.id)}
                    disabled={config.counters.length <= 1}
                    title="Remove counter"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={c.color}
                    onChange={(e) =>
                      updateCounter(c.id, { color: e.target.value })
                    }
                    className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
                    title="Custom color"
                  />
                  <div className="flex flex-wrap gap-1">
                    {COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => updateCounter(c.id, { color: preset })}
                        className="h-6 w-6 rounded-full border border-border transition-transform hover:scale-110"
                        style={{ backgroundColor: preset }}
                        title={preset}
                      />
                    ))}
                  </div>
                </div>

                <Select
                  value={c.font}
                  onValueChange={(font) => updateCounter(c.id, { font })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTS.map((f) => (
                      <SelectItem
                        key={f.key}
                        value={f.key}
                        style={{ fontFamily: f.stack }}
                      >
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </section>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Board                                                               */
/* ------------------------------------------------------------------ */

function Home() {
  const [config, setConfig] = useState<BoardConfig>(loadConfig);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch {
      /* ignore quota / private mode errors */
    }
  }, [config]);

  const count = config.counters.length;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);

  return (
    <div className="h-[100dvh] w-full bg-background relative">
      <div
        className="h-full w-full grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {config.counters.map((c) => (
          <Counter key={c.id} config={c} numberHeight={config.numberHeight} />
        ))}
      </div>

      <button
        onClick={() => setSettingsOpen(true)}
        className="absolute top-2 right-2 z-20 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors opacity-50 hover:opacity-100"
        title="Settings"
      >
        <Settings size={20} strokeWidth={2} />
      </button>

      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        config={config}
        setConfig={setConfig}
      />
    </div>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Switch>
        <Route path="/" component={Home} />
        <Route
          component={() => <div className="p-4 text-white">Not Found</div>}
        />
      </Switch>
    </WouterRouter>
  );
}

export default App;
