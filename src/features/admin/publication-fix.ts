import type { Document } from './shop-contract';
/** Maps the bounded SQL publication requirements to actual editor destinations. */
export function publicationFix(requirement: string, draft: Document): { path?: string; id?: string } {
  if (requirement === 'Add country, locality, timezone and valid coordinates.') {
    const missing = ['country_code','locality_id','timezone','latitude','longitude'].find(key => draft.shop[key] == null || draft.shop[key] === '');
    return {path:`shop.${missing ?? 'country_code'}`};
  }
  if (requirement === 'Choose one primary shop type.') return {path:'types'};
  if (requirement === 'Add the street address.') return {path:'shop.address_line_1'};
  if (requirement === 'Check and confirm the saved shop position.') return {id:'confirm-shop-position'};
  if (requirement === 'Prepare an active Atlas Stamp with approved artwork (artwork package).') return {id:'shop-stamp-artwork'};
  return {id:'shop-publication'};
}
