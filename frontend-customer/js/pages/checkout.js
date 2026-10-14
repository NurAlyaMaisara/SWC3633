// =====================================================================
// Checkout for a pending booking (simulated payment gateway).
// Card, bank and e-wallet details are checked in the browser only; they are
// never sent to the API or stored. The API receives just the method.
// GET /bookings/:id, POST /bookings/:id/payments, PATCH /bookings/:id/cancel
// =====================================================================
import { api } from '../api.js';
import { posterHtml } from '../poster.js';
import {
  esc, formatMoney, formatTime, dateParts, loadingHtml, emptyHtml, showError, handleAuthError,
  setBusy, toast, fieldHtml, clearFormErrors, showFormErrors,
} from '../ui.js';

const BANKS = ['Maybank2u', 'CIMB Clicks', 'Public Bank', 'RHB Now', 'Hong Leong Connect', 'Bank Islam', 'AmOnline'];
const WALLETS = ["Touch 'n Go eWallet", 'GrabPay', 'Boost', 'ShopeePay'];

const METHODS = [
  { value: 'card', label: 'Card', sub: 'Visa, Mastercard' },
  { value: 'fpx', label: 'FPX', sub: 'Online banking' },
  { value: 'ewallet', label: 'E-wallet', sub: "Touch 'n Go, GrabPay" },
];

function stepsHtml(current) {
  const steps = ['Choose tickets', 'Pay', 'Get your ticket'];
  return `<ol class="steps">${steps.map((s, i) => `
    <li class="${i < current ? 'done' : i === current ? 'now' : ''}" ${i === current ? 'aria-current="step"' : ''}>
      <span class="step-n">${i + 1}</span>${s}</li>`).join('')}</ol>`;
}

function methodFields(method) {
  if (method === 'card') {
    return `<div class="form-grid">
      ${fieldHtml({ name: 'card_name', label: 'Name on card', full: true, control: '<input id="f-card_name" name="card_name" autocomplete="cc-name">' })}
      ${fieldHtml({ name: 'card_number', label: 'Card number', full: true, hint: 'Test number: 4242 4242 4242 4242',
        control: '<input id="f-card_number" name="card_number" inputmode="numeric" autocomplete="cc-number" placeholder="1234 5678 9012 3456" maxlength="23">' })}
      ${fieldHtml({ name: 'card_expiry', label: 'Expiry', control: '<input id="f-card_expiry" name="card_expiry" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/YY" maxlength="5">' })}
      ${fieldHtml({ name: 'card_cvc', label: 'CVC', control: '<input id="f-card_cvc" name="card_cvc" inputmode="numeric" autocomplete="cc-csc" placeholder="123" maxlength="4">' })}
    </div>`;
  }
  if (method === 'fpx') {
    return fieldHtml({ name: 'bank', label: 'Your bank', control: `<select id="f-bank" name="bank"><option value="">Choose your bank</option>${BANKS.map((b) => `<option>${esc(b)}</option>`).join('')}</select>` });
  }
  return `<div class="form-grid">
    ${fieldHtml({ name: 'wallet', label: 'E-wallet', control: `<select id="f-wallet" name="wallet"><option value="">Choose an e-wallet</option>${WALLETS.map((w) => `<option>${esc(w)}</option>`).join('')}</select>` })}
    ${fieldHtml({ name: 'wallet_phone', label: 'Mobile number', control: '<input id="f-wallet_phone" name="wallet_phone" type="tel" placeholder="0123456789">' })}
  </div>`;
}

// Luhn check used by real card numbers
function luhnOk(digits) {
  let sum = 0;
  digits.split('').reverse().forEach((ch, i) => {
    let n = Number(ch);
    if (i % 2) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  });
  return sum % 10 === 0;
}

function checkDetails(form, method) {
  const errors = [];
  if (method === 'card') {
    const number = form.card_number.value.replace(/\s/g, '');
    const [mm, yy] = form.card_expiry.value.split('/').map(Number);
    const now = new Date();
    const expired = !mm || !yy || mm < 1 || mm > 12
      || (2000 + yy < now.getFullYear()) || (2000 + yy === now.getFullYear() && mm < now.getMonth() + 1);
    if (form.card_name.value.trim().length < 2) errors.push({ field: 'card_name', message: 'Enter the name on the card' });
    if (!/^\d{13,19}$/.test(number) || !luhnOk(number)) errors.push({ field: 'card_number', message: 'Enter a valid card number' });
    if (expired) errors.push({ field: 'card_expiry', message: 'Enter a future expiry date as MM/YY' });
    if (!/^\d{3,4}$/.test(form.card_cvc.value)) errors.push({ field: 'card_cvc', message: 'Enter the 3 or 4 digit code' });
  } else if (method === 'fpx') {
    if (!form.bank.value) errors.push({ field: 'bank', message: 'Choose your bank' });
  } else {
    if (!form.wallet.value) errors.push({ field: 'wallet', message: 'Choose an e-wallet' });
    if (!/^01\d{8,9}$/.test(form.wallet_phone.value.trim())) errors.push({ field: 'wallet_phone', message: 'Enter a Malaysian mobile number' });
  }
  return errors;
}

export async function renderCheckout(view, id) {
  let method = 'card';

  async function load() {
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
      showError(view, err, load);
      return;
    }
    // Only pending bookings can be paid; anything else goes to its ticket page
    if (b.status !== 'pending') { location.hash = `#/bookings/${b.id}`; return; }
    draw(b);
  }

  function draw(b) {
    const d = dateParts(b.start_time);
    view.innerHTML = `
      ${stepsHtml(1)}
      <div class="checkout">
        <form class="pay" novalidate>
          <h1>Pay for your tickets</h1>
          <div class="form-alert" data-form-alert hidden></div>
          <fieldset class="methods">
            <legend>Payment method</legend>
            ${METHODS.map((m) => `
              <label class="method-tile">
                <input type="radio" name="method" value="${m.value}" ${m.value === method ? 'checked' : ''}>
                <span class="mt-label">${esc(m.label)}</span><span class="mt-sub">${esc(m.sub)}</span>
              </label>`).join('')}
          </fieldset>
          <div data-fields>${methodFields(method)}</div>
          <label class="switch"><input type="checkbox" name="simulate"><span class="switch-ui" aria-hidden="true"></span>
            <span>Test a declined payment</span></label>
          <button class="btn btn-ink btn-lg btn-block" type="submit">Pay ${esc(formatMoney(b.total_amount))}</button>
          <p class="secure">This is a simulated payment. Card and bank details are checked here but never sent or stored.</p>
        </form>

        <aside class="summary">
          ${posterHtml({ id: b.event_id, title: b.event_title, category_name: '', start_time: b.start_time }, { size: 'thumb', showTitle: false })}
          <h2>${esc(b.event_title)}</h2>
          <p>${esc(d.weekday)} ${esc(d.day)} ${esc(d.month)}, ${esc(formatTime(b.start_time))}<br>${esc(b.venue_name)}, ${esc(b.venue_city)}</p>
          <dl>
            <div><dt>Tickets</dt><dd>${b.quantity} × ${esc(formatMoney(b.unit_price))}</dd></div>
            <div><dt>Booking</dt><dd>${esc(b.booking_ref)}</dd></div>
            <div class="sum-total"><dt>Total</dt><dd>${esc(formatMoney(b.total_amount))}</dd></div>
          </dl>
          <p class="held">Your ${b.quantity === 1 ? 'ticket is' : 'tickets are'} held until you pay or cancel.</p>
          <button class="btn btn-quiet btn-block" type="button" data-cancel>Cancel booking</button>
        </aside>
      </div>`;

    const form = view.querySelector('.pay');
    const alert = form.querySelector('[data-form-alert]');

    // Poster thumbnail needs the category; fetch the event to colour it correctly
    api.get(`/events/${b.event_id}`).then((res) => {
      const thumb = view.querySelector('.summary .poster');
      if (thumb) thumb.outerHTML = posterHtml(res.data, { size: 'thumb', showTitle: false });
    }).catch(() => {});

    form.querySelectorAll('input[name="method"]').forEach((r) => r.addEventListener('change', () => {
      method = r.value;
      form.querySelector('[data-fields]').innerHTML = methodFields(method);
      bindFormatting(form);
    }));
    bindFormatting(form);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFormErrors(form);
      alert.hidden = true;
      const errors = checkDetails(form, method);
      if (errors.length) { showFormErrors(form, errors); return; }

      const button = form.querySelector('button[type="submit"]');
      setBusy(button, true, 'Processing payment…');
      try {
        const body = { method };
        if (form.simulate.checked) body.simulate = 'fail';
        await api.post(`/bookings/${b.id}/payments`, body);
        location.hash = `#/bookings/${b.id}?new=1`;
      } catch (err) {
        if (handleAuthError(err)) return;
        setBusy(button, false);
        // 402 = declined (tickets still held), 409 = already paid or cancelled
        alert.textContent = err.message;
        alert.hidden = false;
        alert.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        if (err.status === 409) setTimeout(load, 2000);
      }
    });

    view.querySelector('[data-cancel]').addEventListener('click', async (e) => {
      if (!confirm('Cancel this booking? The tickets go back on sale.')) return;
      setBusy(e.target, true, 'Cancelling…');
      try {
        await api.patch(`/bookings/${b.id}/cancel`);
        toast('Booking cancelled. The tickets are back on sale.');
        location.hash = '#/bookings';
      } catch (err) {
        if (handleAuthError(err)) return;
        setBusy(e.target, false);
        alert.textContent = err.message;
        alert.hidden = false;
      }
    });
  }

  load();
}

// Groups card numbers as "4242 4242 …" and expiry as "MM/YY" while typing
function bindFormatting(form) {
  form.card_number?.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
  });
  form.card_expiry?.addEventListener('input', (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 4);
    e.target.value = v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v;
  });
  form.card_cvc?.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });
}
