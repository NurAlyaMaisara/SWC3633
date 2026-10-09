// =====================================================================
// Add venue (POST /venues) and edit venue (PUT /venues/:id).
// =====================================================================
import { api } from '../api.js';
import { canManage } from '../session.js';
import {
  esc, fieldHtml, loadingHtml, showError, clearFormErrors, showFormErrors,
  showApiFormError, setBusy, toast,
} from '../ui.js';

const STATES = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis',
  'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu',
  'Wilayah Persekutuan Kuala Lumpur', 'Wilayah Persekutuan Labuan', 'Wilayah Persekutuan Putrajaya',
];

function validate(v) {
  const errors = [];
  const required = { name: 150, address: 255, city: 100, state: 100 };
  Object.entries(required).forEach(([field, max]) => {
    if (!v[field]) errors.push({ field, message: `${field[0].toUpperCase()}${field.slice(1)} is required` });
    else if (v[field].length > max) errors.push({ field, message: `Must be at most ${max} characters` });
  });
  const capacity = Number(v.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200000) {
    errors.push({ field: 'capacity', message: 'Capacity must be a whole number from 1 to 200000' });
  }
  if (v.facilities.length > 1000) errors.push({ field: 'facilities', message: 'Must be at most 1000 characters' });
  return errors;
}

export async function renderVenueForm(el, id) {
  const editing = Boolean(id);
  let venue = null;

  if (editing) {
    el.innerHTML = loadingHtml('Loading venue…');
    try {
      venue = (await api.get(`/venues/${id}`)).data;
    } catch (err) {
      return showError(el, err, () => renderVenueForm(el, id));
    }
    if (!canManage(venue.created_by)) {
      el.innerHTML = `<a class="back-link" href="#/venues">← Back to venues</a>
        <div class="alert alert-error">You can only edit venues you added.</div>`;
      return;
    }
  }

  el.innerHTML = `
    <a class="back-link" href="#/venues">← Back to venues</a>
    <div class="page-head">
      <div>
        <h1>${editing ? 'Edit venue' : 'New venue'}</h1>
        <p class="muted">${editing ? esc(venue.name) : 'Add a place where events can be scheduled.'}</p>
      </div>
    </div>
    <form class="card form-card" id="venue-form" novalidate>
      <div class="alert alert-error" data-form-alert hidden></div>
      <div class="form-grid">
        ${fieldHtml({ name: 'name', label: 'Venue name', required: true, full: true,
          control: `<input id="f-name" name="name" maxlength="150" value="${esc(venue?.name)}" placeholder="e.g. Dewan Komuniti Cheras">` })}
        ${fieldHtml({ name: 'address', label: 'Address', required: true, full: true,
          control: `<input id="f-address" name="address" maxlength="255" value="${esc(venue?.address)}">` })}
        ${fieldHtml({ name: 'city', label: 'City', required: true,
          control: `<input id="f-city" name="city" maxlength="100" value="${esc(venue?.city)}">` })}
        ${fieldHtml({ name: 'state', label: 'State', required: true,
          control: `<input id="f-state" name="state" list="states" maxlength="100" value="${esc(venue?.state)}">
            <datalist id="states">${STATES.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>` })}
        ${fieldHtml({ name: 'capacity', label: 'Capacity', required: true,
          hint: editing ? 'Cannot go below the tickets of an upcoming schedule here' : 'Maximum number of people',
          control: `<input id="f-capacity" name="capacity" type="number" min="1" max="200000" step="1" value="${venue?.capacity ?? ''}">` })}
        ${fieldHtml({ name: 'facilities', label: 'Facilities', hint: 'Optional, e.g. parking, Wi-Fi, stage',
          control: `<input id="f-facilities" name="facilities" maxlength="1000" value="${esc(venue?.facilities)}">` })}
      </div>
      <div class="form-footer">
        <a class="btn btn-secondary" href="#/venues">Cancel</a>
        <button class="btn btn-primary" type="submit">${editing ? 'Save changes' : 'Add venue'}</button>
      </div>
    </form>`;

  const form = el.querySelector('#venue-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const values = {
      name: form.name.value.trim(),
      address: form.address.value.trim(),
      city: form.city.value.trim(),
      state: form.state.value.trim(),
      capacity: form.capacity.value,
      facilities: form.facilities.value.trim(),
    };
    const errors = validate(values);
    if (errors.length) return showFormErrors(form, errors);

    const body = { ...values, capacity: Number(values.capacity), facilities: values.facilities || null };
    const button = form.querySelector('[type="submit"]');
    setBusy(button, true, 'Saving…');
    try {
      const res = editing ? await api.put(`/venues/${id}`, body) : await api.post('/venues', body);
      toast(res.message);
      location.hash = '#/venues';
    } catch (err) {
      // e.g. 409 duplicate name, or capacity lower than an upcoming schedule
      showApiFormError(form, err);
    } finally {
      setBusy(button, false);
    }
  });
}
