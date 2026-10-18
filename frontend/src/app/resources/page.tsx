"use client";

import React from "react";
import { Truck } from "lucide-react";
import { ResourceBoard } from "@/components/ResourceBoard";
import { PageHeader } from "@/components/PageHeader";
import { UI_COPY } from "@/lib/ui-copy";

export default function ResourcesPage() {
  return (
    <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 md:p-6 space-y-6">
      <PageHeader title={UI_COPY.pages.resourcesTitle} description={UI_COPY.pages.resourcesDescription} icon={<Truck className="h-6 w-6" />} backHref="/" />

      <ResourceBoard />
    </main>
  );
}
