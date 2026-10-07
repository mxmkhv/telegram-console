import { useStdout } from "ink";
import { useEffect, useState } from "react";

export interface TerminalSize {
  columns: number;
  /** Rows the app may fill: one less than the terminal has */
  rows: number;
}

// A frame as tall as the terminal makes Ink clear the whole screen on every
// render, so each typing ping or flash flickers. One row shorter, it rewrites
// only the lines that changed.
const usableRows = (rows: number | undefined) => Math.max(1, (rows ?? 24) - 1);

export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout();
  const [size, setSize] = useState<TerminalSize>({
    columns: stdout?.columns ?? 80,
    rows: usableRows(stdout?.rows),
  });

  useEffect(() => {
    if (!stdout) return;
    const onResize = () => {
      setSize({ columns: stdout.columns ?? 80, rows: usableRows(stdout.rows) });
    };
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  return size;
}
