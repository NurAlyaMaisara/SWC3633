// =====================================================================
// A booking drawn as a ticket: poster strip, event details, a tear line
// and a stub with the booking reference and a barcode made from it.
// =====================================================================
import { posterHtml } from './poster.js';
import { esc, formatMoney, formatTime, dateParts, isPast } from './ui.js';

const STATUS_TEXT = { pending: 'Awaiting payment', confirmed: 'Confirmed', cancelled: 'Cancelled' };

// Barcode stripes from the booking reference (the same reference always gives the same pattern)
export function barcodeSvg(ref) {
  let x = 0;
  const bars = [];
  String(ref).split('').forEach((ch) => {
    const code = ch.charCodeAt(0);
    for (let i = 0; i < 3; i += 1) {
      const w = 1 + ((code >> (i * 2)) & 3) % 3;   // bar width 1 to 3
      bars.push(`<rect x="${x}" y="0" width="${w}" height="40"/>`);
      x += w + 1 + ((code >> i) & 1);              // gap 1 to 2
    }
  });
  return `<svg class="barcode" viewBox="0 0 ${x} 40" preserveAspectRatio="none" aria-hidden="true">${bars.join('')}</svg>`;
}

export function ticketHtml(b, { link = false, big = false } = {}) {
  const d = dateParts(b.start_time);
  const ended = b.status !== 'cancelled' && isPast(b.start_time);
  const tag = link ? 'a' : 'article';
  const href = link ? ` href="#/bookings/${b.id}"` : '';
  const label = ended ? 'Event ended' : STATUS_TEXT[b.status];
  return `
    <${tag} class="ticket ticket-${esc(b.status)}${ended ? ' ticket-ended' : ''}${big ? ' ticket-big' : ''}"${href}
      aria-label="${esc(b.event_title)}, ${esc(label)}">
      <div class="ticket-art">${posterHtml({ id: b.event_id, title: b.event_title, category_name: b.category_name }, { size: 'strip', showTitle: false })}</div>
      <div class="ticket-main">
        <span class="ticket-when">${esc(d.weekday)} ${esc(d.day)} ${esc(d.month)} at ${esc(formatTime(b.start_time))}</span>
        <span class="ticket-title">${esc(b.event_title)}</span>
        <span class="ticket-venue">${esc(b.venue_name)}, ${esc(b.venue_city)}</span>
        <span class="ticket-qty"><strong>${b.quantity}</strong> ${b.quantity === 1 ? 'ticket' : 'tickets'} · ${esc(formatMoney(b.total_amount))}</span>
      </div>
      <div class="ticket-stub">
        <span class="status status-${esc(ended ? 'ended' : b.status)}">${esc(label)}</span>
        ${barcodeSvg(b.booking_ref)}
        <span class="ticket-ref">${esc(b.booking_ref)}</span>
      </div>
      ${b.status === 'cancelled' ? '<span class="void" aria-hidden="true">Void</span>' : ''}
    </${tag}>`;
}
