// =====================================================================
// Create event (POST /events) and edit event (PUT /events/:id).
// The form is checked in the browser first, then the API checks it again.
// =====================================================================
import { api } from '../api.js';
import { canManage } from '../session.js';
import {
  esc, fieldHtml, loadingHtml, showError, clearFormErrors, showFormErrors,
  showApiFormError, setBusy, toast,
} from '../ui.js';

function validate(values) {
  const errors = [];
  if (!values.title) errors.push({ field: 'title', message: 'Title is required' });
  else if (values.title.length > 150) errors.push({ field: 'title', message: 'Title must be at most 150 characters' });
  if (!values.category_id) errors.push({ field: 'category_id', message: 'Choose a category' });
  if (values.description.length > 5000) errors.push({ field: 'description', message: 'Description must be at most 5000 characters' });
  if (values.image_url && !/^https?:\/\/\S+$/i.test(values.image_url)) {
    errors.push({ field: 'image_url', message: 'Image URL must start with http:// or https://' });
  }
  return errors;
}

export async function renderEventForm(el, id) {
  const editing = Boolean(id);
  el.innerHTML = loadingHtml(editing ? 'Loading event…' : 'Loading…');

  let categories;
  let event = null;
  try {
    const [catRes, eventRes] = await Promise.all([
      api.get('/categories'),
      editing ? api.get(`/events/${id}`) : Promise.resolve(null),
    ]);
    categories = catRes.data;
    event = eventRes?.data || null;
  } catch (err) {
    return showError(el, err, () => renderEventForm(el, id));
  }

  const back = editing ? `#/events/${id}` : '#/events';
  if (editing && !canManage(event.organiser_id)) {
    el.innerHTML = `<a class="back-link" href="${back}">← Back</a>
      <div class="alert alert-error">You can only edit your own events. This event belongs to ${esc(event.organiser_name)}.</div>`;
    return;
  }
  const locked = editing && event.status === 'cancelled';

  el.innerHTML = `
    <a class="back-link" href="${back}">← Back</a>
    <div class="page-head">
      <div>
        <h1>${editing ? 'Edit event' : 'New event'}</h1>
        <p class="muted">${editing ? esc(event.title) : 'New events start as drafts. Add a schedule, then publish.'}</p>
      </div>
    </div>
    <form class="card form-card" id="event-form" novalidate>
      ${locked ? '<div class="alert alert-warn">This event is cancelled, so it can no longer be edited.</div>' : ''}
      <div class="alert alert-error" data-form-alert hidden></div>
      <fieldset style="border:0;padding:0;margin:0" ${locked ? 'disabled' : ''}>
        <div class="form-grid">
          ${fieldHtml({ name: 'title', label: 'Title', required: true, full: true,
            control: `<input id="f-title" name="title" maxlength="150" value="${esc(event?.title)}" placeholder="e.g. Python for Beginners">` })}
          ${fieldHtml({ name: 'category_id', label: 'Category', required: true,
            control: `<select id="f-category_id" name="category_id">
              <option value="">Choose a category</option>
              ${categories.map((c) => `<option value="${c.id}" ${event?.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
            </select>` })}
          ${fieldHtml({ name: 'image_url', label: 'Poster image URL', hint: 'Optional. A link to an image, starting with https://',
            control: `<input id="f-image_url" name="image_url" type="url" value="${esc(event?.image_url)}" placeholder="https://…">` })}
          ${fieldHtml({ name: 'description', label: 'Description', full: true, hint: 'Optional, up to 5000 characters.',
            control: `<textarea id="f-description" name="description" maxlength="5000">${esc(event?.description)}</textarea>` })}
        </div>
        <div class="form-footer">
          <a class="btn btn-secondary" href="${back}">Cancel</a>
          <button class="btn btn-primary" type="submit">${editing ? 'Save changes' : 'Create draft event'}</button>
        </div>
      </fieldset>
    </form>`;

  const form = el.querySelector('#event-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const values = {
      title: form.title.value.trim(),
      category_id: form.category_id.value,
      description: form.description.value.trim(),
      image_url: form.image_url.value.trim(),
    };
    const errors = validate(values);
    if (errors.length) return showFormErrors(form, errors);

    const body = {
      title: values.title,
      category_id: Number(values.category_id),
      description: values.description || null,
      image_url: values.image_url || null,
    };

    const button = form.querySelector('[type="submit"]');
    setBusy(button, true, 'Saving…');
    try {
      const res = editing
        ? await api.put(`/events/${id}`, body)
        : await api.post('/events', body);
      toast(res.message);
      location.hash = `#/events/${res.data.id}`;
    } catch (err) {
      showApiFormError(form, err);
    } finally {
      setBusy(button, false);
    }
  });
}
