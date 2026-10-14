import { describe, expect, it } from "vitest";

import { distanceLabel, nearbyPenShops } from "@/src/domain/nearby-shops";
import type { ShopDetail } from "@/src/domain/shop-detail";
import { shopValueSpecimen } from "@/src/fixtures/shop-value-specimen";

function shop(patch: Partial<ShopDetail> & { readonly id: string }): ShopDetail {
  return { ...shopValueSpecimen, ...patch };
}

/*
 * `Approx.` replaced `about` in the founder's staging review of WP4: it carries
 * the qualification on its own, which is what let the separate straight-line
 * paragraph under the list go.
 */
describe("distanceLabel", () => {
  it("rounds to 50 m under a kilometre, because neither point is surveyed", () => {
    expect(distanceLabel(412)).toBe("Approx. 400 m away");
    expect(distanceLabel(438)).toBe("Approx. 450 m away");
  });

  it("never rounds down to nothing", () => {
    expect(distanceLabel(4)).toBe("Approx. 50 m away");
  });

  it("switches to kilometres with one decimal above a kilometre", () => {
    expect(distanceLabel(1_240)).toBe("Approx. 1.2 km away");
    expect(distanceLabel(4_950)).toBe("Approx. 5.0 km away");
  });
});

describe("nearbyPenShops", () => {
  const origin = shop({id:"origin", localityName:"Testville", position:{latitude:1.3,longitude:103.85}, positionPrecision:"street"});
  const peer = (id:string, northMetres:number, patch:Partial<ShopDetail>={}) => shop({
    id, name:id, localityName:"Testville", positionPrecision:"street",
    position:{latitude:1.3+northMetres/111_000,longitude:103.85}, ...patch,
  });

  it("uses 800 m normally, expands to 1.7 km only below three, and never goes beyond", () => {
    const candidates=[peer("close-1",100),peer("close-2",600),peer("fallback",1200),peer("too-far",1800)];
    expect(nearbyPenShops(origin,[origin,...candidates]).map(x=>x.shop.id)).toEqual(["close-1","close-2","fallback"]);
    expect(nearbyPenShops(origin,[origin,peer("close-3",700),...candidates]).map(x=>x.shop.id))
      .toEqual(["close-1","close-2","close-3"]);
    expect(nearbyPenShops(origin,[origin,peer("too-far",1800)])).toEqual([]);
  });

  it("omits imprecise, closed and publicly linked shops before choosing fallback", () => {
    const linked=peer("linked",100), close=peer("close",200);
    const withLink=shop({...origin,relatedShops:[{id:"linked",slug:"linked",name:"linked",localityName:"Testville",countryCode:"SG",kind:"branch"}]});
    const entries=nearbyPenShops(withLink,[withLink,linked,close,peer("centroid",100,{positionPrecision:"locality"}),peer("closed",200,{operationalStatus:"permanently_closed"}),peer("fallback",1000)]);
    expect(entries.map(x=>x.shop.id)).toEqual(["close","fallback"]);
    expect(entries.every(x=>x.distanceMeters!==null)).toBe(true);
    expect(nearbyPenShops(shop({...origin,positionPrecision:"locality"}),[close])).toEqual([]);
  });

  it("caps the list at five closest candidates", () => {
    const peers=Array.from({length:8},(_,i)=>peer(`peer-${i}`,(i+1)*50));
    expect(nearbyPenShops(origin,[origin,...peers])).toHaveLength(5);
    expect(nearbyPenShops(origin,[origin,...peers],2)).toHaveLength(2);
  });
});
