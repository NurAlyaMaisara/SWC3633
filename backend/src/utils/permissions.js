// Admin can manage anything; an organiser can only manage records they own
exports.canManage = (user, ownerId) =>
  Boolean(user) &&
  (user.role === 'admin' || (user.role === 'organiser' && Number(user.id) === Number(ownerId)));
