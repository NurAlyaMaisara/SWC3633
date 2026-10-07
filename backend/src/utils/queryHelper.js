// Shared helpers for pagination, sorting and search on list endpoints.
// (The Integration & API Management lead may move these into their own module.)
const MAX_LIMIT = 50;

function getPagination(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), MAX_LIMIT);
  return { page, limit, offset: (page - 1) * limit };
}

// `allowed` maps API sort names to SQL expressions. Only whitelisted names reach
// the SQL, so ?sort= can never be used for SQL injection in ORDER BY.
function getOrderBy(query, allowed, defaultField, defaultOrder = 'asc') {
  const field = Object.prototype.hasOwnProperty.call(allowed, query.sort) ? query.sort : defaultField;
  const direction = String(query.order || defaultOrder).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  return `${allowed[field]} ${direction}`;
}

function buildMeta(page, limit, total) {
  return { page, limit, total, total_pages: Math.ceil(total / limit) };
}

// Escapes LIKE wildcards so a search for "50%" matches the text literally
function likePattern(term) {
  return `%${String(term).replace(/[\\%_]/g, '\\$&')}%`;
}

// Date-only values ("2026-12-31") cover the whole day in Malaysia time
function toDate(value, endOfDay = false) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}+08:00`);
  }
  return new Date(value);
}

module.exports = { getPagination, getOrderBy, buildMeta, likePattern, toDate };
