"use client";

import Link from "next/link";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { UI_COPY } from "@/lib/ui-copy";

const STORAGE_KEY = "rescuerank-intro-dismissed";

export function FirstVisitGuide() {
  const [visible, setVisible] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setVisible(window.localStorage.getItem(STORAGE_KEY) !== "yes");
  }, []);

  useEffect(() => {
    if (!visible) return;
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        window.localStorage.setItem(STORAGE_KEY, "yes");
        setVisible(false);
        setTourStep(null);
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [visible, tourStep]);

  const dismiss = () => {
    window.localStorage.setItem(STORAGE_KEY, "yes");
    setVisible(false);
    setTourStep(null);
  };

  const trapTab = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab" || !dialogRef.current) return;
    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]'));
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  if (!visible) return null;

  const steps = UI_COPY.onboarding.steps;
  const isTour = tourStep !== null;
  const step = isTour ? steps[tourStep] : null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/80 p-4" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-visit-title"
        aria-describedby="first-visit-description"
        ref={dialogRef}
        onKeyDown={trapTab}
        className="w-full max-w-xl rounded-2xl border border-slate-600 bg-slate-900 p-6 shadow-2xl"
      >
        <p className="mb-2 text-sm font-semibold text-cyan-200">
          {isTour && tourStep !== null ? UI_COPY.onboarding.stepCount(tourStep + 1, steps.length) : UI_COPY.onboarding.introTitle}
        </p>
        <h2 id="first-visit-title" className="text-2xl font-bold text-white">
          {step?.title ?? UI_COPY.onboarding.introTitle}
        </h2>
        <p id="first-visit-description" className="mt-3 text-base leading-relaxed text-slate-200">
          {step?.body ?? UI_COPY.onboarding.intro}
        </p>

        {step ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <button type="button" onClick={() => setTourStep(Math.max(0, (tourStep ?? 0) - 1))} disabled={tourStep === 0} className="ui-button-secondary" aria-label={UI_COPY.onboarding.previous}>
                {UI_COPY.onboarding.previous}
              </button>
              <button type="button" onClick={() => tourStep === steps.length - 1 ? dismiss() : setTourStep((tourStep ?? 0) + 1)} className="ui-button-primary">
                {tourStep === steps.length - 1 ? UI_COPY.onboarding.finish : UI_COPY.onboarding.next}
              </button>
            </div>
            <Link href={step.href} onClick={dismiss} className="ui-button-secondary">{step.action}</Link>
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => setTourStep(0)} className="ui-button-primary">{UI_COPY.onboarding.startTour}</button>
            <button type="button" onClick={dismiss} className="ui-button-secondary">{UI_COPY.onboarding.goToOverview}</button>
          </div>
        )}
        {isTour && <button type="button" onClick={dismiss} className="mt-4 min-h-11 text-sm text-slate-300 underline decoration-slate-500 underline-offset-4">{UI_COPY.onboarding.close}</button>}
      </section>
    </div>
  );
}
