import { useEffect, useState, type RefObject } from 'react';

/** Observe stable normal-flow geometry, never the toolbar itself, to avoid scroll/layout feedback. */
export function useStickySearch(form: RefObject<HTMLFormElement | null>, section: RefObject<HTMLElement | null>) {
  const [pastForm, setPastForm] = useState(false);
  const [inSection, setInSection] = useState(true);
  const visible = pastForm && inSection;
  useEffect(() => {
    if (!window.IntersectionObserver || !form.current || !section.current) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.target === form.current) setPastForm(!entry.isIntersecting && entry.boundingClientRect.bottom < -8);
        if (entry.target === section.current) setInSection(entry.isIntersecting);
      }
    }, { rootMargin: '8px 0px 0px 0px', threshold: 0 });
    observer.observe(form.current);
    observer.observe(section.current);
    return () => observer.disconnect();
  }, [form, section]);
  useEffect(() => {
    document.documentElement.classList.toggle('has-sticky-search', visible);
    return () => document.documentElement.classList.remove('has-sticky-search');
  }, [visible]);
  return visible;
}
