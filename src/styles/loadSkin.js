// Extra stylesheets for the non-98 skins are separate chunks, fetched only when someone picks them
const LOADERS = {
  xp: () => import('./skin-xp.js'),
  7: () => import('./skin-7.js')
};
const cache = new Map();

export function loadSkinStyles(skin) {
  const load = LOADERS[skin];
  if (!load) return Promise.resolve();
  if (!cache.has(skin)) {
    cache.set(skin, load().catch((err) => {
      cache.delete(skin); // let a later attempt retry
      throw err;
    }));
  }
  return cache.get(skin);
}
