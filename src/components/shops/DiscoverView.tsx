"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { ShopCard } from "@/src/components/shops/ShopCard";
import { applyUserShopState } from "@/src/domain/user-state";
import { useCollection } from "@/src/features/collection/collection-store";
import { specialtyLineFor } from "@/src/features/explore/card-enrichment";
import { demoShopSummaries } from "@/src/fixtures/demo-catalogue";
import { demoDestinations } from "@/src/fixtures/demo-destinations";

import styles from "./DiscoverView.module.css";

interface DiscoverModule {
  readonly id: string;
  readonly title: string;
  readonly reason: string;
  readonly shopIds: readonly string[];
}

/**
 * Rule-based modules only. No engagement ranking, no "Popular", no infinite
 * scroll, and no editorial claim that a demo record is verified.
 */
function buildModules(): readonly DiscoverModule[] {
  const byType = (type: string) =>
    demoShopSummaries.filter((shop) => shop.primaryType === type).map((shop) => shop.id);

  const outsideCapitals = demoShopSummaries
    .filter(
      (shop) =>
        !shop.localityName.includes("Tokyo") &&
        !shop.localityName.includes("Taipei") &&
        shop.localityName !== "Singapore",
    )
    .map((shop) => shop.id);

  return [
    {
      id: "recently-added",
      title: "Recently added",
      reason: "The most recently created demo records in the fixture catalogue.",
      shopIds: demoShopSummaries.slice(-4).map((shop) => shop.id),
    },
    {
      id: "worth-a-detour",
      title: "Worth a detour",
      reason: "Demo records outside the largest metropolitan centres.",
      shopIds: outsideCapitals.slice(0, 4),
    },
    {
      id: "nib-repair",
      title: "Nib and repair specialists",
      reason: "Demo records whose primary type is nib or repair services.",
      shopIds: byType("nib_repair_services").slice(0, 4),
    },
    {
      id: "vintage",
      title: "Vintage and used",
      reason: "Demo records whose primary type is vintage or used pens.",
      shopIds: byType("vintage_used").slice(0, 4),
    },
  ];
}

export function DiscoverView() {
  const collection = useCollection();
  const router = useRouter();
  const modules = useMemo(() => buildModules(), []);

  const shopsById = useMemo(() => {
    const decorated = applyUserShopState(demoShopSummaries, collection.userShopState);

    return new Map(decorated.map((shop) => [shop.id, shop]));
  }, [collection.userShopState]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Discover</h1>
        <p className={styles.subtitle}>
          A short set of rule-based prompts that complement the map. Discover never
          becomes a feed, and nothing here is ranked by engagement.
        </p>
      </header>

      <p className={styles.note}>
        Every listing below is demo fixture data. Near You appears once location
        access is requested by the user, which arrives in a later milestone.
      </p>

      <section className={styles.module} aria-labelledby="destinations-module">
        <div className={styles.moduleHeader}>
          <h2 className={styles.moduleTitle} id="destinations-module">
            Cities and localities to explore
          </h2>
          <p className={styles.moduleReason}>
            Jump straight to a committed viewport in one of the three launch
            countries.
          </p>
        </div>
        <div className={styles.chips}>
          {demoDestinations.map((destination) => (
            <Link
              className={styles.chipLink}
              key={destination.id}
              href={`/?destination=${destination.id}`}
            >
              {destination.name}
              {destination.localName ? ` · ${destination.localName}` : ""}
            </Link>
          ))}
        </div>
      </section>

      {modules.map((module) => (
        <section className={styles.module} key={module.id} aria-labelledby={`${module.id}-title`}>
          <div className={styles.moduleHeader}>
            <h2 className={styles.moduleTitle} id={`${module.id}-title`}>
              {module.title}
            </h2>
            <p className={styles.moduleReason}>{module.reason}</p>
          </div>
          <ol className={styles.list}>
            {module.shopIds.map((shopId) => {
              const shop = shopsById.get(shopId);

              if (!shop) {
                return null;
              }

              return (
                <ShopCard
                  key={shop.id}
                  shop={shop}
                  selected={false}
                  specialtyLine={specialtyLineFor(shop.slug)}
                  saved={collection.savedShopIds.has(shop.id)}
                  onSelect={() => router.push(`/?shop=${shop.slug}`)}
                  onToggleSaved={(id) => collection.toggleSaved(id)}
                />
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
