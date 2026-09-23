'use dom';

import { useEffect, useMemo, useRef, useState } from "react";
import type { DOMProps } from "expo/dom";
import { ExsurgeGabcNotationRenderer } from "../lib/exsurge-notation-renderer";

interface GabcNotationProps {
  source: string;
  label: string;
  dom?: DOMProps;
}

export default function GabcNotation({ source, label }: GabcNotationProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const renderer = useMemo(() => new ExsurgeGabcNotationRenderer(), []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let active = true;
    let lastWidth = 0;

    const render = async () => {
      const nextWidth =
        host.getBoundingClientRect().width ||
        document.documentElement.clientWidth ||
        window.innerWidth;

      if (Math.abs(nextWidth - lastWidth) < 2 && host.childElementCount > 0) return;
      lastWidth = nextWidth;

      try {
        const svg = await renderer.render(source, nextWidth);
        if (!active) return;
        host.innerHTML = svg;
        setError(null);
      } catch (caught) {
        if (!active) return;
        host.replaceChildren();
        setError(caught instanceof Error ? caught.message : "Notation rendering failed.");
      }
    };

    void render();

    const observer = new ResizeObserver(() => {
      void render();
    });
    observer.observe(host);

    return () => {
      active = false;
      observer.disconnect();
      host.replaceChildren();
    };
  }, [renderer, source]);

  return (
    <section aria-label={label} style={styles.shell}>
      <div ref={hostRef} style={styles.score} />
      {error ? (
        <p role="status" style={styles.error}>
          The derived score could not be rendered. The canonical GABC source remains available below.
        </p>
      ) : null}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    width: "100%",
    minWidth: 0,
    background: "#fff",
    color: "#201d18",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  score: {
    width: "100%",
    minHeight: 136,
    overflow: "hidden",
  },
  error: {
    margin: "10px 0 0",
    color: "#7c3028",
    fontSize: 13,
    lineHeight: 1.45,
  },
};
