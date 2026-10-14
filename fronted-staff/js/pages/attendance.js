// =====================================================================
// Attendance page (Integration & API Management Lead)
// Staff views all check-ins recorded in this session.
// Calls: GET /attendance
// =====================================================================
import { api } from '../api.js';
import { esc } from '../ui.js';

export function renderAttendance(el) {
  el.innerHTML = `
    <header class="page-head">
      <div>
        <h1>Attendance</h1>
        <p class="muted">All check-ins recorded while the API is running.</p>
      </div>
      <button class="btn btn-ghost" type="button" data-refresh>Refresh</button>
    </header>

    <section id="attendance-body" aria-live="polite">
      <p class="muted">Loading…</p>
    </section>`;

  const body = el.querySelector('#attendance-body');
  el.querySelector('[data-refresh]').addEventListener('click', () => load(body));
  load(body);
}

async function load(root) {
  root.innerHTML = `<p class="muted">Loading…</p>`;
  try {
    const res = await api.get('/attendance');
    draw(root, res.data);
  } catch (err) {
    root.innerHTML = `<div class="card card-pad"><p class="alert alert-error">${esc(err.message)}</p></div>`;
  }
}

function draw(root, data) {
  const { total_check_ins, items } = data;

  if (!items.length) {
    root.innerHTML = `
      <div class="card card-pad">
        <p class="muted">No check-ins yet. Scan a booking to see it here.</p>
      </div>`;
    return;
  }

  root.innerHTML = `
    <div class="card card-pad">
      <header class="row between">
        <h2>${esc(total_check_ins)} check-in${total_check_ins === 1 ? '' : 's'}</h2>
      </header>
      <table class="table">
        <thead>
          <tr>
            <th>Booking</th>
            <th>Booking ID</th>
            <th>Staff ID</th>
            <th>Checked in at</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((i) => `
            <tr>
              <td><strong>${esc(i.booking_ref)}</strong></td>
              <td>${esc(i.booking_id)}</td>
              <td>${esc(i.staff_id)}</td>
              <td>${esc(new Date(i.checked_in_at).toLocaleString('en-MY'))}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}