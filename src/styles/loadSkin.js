// The XP skin (xp.css + our XP layer) is a separate chunk, fetched only when someone picks it
let xpPromise = null;

export function loadXpSkin() {
  if (!xpPromise) {
    xpPromise = import('./skin-xp.js').catch((err) => {
      xpPromise = null; // let a later attempt retry
      throw err;
    });
  }
  return xpPromise;
}
