"use client";

import React from "react";
import { Clock } from "lucide-react";
import { Timeline } from "@/components/Timeline";
import { PageHeader } from "@/components/PageHeader";
import { UI_COPY } from "@/lib/ui-copy";

export default function PrepositioningPage() {
  return (
    <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 md:p-6 space-y-6">
      <PageHeader title={UI_COPY.pages.preparationTitle} description={UI_COPY.pages.preparationDescription} icon={<Clock className="h-6 w-6" />} backHref="/" variant="plain" />

      <Timeline />
    </main>
  );
}
