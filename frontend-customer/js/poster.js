// =====================================================================
// Generated event posters. Events have no uploaded image, so each one gets
// a poster drawn from its category (colours and pattern) and its id (small
// variations), so the same event always looks the same.
// If an event has an image_url, that image is used instead.
// =====================================================================
import { esc, dateParts } from './ui.js';

const STYLES = {
  // a = background, b = pattern, tb / tt = title block and title text
  concert:    { a: '#ff3d7f', b: '#ffd23f', tb: '#1a0b14', tt: '#ffd23f', pattern: 'rings' },
  workshop:   { a: '#1f6feb', b: '#7fd8ff', tb: '#ffffff', tt: '#06142e', pattern: 'grid' },
  conference: { a: '#0e7c66', b: '#c9f27a', tb: '#04241d', tt: '#c9f27a', pattern: 'stripes' },
  sports:     { a: '#ff7a00', b: '#1b1b3a', tb: '#1b1b3a', tt: '#ffb15c', pattern: 'pitch' },
  theatre:    { a: '#7a2bd9', b: '#ffb3e6', tb: '#ffb3e6', tt: '#1d0838', pattern: 'spotlight' },
  exhibition: { a: '#00a6a6', b: '#ffe066', tb: '#032b2b', tt: '#ffe066', pattern: 'dots' },
};
const ORDER = Object.keys(STYLES);

// Picks a style from the category name, e.g. "Concert" or "Theatre & Musicals"
export function posterStyle(categoryName = '', id = 0) {
  const name = String(categoryName).toLowerCase();
  const key = ORDER.find((k) => name.includes(k))
    || (name.includes('music') ? 'theatre' : name.includes('sport') ? 'sports' : ORDER[id % ORDER.length]);
  return { key, ...STYLES[key] };
}

// size: 'card' (grid), 'hero' (big), 'thumb' (small square) or 'strip' (ticket edge)
export function posterHtml(event, { size = 'card', showTitle = true } = {}) {
  const s = posterStyle(event.category_name, event.id);
  const tilt = ((event.id * 37) % 11) - 5;        // -5..5 degrees, fixed per event
  const shift = (event.id * 53) % 60;             // pattern offset, fixed per event
  const when = event.next_start_time || event.start_time;
  const d = when ? dateParts(when) : null;
  const image = event.image_url
    ? `<img class="poster-img" src="${esc(event.image_url)}" alt="" loading="lazy" onerror="this.remove()">`
    : '';
  return `
    <div class="poster poster-${s.pattern} poster-${size}" style="--a:${s.a};--b:${s.b};--tb:${s.tb};--tt:${s.tt};--tilt:${tilt}deg;--shift:${shift}%" aria-hidden="true">
      <span class="poster-art"></span>
      ${image}
      ${showTitle ? `
        <span class="poster-cat">${esc(event.category_name || '')}</span>
        <span class="poster-title"><span>${esc(event.title)}</span></span>
        ${d ? `<span class="poster-date">${esc(d.day)}<small>${esc(d.month)}</small></span>` : ''}` : ''}
    </div>`;
}
