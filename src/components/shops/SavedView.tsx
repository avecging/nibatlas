"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { ShopCard } from "@/src/components/shops/ShopCard";
import { ButtonLink } from "@/src/components/ui/Button";
import { COUNTRY_LABELS } from "@/src/domain/shop-detail";
import type { CountryCode } from "@/src/domain/geo";
import { applyUserShopState } from "@/src/domain/user-state";
import { useCollection } from "@/src/features/collection/collection-store";
import { specialtyLineFor } from "@/src/features/explore/card-enrichment";
import { demoShopSummaries } from "@/src/fixtures/demo-catalogue";

import styles from "./SavedView.module.css";

export function SavedView() {
  const collection = useCollection();
  const router = useRouter();

  const groups = useMemo(() => {
    const saved = applyUserShopState(
      demoShopSummaries.filter((shop) => collection.savedShopIds.has(shop.id)),
      collection.userShopState,
    );

    const byCountry = new Map<CountryCode, typeof saved>();

    for (const shop of saved) {
      byCountry.set(shop.countryCode, [...(byCountry.get(shop.countryCode) ?? []), shop]);
    }

    return [...byCountry.entries()]
      .map(([countryCode, shops]) => ({
        countryCode,
        label: COUNTRY_LABELS[countryCode],
        shops: [...shops].sort((a, b) => a.localityName.localeCompare(b.localityName)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [collection.savedShopIds, collection.userShopState]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Saved</h1>
        <p className={styles.subtitle}>
          Shops you want to visit, grouped by country and locality. Saving requires an
          account in the finished product; Milestone 1 keeps this list in the browser
          session.
        </p>
      </header>

      <p className={styles.note}>
        No trips, ordering, or scheduling — Saved is a plain list of places worth a
        visit.
      </p>

      {groups.length === 0 ? (
        <div className={styles.empty}>
          <p className="type-h3">Nothing saved yet</p>
          <p>Save a shop from the map, a card, or a shop page and it appears here.</p>
          <ButtonLink href="/" variant="primary">
            Explore the map
          </ButtonLink>
        </div>
      ) : (
        groups.map((group) => (
          <section className={styles.group} key={group.countryCode} aria-labelledby={`saved-${group.countryCode}`}>
            <h2 className={styles.groupTitle} id={`saved-${group.countryCode}`}>
              {group.label}
            </h2>
            <ol className={styles.list}>
              {group.shops.map((shop) => (
                <ShopCard
                  key={shop.id}
                  shop={shop}
                  selected={false}
                  specialtyLine={specialtyLineFor(shop.slug)}
                  saved={collection.savedShopIds.has(shop.id)}
                  onSelect={() => router.push(`/?shop=${shop.slug}`)}
                  onToggleSaved={(shopId) => collection.toggleSaved(shopId)}
                />
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}
