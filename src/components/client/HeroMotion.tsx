import { useEffect } from 'react';

/** One light hero entrance + CN→RU beat. No ScrollTrigger. */
export default function HeroMotion() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hero = document.querySelector('.hero');
    if (reduced || !hero) return;

    let ctx: { revert: () => void } | null = null;

    (async () => {
      const gsap = (await import('gsap')).default;
      ctx = gsap.context(() => {
        gsap.from('[data-hero-reveal]', {
          y: 16,
          opacity: 0,
          duration: 0.55,
          stagger: 0.07,
          ease: 'power2.out',
          clearProps: 'transform',
        });

        gsap
          .timeline({ delay: 0.2 })
          .fromTo(
            '[data-hero-cn]',
            { opacity: 1, x: 0 },
            { opacity: 0.65, x: -4, duration: 0.4, ease: 'power2.out' },
          )
          .fromTo(
            '[data-hero-ru]',
            { opacity: 0.35, x: 6 },
            { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out' },
            '-=0.2',
          );
      }, hero);
    })();

    return () => ctx?.revert();
  }, []);

  return null;
}
