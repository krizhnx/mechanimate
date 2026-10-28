import { useCallback, useEffect, useRef, useState } from "react";

/** requestAnimationFrame-driven playback clock for the simulation. */
export function useClock(duration: number) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const tRef = useRef(0);
  const target = useRef<number | null>(null);
  const durRef = useRef(duration);
  durRef.current = duration;

  const set = useCallback((v: number) => {
    tRef.current = v;
    setT(v);
  }, []);

  useEffect(() => {
    if (tRef.current > duration) set(duration);
  }, [duration, set]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let nt = tRef.current + dt * rate;
      if (target.current !== null && nt >= target.current) {
        nt = target.current;
        target.current = null;
        set(nt);
        setPlaying(false);
        return;
      }
      if (nt >= durRef.current) {
        if (loop) nt = 0;
        else {
          set(durRef.current);
          setPlaying(false);
          return;
        }
      }
      set(nt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, rate, loop, set]);

  const play = useCallback(() => {
    target.current = null;
    if (tRef.current >= durRef.current - 1e-6) set(0);
    setPlaying(true);
  }, [set]);
  const pause = useCallback(() => {
    target.current = null;
    setPlaying(false);
  }, []);
  const seek = useCallback(
    (v: number) => {
      target.current = null;
      set(Math.max(0, Math.min(durRef.current, v)));
    },
    [set]
  );
  const restart = useCallback(() => {
    target.current = null;
    set(0);
    setPlaying(true);
  }, [set]);
  /** replay from the start and stop at a given moment ("watch it happen") */
  const playTo = useCallback(
    (v: number) => {
      const tgt = Math.max(0, Math.min(durRef.current, v));
      if (tgt < 0.02) {
        target.current = null;
        set(0);
        setPlaying(false);
        return;
      }
      set(0);
      target.current = tgt;
      setPlaying(true);
    },
    [set]
  );

  const playingRef = useRef(playing);
  playingRef.current = playing;
  const toggle = useCallback(() => (playingRef.current ? pause() : play()), [pause, play]);

  return { t, playing, rate, loop, setRate, setLoop, play, pause, seek, restart, playTo, toggle };
}

export type Clock = ReturnType<typeof useClock>;
