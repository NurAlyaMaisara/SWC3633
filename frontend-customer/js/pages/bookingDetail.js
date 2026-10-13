// =====================================================================
// One booking as a full ticket, with what to do next (pay, add to
// calendar, print, cancel) and the history of payment attempts.
// GET /bookings/:id, PATCH /bookings/:id/cancel
// =====================================================================
import { api } from '../api.js';
import { ticketHtml } from '../ticket.js';
import {
  esc, formatMoney, formatDateTime, badge, isPast, loadingHtml, emptyHtml, showError,
  handleAuthError, setBusy, toast,
} from '../ui.js';

const METHOD_LABELS = { card: 'Card', fpx: 'FPX online banking', ewallet: 'E-wallet' };

function paymentsHtml(payments) {
  if (!payments.length) return '<p class="muted">No payment attempts yet.</p>';
  return `
    <ol class="timeline">${payments.map((p) => `
      <li class="tl-${esc(p.status)}">
        <span class="tl-dot" aria-hidden="true"></span>
        <div>
          <strong>${esc(formatMoney(p.amount))} by ${esc(METHOD_LABELS[p.method] || p.method)}</strong> ${badge(p.status)}
          <span>${esc(formatDateTime(p.created_at))}${p.transaction_ref ? ` · Ref ${esc(p.transaction_ref)}` : ''}</span>
        </div>
      </li>`).join('')}</ol>`;
}

function noteFor(b) {
  if (b.status === 'cancelled') {
    return `Cancelled on ${formatDateTime(b.cancelled_at)}.${b.payment_status === 'refunded' ? ' Your payment has been refunded.' : ''}`;
  }
  if (isPast(b.start_time)) return 'This event has ended.';
  if (b.status === 'confirmed') return 'Show this ticket or the booking reference at the entrance. Staff will check you in.';
  return 'Your tickets are held. Pay to confirm them, or cancel to release them.';
}

// Calendar file (.ics) built in the browser; nothing is sent to the API
function downloadIcs(b) {
  const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const text = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ticket.exe//Customer app//EN', 'BEGIN:VEVENT',
    `UID:${b.booking_ref}@ticket.exe`, `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(b.start_time)}`, `DTEND:${stamp(b.end_time)}`,
    `SUMMARY:${b.event_title}`, `LOCATION:${b.venue_name}, ${b.venue_city}`,
    `DESCRIPTION:Booking ${b.booking_ref}, ${b.quantity} ticket(s)`, 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${b.booking_ref}.ics` });
  a.click();
  URL.revokeObjectURL(url);
}

export async function renderBookingDetail(view, id, query) {
  const justPaid = query?.get('new') === '1';

  async function load(celebrate) {
    view.innerHTML = loadingHtml();
    let b;
    try {
      b = (await api.get(`/bookings/${id}`)).data;
    } catch (err) {
      if (err.status === 404 || err.status === 403) {
        view.innerHTML = emptyHtml('Booking not found', 'Your bookings are in My tickets.',
          '<a class="btn btn-outline" href="#/bookings">My tickets</a>');
        return;
      }
      showError(view, err, () => load(false));
      return;
    }

    const upcoming = !isPast(b.start_time);
    const canCancel = b.status !== 'cancelled' && upcoming;
    const showCelebration = celebrate && b.status === 'confirmed';
    view.innerHTML = `
      <a class="back" href="#/bookings">My tickets</a>
      ${showCelebration ? `<section class="celebrate"><h1>You're going!</h1><p>Payment received. Your ticket is ready below.</p></section>` : ''}
      <div class="${showCelebration ? 'ticket-arrive' : ''}">${ticketHtml(b, { big: true })}</div>
      <p class="booking-note">${esc(noteFor(b))}</p>
      <div class="actions">
        ${b.status === 'pending' && upcoming ? `<a class="btn btn-ink" href="#/bookings/${b.id}/pay">Pay ${esc(formatMoney(b.total_amount))}</a>` : ''}
        ${b.status === 'confirmed' && upcoming ? '<button class="btn btn-ink" type="button" data-ics>Add to calendar</button><button class="btn btn-outline" type="button" data-print>Print ticket</button>' : ''}
        <a class="btn btn-outline" href="#/events/${b.event_id}">View event</a>
        ${canCancel ? '<button class="btn btn-quiet btn-danger" type="button" data-cancel>Cancel booking</button>' : ''}
      </div>
      <div class="form-alert" data-alert hidden></div>
      <section class="history">
        <h2>Payment history</h2>
        ${paymentsHtml(b.payments)}
        <p class="muted small">Booked on ${esc(formatDateTime(b.created_at))}</p>
      </section>`;

    view.querySelector('[data-ics]')?.addEventListener('click', () => downloadIcs(b));
    view.querySelector('[data-print]')?.addEventListener('click', () => window.print());
    view.querySelector('[data-cancel]')?.addEventListener('click', async (e) => {
      const message = b.status === 'confirmed'
        ? 'Cancel this booking? You will be refunded and the tickets go back on sale.'
        : 'Cancel this booking? The tickets go back on sale.';
      if (!confirm(message)) return;
      setBusy(e.target, true, 'Cancelling…');
      try {
        const res = await api.patch(`/bookings/${b.id}/cancel`);
        toast(res.message);
        load(false);
      } catch (err) {
        if (handleAuthError(err)) return;
        setBusy(e.target, false);
        const box = view.querySelector('[data-alert]');
        box.textContent = err.message;
        box.hidden = false;
      }
    });
  }

  load(justPaid);
}
