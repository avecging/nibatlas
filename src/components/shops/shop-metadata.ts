import { shopTypeLabel, type ShopDetail } from "@/src/domain/shop-detail";

/**
 * The indexed and shared description for a shop page.
 *
 * This is the one piece of shop copy a person reads *before* they open the page,
 * in a search result or a link preview, so it has to be true about the page they
 * will land on. The first WP1 attempt used a fixed fallback promising "Address,
 * hours, and what you can do there" for every record; NAGASAWA PenStyle DEN has
 * neither an address nor hours, and TY Lee and Juspirit have no published hours,
 * so the preview advertised exactly the fields those pages deliberately omit.
 *
 * Every clause below is therefore derived from a field the record actually
 * carries. Nothing is named unless it is on the page.
 */
function sentenceList(items: readonly string[]): string {
  if (items.length <= 1) {
    return items[0] ?? "";
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Names only what the record holds. An empty list means the page says less. */
function presentFacts(shop: ShopDetail): readonly string[] {
  const facts: string[] = [];

  if (shop.addressLines && shop.addressLines.length > 0) {
    facts.push("address");
  }

  if (shop.openingHours && shop.openingHours.length > 0) {
    facts.push("opening hours");
  }

  if (shop.brands && shop.brands.length > 0) {
    facts.push("brands carried");
  }

  return facts;
}

export function shopMetaDescription(shop: ShopDetail): string {
  // A sourced description is the shop's own summary and always beats a
  // generated one.
  if (shop.shortDescription) {
    return shop.shortDescription;
  }

  const lead = shop.specialtyLine
    ? `${shop.name} in ${shop.localityName} — ${shop.specialtyLine}.`
    : `${shop.name}, a ${shopTypeLabel(shop.primaryType,shop.primaryTypeLabel).toLowerCase()} in ${shop.localityName}.`;

  const facts = presentFacts(shop);

  return facts.length > 0
    ? `${lead} ${capitalise(sentenceList(facts))} on Nib Atlas.`
    : `${lead} On Nib Atlas, the map of physical fountain pen shops.`;
}
