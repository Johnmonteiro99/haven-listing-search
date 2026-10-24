import { imageAssets } from './images';

/** Hash an unambiguous MLS identity, independent of rank, page, filters, or theme. */
export function getListingImage(source: string, id: string) {
  const identity = JSON.stringify([source, id]);
  let hash = 0;
  for (let index = 0; index < identity.length; index += 1) {
    hash = (31 * hash + identity.charCodeAt(index)) >>> 0;
  }
  return imageAssets.propertyResponsive[hash % imageAssets.propertyResponsive.length];
}
