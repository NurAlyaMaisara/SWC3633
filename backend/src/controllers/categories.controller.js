const pool = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

async function findCategory(id) {
  const [rows] = await pool.query('SELECT id, name, description FROM event_categories WHERE id = ?', [id]);
  if (!rows.length) throw ApiError.notFound(`Category with id ${id} not found`);
  return rows[0];
}

async function assertUniqueName(name, excludeId = 0) {
  const [rows] = await pool.query('SELECT id FROM event_categories WHERE name = ? AND id <> ?', [name, excludeId]);
  if (rows.length) throw ApiError.conflict(`A category named "${name}" already exists`);
}

// GET /categories
exports.listCategories = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.id, c.name, c.description,
            (SELECT COUNT(*) FROM events e WHERE e.category_id = c.id AND e.status = 'published') AS event_count
       FROM event_categories c
      ORDER BY c.name ASC`
  );
  sendSuccess(res, { message: 'Categories retrieved successfully', data: rows });
});

// GET /categories/:id
exports.getCategory = asyncHandler(async (req, res) => {
  const category = await findCategory(req.params.id);
  sendSuccess(res, { message: 'Category retrieved successfully', data: category });
});

// POST /categories
exports.createCategory = asyncHandler(async (req, res) => {
  const { name, description = null } = req.body;
  await assertUniqueName(name);
  const [result] = await pool.query(
    'INSERT INTO event_categories (name, description) VALUES (?, ?)',
    [name, description]
  );
  const category = await findCategory(result.insertId);
  sendSuccess(res, { statusCode: 201, message: 'Category created successfully', data: category });
});

// PUT /categories/:id
exports.updateCategory = asyncHandler(async (req, res) => {
  const category = await findCategory(req.params.id);
  const { name, description = null } = req.body;
  await assertUniqueName(name, category.id);
  await pool.query('UPDATE event_categories SET name = ?, description = ? WHERE id = ?', [name, description, category.id]);
  sendSuccess(res, { message: 'Category updated successfully', data: await findCategory(category.id) });
});

// DELETE /categories/:id
exports.deleteCategory = asyncHandler(async (req, res) => {
  const category = await findCategory(req.params.id);
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM events WHERE category_id = ?', [category.id]);
  if (total > 0) {
    throw ApiError.conflict(`Category cannot be deleted because ${total} event(s) use it`);
  }
  await pool.query('DELETE FROM event_categories WHERE id = ?', [category.id]);
  sendSuccess(res, { message: 'Category deleted successfully', data: { id: category.id } });
});
