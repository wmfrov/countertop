import React, { useState, useEffect, useRef } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { RotateCcw, Minus } from 'lucide-react';

function useStickyState<T>(defaultValue: T, key: string): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stickyValue = window.localStorage.getItem(key);
      if (stickyValue === null) return defaultValue;
      const parsed = JSON.parse(stickyValue);
      // Guard against corrupted storage: only accept values matching the default type.
      return typeof parsed === typeof defaultValue ? (parsed as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

function Counter({ id, defaultLabel }: { id: string; defaultLabel: string }) {
  const [count, setCount] = useStickyState(0, `tally-count-${id}`);
  const [label, setLabel] = useStickyState(defaultLabel, `tally-label-${id}`);
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
    <div
      className="flex-1 flex flex-col h-full border-r last:border-r-0 border-border relative group cursor-pointer transition-colors hover:bg-white/[0.02] active:bg-white/[0.05]"
      onClick={handleIncrement}
    >
      <div className="absolute top-0 left-0 w-full p-2 z-10 flex items-center justify-between">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="bg-transparent border-none outline-none text-muted-foreground hover:text-foreground focus:text-foreground tracking-[0.2em] font-bold w-full transition-colors uppercase"
          style={{ fontSize: 'min(0.75rem, 10dvh)' }}
          placeholder="LABEL"
          spellCheck={false}
        />
      </div>

      <div className="mt-auto h-[20dvh] flex items-center justify-center pointer-events-none overflow-hidden">
        <span
          className="font-bold text-foreground tracking-tighter leading-none transition-transform"
          style={{
            fontSize: 'min(18dvh, 32dvw)',
            transform: isAnimating ? 'scale(0.92)' : 'scale(1)',
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

function Home() {
  return (
    <div className="h-[100dvh] w-full flex flex-row items-stretch bg-background">
      <Counter id="1" defaultLabel="LEFT" />
      <Counter id="2" defaultLabel="RIGHT" />
    </div>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={() => <div className="p-4 text-white">Not Found</div>} />
      </Switch>
    </WouterRouter>
  );
}

export default App;