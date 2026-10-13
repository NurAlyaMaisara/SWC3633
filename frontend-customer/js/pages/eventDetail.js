// =====================================================================
// One event: poster, details and its dates. The customer picks a date and
// a number of tickets in the side panel, which creates a pending booking
// (POST /bookings) and opens checkout. Guests are asked to log in first.
// GET /events/:id, POST /bookings
// =====================================================================
import { api } from '../api.js';
import { CONFIG } from '../config.js';
import { getSession, setReturnTo } from '../session.js';
import { posterHtml } from '../poster.js';
import {
  esc, formatMoney, formatTime, dateParts, loadingHtml, emptyHtml, showError, handleAuthError,
  setBusy, toast,
} from '../ui.js';

function isSoldOut(s) {
  return s.status === 'sold_out' || s.available_tickets === 0;
}

function dateCard(s, selected) {
  const d = dateParts(s.start_time);
  const sold = s.total_tickets - s.available_tickets;
  const pct = Math.round((sold / s.total_tickets) * 100);
  const soldOut = isSoldOut(s);
  const few = !soldOut && s.available_tickets <= 20;
  return `
    <button type="button" class="date-card${soldOut ? ' is-soldout' : ''}" data-schedule="${s.id}"
      aria-pressed="${selected}" ${soldOut ? 'disabled' : ''}>
      <span class="dc-day"><strong>${esc(d.day)}</strong>${esc(d.month)}</span>
      <span class="dc-main">
        <span class="dc-time">${esc(d.weekday)}, ${esc(formatTime(s.start_time))} to ${esc(formatTime(s.end_time))}</span>
        <span class="dc-venue">${esc(s.venue_name)}, ${esc(s.venue_city)}</span>
        <span class="meter" aria-hidden="true"><span style="width:${pct}%"></span></span>
        <span class="dc-left${few ? ' is-few' : ''}">${soldOut ? 'Sold out' : few ? `Only ${s.available_tickets} left` : `${s.available_tickets.toLocaleString('en-MY')} of ${s.total_tickets.toLocaleString('en-MY')} left`}</span>
      </span>
      <span class="dc-price">${esc(formatMoney(s.ticket_price))}</span>
    </button>`;
}

export async function renderEventDetail(view, id) {
  let event;
  let selectedId = null;
  let qty = 1;

  async function load() {
    view.innerHTML = loadingHtml();
    try {
      event = (await api.get(`/events/${id}`)).data;
    } catch (err) {
      if (err.status === 404) {
        view.innerHTML = emptyHtml('Event not found', 'It may have been removed or is not published yet.',
          '<a class="btn btn-outline" href="#/events">Back to events</a>');
        return;
      }
      showError(view, err, load);
      return;
    }
    const open = event.schedules.filter((s) => !isSoldOut(s));
    if (!event.schedules.some((s) => s.id === selectedId)) selectedId = open[0]?.id ?? null;
    draw();
  }

  function selected() {
    return event.schedules.find((s) => s.id === selectedId) || null;
  }

  function panelHtml() {
    const s = selected();
    if (!s) {
      return `<div class="panel"><h2>Tickets</h2><p class="muted">${event.schedules.length ? 'Every date is sold out.' : 'No dates are on sale yet.'}</p></div>`;
    }
    const max = Math.min(CONFIG.MAX_TICKETS, s.available_tickets);
    if (qty > max) qty = max;
    const d = dateParts(s.start_time);
    const loggedIn = Boolean(getSession());
    return `
      <div class="panel">
        <h2>Your tickets</h2>
        <p class="panel-date">${esc(d.weekday)} ${esc(d.day)} ${esc(d.month)}, ${esc(formatTime(s.start_time))}<br><span>${esc(s.venue_name)}</span></p>
        <div class="stepper" role="group" aria-label="Number of tickets">
          <button type="button" data-step="-1" aria-label="One ticket fewer" ${qty <= 1 ? 'disabled' : ''}>−</button>
          <output aria-live="polite">${qty}</output>
          <button type="button" data-step="1" aria-label="One more ticket" ${qty >= max ? 'disabled' : ''}>+</button>
        </div>
        <p class="stepper-hint">Up to ${max} ticket${max === 1 ? '' : 's'} per booking</p>
        <div class="panel-total"><span>${qty} × ${esc(formatMoney(s.ticket_price))}</span><strong>${esc(formatMoney(qty * s.ticket_price))}</strong></div>
        <div class="form-alert" data-panel-error hidden></div>
        ${loggedIn
          ? '<button class="btn btn-ink btn-lg btn-block" type="button" data-book>Reserve tickets</button>'
          : '<button class="btn btn-ink btn-lg btn-block" type="button" data-login>Log in to book</button>'}
        <p class="panel-note">Your tickets are held while you pay.</p>
      </div>`;
  }

  function draw() {
    view.innerHTML = `
      <a class="back" href="#/events">All events</a>
      <section class="event-head">
        <div class="event-poster">${posterHtml(event, { size: 'hero' })}</div>
        <div class="event-info">
          <span class="kicker">${esc(event.category_name)}</span>
          <h1>${esc(event.title)}</h1>
          ${event.description ? `<p class="lead">${esc(event.description)}</p>` : ''}
          <p class="muted">Organised by ${esc(event.organiser_name)}</p>
        </div>
      </section>
      <section class="event-body">
        <div>
          <h2>Pick a date</h2>
          ${event.schedules.length
            ? `<div class="date-cards">${event.schedules.map((s) => dateCard(s, s.id === selectedId)).join('')}</div>`
            : emptyHtml('No dates yet', 'The organiser has not added an upcoming date.')}
        </div>
        <aside data-panel>${panelHtml()}</aside>
      </section>`;
    bind();
  }

  function redrawPanel() {
    view.querySelector('[data-panel]').innerHTML = panelHtml();
    bindPanel();
  }

  function bindCards() {
    view.querySelectorAll('.date-card').forEach((card) => card.addEventListener('click', () => {
      selectedId = Number(card.dataset.schedule);
      view.querySelectorAll('.date-card').forEach((c) => c.setAttribute('aria-pressed', String(c === card)));
      redrawPanel();
    }));
  }

  function bind() {
    bindCards();
    bindPanel();
  }

  function bindPanel() {
    const panel = view.querySelector('[data-panel]');
    panel.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
      qty += Number(b.dataset.step);
      redrawPanel();
    }));
    panel.querySelector('[data-login]')?.addEventListener('click', () => {
      setReturnTo(`#/events/${event.id}`);
      location.hash = '#/login';
    });
    panel.querySelector('[data-book]')?.addEventListener('click', (e) => book(e.target));
  }

  async function book(button) {
    const errorBox = view.querySelector('[data-panel-error]');
    errorBox.hidden = true;
    setBusy(button, true, 'Reserving…');
    try {
      const res = await api.post('/bookings', { schedule_id: selectedId, quantity: qty });
      toast(`Tickets held for booking ${res.data.booking_ref}.`);
      location.hash = `#/bookings/${res.data.id}/pay`;
    } catch (err) {
      if (handleAuthError(err)) return;
      setBusy(button, false);
      // 409 = sold out, not enough left or closed; 422 = invalid choice
      errorBox.textContent = err.code === 'VALIDATION_ERROR' && err.details[0] ? err.details[0].message : err.message;
      errorBox.hidden = false;
      if (err.status === 409) {
        // Refresh the ticket counts so the customer sees what is left
        const fresh = (await api.get(`/events/${id}`).catch(() => null))?.data;
        if (fresh) {
          event = fresh;
          view.querySelector('.date-cards').innerHTML = event.schedules.map((s) => dateCard(s, s.id === selectedId)).join('');
          bindCards();
        }
      }
    }
  }

  load();
}
