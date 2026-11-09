import { useEffect } from 'react';

const HEADER_OFFSET = 80;

function headerOffsetPx() {
  const header = document.querySelector('.site-header') as HTMLElement | null;
  return (header?.offsetHeight || HEADER_OFFSET) + 12;
}

function scrollToHash(hash: string, behavior: ScrollBehavior = 'smooth') {
  if (!hash || hash === '#') return;
  const id = decodeURIComponent(hash.replace(/^#/, ''));
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - headerOffsetPx();
  window.scrollTo({ top: Math.max(0, top), behavior });
}

export default function SmoothScroll() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Correct sticky-header offset for in-page anchors (Lenis or native).
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href*="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const url = new URL(a.href, window.location.href);
      if (url.pathname !== window.location.pathname) return;
      if (!url.hash) return;
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      history.pushState(null, '', url.hash);
      scrollToHash(url.hash, reduced ? 'auto' : 'smooth');
    };

    document.addEventListener('click', onClick);

    // Initial hash (e.g. /#booking)
    if (window.location.hash) {
      requestAnimationFrame(() => scrollToHash(window.location.hash, 'auto'));
    }

    if (reduced) {
      return () => document.removeEventListener('click', onClick);
    }

    // Lightweight Lenis — skip on coarse pointer / narrow screens to cut jank.
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const narrow = window.matchMedia('(max-width: 900px)').matches;
    if (coarse || narrow) {
      return () => document.removeEventListener('click', onClick);
    }

    let destroyed = false;
    let lenis: { raf: (t: number) => void; destroy: () => void; scrollTo: (t: number | HTMLElement, o?: object) => void } | null =
      null;
    let rafId = 0;

    (async () => {
      const { default: Lenis } = await import('lenis');
      if (destroyed) return;
      lenis = new Lenis({
        duration: 0.85,
        smoothWheel: true,
        syncTouch: false,
      });
      document.documentElement.classList.add('lenis');
      const raf = (time: number) => {
        lenis?.raf(time);
        rafId = requestAnimationFrame(raf);
      };
      rafId = requestAnimationFrame(raf);
    })();

    return () => {
      destroyed = true;
      document.removeEventListener('click', onClick);
      cancelAnimationFrame(rafId);
      lenis?.destroy();
      document.documentElement.classList.remove('lenis');
    };
  }, []);

  return null;
}
