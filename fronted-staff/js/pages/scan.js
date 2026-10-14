// =====================================================================
// Scan page (Integration & API Management Lead)
// Staff types or pastes a booking reference / QR content, then checks
// in the ticket holder. Calls:
//   GET   /attendance/lookup/:ref
//   PATCH /attendance/:ref/check-in
// =====================================================================
import { api } from '../api.js';
import { esc, field, toast, setBusy } from '../ui.js';

export function renderScan(el) {
  el.innerHTML = `
    <header class="page-head">
      <div>
        <h1>Scan ticket</h1>
        <p class="muted">Type or paste the booking reference shown on the customer's QR code.</p>
      </div>
    </header>

    <form id="scan-form" class="card card-pad" novalidate>
      ${field({
        name: 'ref',
        label: 'Booking reference',
        hint: 'Example: BK-20261001-0001',
        required: true,
        autocomplete: 'off',
      })}
      <div class="actions">
        <button class="btn btn-primary" type="submit" data-submit>Look up booking</button>
        <button class="btn btn-ghost" type="button" data-clear>Clear</button>
      </div>
    </form>

    <section id="scan-result" class="mt-2" aria-live="polite"></section>`;

  const form = el.querySelector('#scan-form');
  const result = el.querySelector('#scan-result');
  const submit = form.querySelector('[data-submit]');
  const input = form.ref;

  el.querySelector('[data-clear]').addEventListener('click', () => {
    input.value = '';
    result.innerHTML = '';
    input.focus();
  });

  // Paste from QR scanner: auto-submit if the pasted text looks like a ref
  input.addEventListener('paste', () => {
    setTimeout(() => {
      if (input.value.trim().length >= 5) form.requestSubmit();
    }, 50);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const ref = input.value.trim();
    if (!ref) {
      toast('Enter a booking reference', 'error');
      input.focus();
      return;
    }

    result.innerHTML = `<p class="muted">Looking up ${esc(ref)}…</p>`;
    setBusy(submit, true, 'Looking up…');
    try {
      const res = await api.get(`/attendance/lookup/${encodeURIComponent(ref)}`);
      drawBooking(result, res.data, ref, submit);
    } catch (err) {
      setBusy(submit, false);
      result.innerHTML = `
        <div class="card card-pad">
          <p class="alert alert-error">${esc(err.message)}</p>
        </div>`;
    }
  });

  input.focus();
}

function drawBooking(root, data, ref, submitButton) {
  const { booking, checked_in, checked_in_at } = data;

  const statusBanner = checked_in
    ? `<p class="status status-inactive">Already checked in${checked_in_at ? ` at ${esc(new Date(checked_in_at).toLocaleString('en-MY'))}` : ''}</p>`
    : `<p class="status status-active">Ready for check-in</p>`;

  root.innerHTML = `
    <div class="card card-pad">
      <header class="row between">
        <h2>${esc(booking.event_title)}</h2>
        ${statusBanner}
      </header>
      <dl class="kv">
        <dt>Booking reference</dt><dd><strong>${esc(booking.booking_ref)}</strong></dd>
        <dt>Customer</dt><dd>${esc(booking.customer_name)}</dd>
        <dt>Venue</dt><dd>${esc(booking.venue_name)}, ${esc(booking.venue_city)}</dd>
        <dt>Starts</dt><dd>${esc(new Date(booking.start_time).toLocaleString('en-MY'))}</dd>
        <dt>Quantity</dt><dd>${esc(booking.quantity)} ticket(s)</dd>
        <dt>Total</dt><dd>RM ${Number(booking.total_amount).toFixed(2)}</dd>
        <dt>Status</dt><dd>${esc(booking.status)}</dd>
      </dl>
      <div class="actions">
        <button class="btn btn-primary" type="button" data-checkin ${checked_in ? 'disabled' : ''}>
          ${checked_in ? 'Already checked in' : 'Check in customer'}
        </button>
      </div>
    </div>`;

  const btn = root.querySelector('[data-checkin]');
  if (checked_in) return;

  btn.addEventListener('click', async () => {
    setBusy(btn, true, 'Checking in…');
    setBusy(submitButton, false);
    try {
      const res = await api.patch(`/attendance/${encodeURIComponent(ref)}/check-in`);
      toast(`Check-in successful — ${res.data.quantity} ticket(s)`);
      drawBooking(root, { ...data, checked_in: true, checked_in_at: res.data.checked_in_at }, ref, submitButton);
    } catch (err) {
      setBusy(btn, false);
      toast(err.message, 'error');
    }
  });
}