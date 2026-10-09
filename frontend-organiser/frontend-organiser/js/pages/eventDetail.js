// =====================================================================
// One event: details, publish / cancel / delete, and its schedules.
// Schedules: add (POST /events/:id/schedules), edit (PUT /schedules/:id),
// delete (DELETE /schedules/:id).
// =====================================================================
import { api } from '../api.js';
import { canManage } from '../session.js';
import {
  esc, badge, formatDateTime, formatTime, formatMoney, loadingHtml, emptyHtml, showError,
  fieldHtml, clearFormErrors, showFormErrors, showApiFormError, setBusy, toast,
  toLocalInput, fromLocalInput, nowLocalInput, handleAuthError,
} from '../ui.js';

let venuesCache = null; // venue list for the schedule form, loaded once

async function getVenues() {
  if (!venuesCache) {
    const res = await api.get('/venues', { limit: 50, sort: 'name' });
    venuesCache = res.data;
  }
  return venuesCache;
}

export async function renderEventDetail(el, id) {
  el.innerHTML = loadingHtml('Loading event…');

  let event;
  try {
    event = (await api.get(`/events/${id}`)).data;
  } catch (err) {
    if (err.status === 404) {
      el.innerHTML = `<a class="back-link" href="#/events">← Back to events</a>
        ${emptyHtml('Event not found', 'It may have been deleted, or it is a draft owned by another organiser.')}`;
      return;
    }
    return showError(el, err, () => renderEventDetail(el, id));
  }

  const manage = canManage(event.organiser_id);
  const cancelled = event.status === 'cancelled';
  const isPast = (s) => new Date(s.start_time) <= new Date();

  const totalSold = event.schedules.reduce((sum, s) => sum + (s.total_tickets - s.available_tickets), 0);
  const upcoming = event.schedules.filter((s) => !isPast(s) && s.status !== 'closed');

  el.innerHTML = `
    <a class="back-link" href="#/events">← Events</a>

    <!-- Event header drawn as a ticket: details on the left, a tear-off stub with key numbers -->
    <section class="ticket">
      <div class="ticket-main">
        <div class="ticket-meta">
          ${badge(event.status)}
          <span>${esc(event.category_name)}</span>
          <span>by ${esc(event.organiser_name)}</span>
        </div>
        <h1>${esc(event.title)}</h1>
        <p class="ticket-desc">${esc(event.description || 'No description yet.')}</p>
        ${manage ? `
          <div class="actions">
            ${event.status === 'draft' ? '<button class="btn btn-primary" type="button" data-action="publish">Publish</button>' : ''}
            ${!cancelled ? `<a class="btn btn-secondary" href="#/events/${event.id}/edit">Edit details</a>` : ''}
            ${!cancelled ? '<button class="btn btn-danger" type="button" data-action="cancel">Cancel event</button>' : ''}
            <button class="btn btn-danger" type="button" data-action="delete">Delete</button>
          </div>` : ''}
      </div>
      <div class="ticket-stub">
        <div class="stub-stats">
          <div><span class="stub-value">${upcoming.length}</span><span class="stub-label">upcoming ${upcoming.length === 1 ? 'date' : 'dates'}</span></div>
          <div><span class="stub-value">${totalSold.toLocaleString('en-MY')}</span><span class="stub-label">tickets sold</span></div>
          <div><span class="stub-value">${event.min_price === null || event.min_price === undefined ? '—' : formatMoney(event.min_price)}</span><span class="stub-label">lowest price</span></div>
        </div>
        <div class="stub-code" aria-hidden="true">
          <span class="barcode"></span>
          <span class="code-text">TX-EVT-${String(event.id).padStart(5, '0')}</span>
        </div>
      </div>
    </section>

    <div class="notice-stack">
      ${!manage ? '<div class="alert alert-info">View only. Only this event\'s organiser or an admin can change it.</div>' : ''}
      ${event.status === 'draft' && manage ? '<div class="alert alert-info">Customers can\'t see drafts. Add an upcoming date, then publish.</div>' : ''}
      ${cancelled ? '<div class="alert alert-warn">This event is cancelled. Its dates are closed to new bookings.</div>' : ''}
    </div>

    <section class="section">
      <div class="section-head">
        <div>
          <h2>Dates and venues</h2>
          <p class="muted">Each date has its own venue, price and ticket stock.</p>
        </div>
        ${manage && !cancelled ? '<button class="btn btn-primary" type="button" data-action="add-schedule">Add date</button>' : ''}
      </div>
      <div id="schedule-panel"></div>
      ${event.schedules.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Date</th><th>Venue</th><th class="num">Price</th>
              <th>Sold</th><th>Status</th>${manage ? '<th><span class="sr-only">Actions</span></th>' : ''}
            </tr></thead>
            <tbody>
              ${event.schedules.map((s) => {
                const sold = s.total_tickets - s.available_tickets;
                const locked = cancelled || isPast(s);
                const pct = Math.round((sold / s.total_tickets) * 100);
                return `<tr>
                  <td><div class="when">${formatDateTime(s.start_time)}</div><div class="sub">until ${formatTime(s.end_time)}${isPast(s) ? ', past' : ''}</div></td>
                  <td>${esc(s.venue_name)}<div class="sub">${esc(s.venue_city)}</div></td>
                  <td class="num">${formatMoney(s.ticket_price)}</td>
                  <td><div class="meter">
                    <span class="meter-text">${sold.toLocaleString('en-MY')} of ${s.total_tickets.toLocaleString('en-MY')}</span>
                    <span class="meter-track" role="img" aria-label="${pct}% sold"><span class="meter-fill" style="width:${pct}%"></span></span>
                  </div></td>
                  <td>${badge(s.status)}</td>
                  ${manage ? `<td class="num"><span class="actions" style="justify-content:flex-end">
                    <button class="btn btn-secondary btn-sm" type="button" data-edit="${s.id}" ${locked ? 'disabled title="Past dates and cancelled events can\'t be changed"' : ''}>Edit</button>
                    <button class="btn btn-danger btn-sm" type="button" data-delete="${s.id}">Delete</button>
                  </span></td>` : ''}
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>` : `<div class="table-wrap">${emptyHtml('No dates yet', manage && !cancelled ? 'Add a date and venue so customers can book tickets.' : 'This event has no dates.')}</div>`}
    </section>`;

  const reload = () => renderEventDetail(el, id);
  const panel = el.querySelector('#schedule-panel');

  // ----- Event actions -----
  el.querySelector('[data-action="publish"]')?.addEventListener('click', (e) =>
    changeStatus(e.currentTarget, event.id, 'published', reload));

  el.querySelector('[data-action="cancel"]')?.addEventListener('click', (e) => {
    if (confirm('Cancel this event? All its schedules will be closed and no new bookings can be made. This cannot be undone.')) {
      changeStatus(e.currentTarget, event.id, 'cancelled', reload);
    }
  });

  el.querySelector('[data-action="delete"]')?.addEventListener('click', async (e) => {
    if (!confirm(`Delete "${event.title}"? This removes the event and its schedules.`)) return;
    const button = e.currentTarget;
    setBusy(button, true);
    try {
      const res = await api.del(`/events/${event.id}`);
      toast(res.message);
      location.hash = '#/events';
    } catch (err) {
      if (!handleAuthError(err)) toast(err.message, 'error');
      setBusy(button, false);
    }
  });

  // ----- Schedule actions -----
  el.querySelector('[data-action="add-schedule"]')?.addEventListener('click', () =>
    openScheduleForm(panel, event, null, reload));

  el.querySelectorAll('[data-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const schedule = event.schedules.find((s) => s.id === Number(button.dataset.edit));
      openScheduleForm(panel, event, schedule, reload);
    });
  });

  el.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirm('Delete this date? Customers will no longer see it.')) return;
      setBusy(button, true);
      try {
        const res = await api.del(`/schedules/${button.dataset.delete}`);
        toast(res.message);
        reload();
      } catch (err) {
        if (!handleAuthError(err)) toast(err.message, 'error');
        setBusy(button, false);
      }
    });
  });
}

async function changeStatus(button, eventId, status, reload) {
  setBusy(button, true);
  try {
    const res = await api.patch(`/events/${eventId}`, { status });
    toast(res.message);
    reload();
  } catch (err) {
    if (!handleAuthError(err)) toast(err.message, 'error');
    setBusy(button, false);
  }
}

// ----- Add / edit schedule form -----
async function openScheduleForm(panel, event, schedule, reload) {
  const editing = Boolean(schedule);
  panel.innerHTML = loadingHtml('Loading venues…');

  let venues;
  try {
    venues = await getVenues();
  } catch (err) {
    return showError(panel, err, () => openScheduleForm(panel, event, schedule, reload));
  }

  const sold = editing ? schedule.total_tickets - schedule.available_tickets : 0;
  const minStart = nowLocalInput();

  panel.innerHTML = `
    <form class="panel" id="schedule-form" novalidate>
      <h2>${editing ? 'Edit date' : 'Add a date'}</h2>
      <div class="alert alert-error" data-form-alert hidden></div>
      <div class="form-grid">
        ${fieldHtml({ name: 'venue_id', label: 'Venue', required: true, full: true,
          control: `<select id="f-venue_id" name="venue_id">
            <option value="">Choose a venue</option>
            ${venues.map((v) => `<option value="${v.id}" data-capacity="${v.capacity}" ${schedule?.venue_id === v.id ? 'selected' : ''}>
              ${esc(v.name)}, ${esc(v.city)} (capacity ${v.capacity})</option>`).join('')}
          </select>` })}
        ${fieldHtml({ name: 'start_time', label: 'Starts', required: true, hint: 'Malaysia time',
          control: `<input id="f-start_time" name="start_time" type="datetime-local" min="${minStart}" value="${toLocalInput(schedule?.start_time)}">` })}
        ${fieldHtml({ name: 'end_time', label: 'Ends', required: true, hint: 'Must be after the start',
          control: `<input id="f-end_time" name="end_time" type="datetime-local" min="${minStart}" value="${toLocalInput(schedule?.end_time)}">` })}
        ${fieldHtml({ name: 'ticket_price', label: 'Ticket price (RM)', required: true, hint: 'Use 0 for a free event',
          control: `<input id="f-ticket_price" name="ticket_price" type="number" min="0" max="100000" step="0.01" value="${schedule?.ticket_price ?? ''}">` })}
        ${fieldHtml({ name: 'total_tickets', label: 'Total tickets', required: true,
          hint: editing ? `${sold} already sold, so it can't go lower than that` : 'Cannot be more than the venue capacity',
          control: `<input id="f-total_tickets" name="total_tickets" type="number" min="${Math.max(sold, 1)}" step="1" value="${schedule?.total_tickets ?? ''}">` })}
        ${editing ? fieldHtml({ name: 'status', label: 'Bookings', hint: 'Close to stop new bookings',
          control: `<select id="f-status" name="status">
            <option value="open" ${schedule.status !== 'closed' ? 'selected' : ''}>Open</option>
            <option value="closed" ${schedule.status === 'closed' ? 'selected' : ''}>Closed</option>
          </select>` }) : ''}
      </div>
      <div class="form-footer">
        <button class="btn btn-secondary" type="button" data-close>Close</button>
        <button class="btn btn-primary" type="submit">${editing ? 'Save date' : 'Add date'}</button>
      </div>
    </form>`;

  const form = panel.querySelector('#schedule-form');
  form.scrollIntoView({ block: 'start', behavior: 'smooth' });
  form.querySelector('[data-close]').addEventListener('click', () => { panel.innerHTML = ''; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const venueOption = form.venue_id.selectedOptions[0];
    const capacity = Number(venueOption?.dataset.capacity || 0);
    const start = form.start_time.value;
    const end = form.end_time.value;
    const price = form.ticket_price.value;
    const total = form.total_tickets.value;

    // Same rules as the API, so the user gets instant feedback
    const errors = [];
    if (!form.venue_id.value) errors.push({ field: 'venue_id', message: 'Choose a venue' });
    if (!start) errors.push({ field: 'start_time', message: 'Start date and time are required' });
    else if (new Date(fromLocalInput(start)) <= new Date()) errors.push({ field: 'start_time', message: 'Start must be in the future' });
    if (!end) errors.push({ field: 'end_time', message: 'End date and time are required' });
    else if (start && end <= start) errors.push({ field: 'end_time', message: 'End must be after the start' });
    if (price === '' || Number(price) < 0) errors.push({ field: 'ticket_price', message: 'Enter a price of 0 or more' });
    if (!Number.isInteger(Number(total)) || Number(total) < 1) {
      errors.push({ field: 'total_tickets', message: 'Enter a whole number of at least 1' });
    } else if (capacity && Number(total) > capacity) {
      errors.push({ field: 'total_tickets', message: `This venue holds at most ${capacity} people` });
    } else if (Number(total) < sold) {
      errors.push({ field: 'total_tickets', message: `${sold} tickets are already sold` });
    }
    if (errors.length) return showFormErrors(form, errors);

    const body = {
      venue_id: Number(form.venue_id.value),
      start_time: fromLocalInput(start),
      end_time: fromLocalInput(end),
      ticket_price: Number(price),
      total_tickets: Number(total),
    };
    if (editing) body.status = form.status.value;

    const button = form.querySelector('[type="submit"]');
    setBusy(button, true, 'Saving…');
    try {
      const res = editing
        ? await api.put(`/schedules/${schedule.id}`, body)
        : await api.post(`/events/${event.id}/schedules`, body);
      toast(res.message);
      reload();
    } catch (err) {
      // e.g. 409 "The venue is already booked at this time"
      showApiFormError(form, err);
      setBusy(button, false);
    }
  });
}
