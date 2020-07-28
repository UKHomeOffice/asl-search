module.exports = (term = '', query = {}, defaults) => {
  let sort;
  const size = parseInt(query.limit, 10) || 10;
  const from = parseInt(query.offset, 10) || 0;

  if (query.sort) {
    sort = { [`${query.sort.column}.value`]: query.sort.ascending === 'true' ? 'asc' : 'desc' };
  } else if (!term) {
    sort = defaults;
  }

  return {
    size,
    from,
    body: { sort }
  };
};
