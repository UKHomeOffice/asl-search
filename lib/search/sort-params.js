module.exports = (term = '', query = {}, columns) => {
  let sort;
  const size = parseInt(query.limit, 10) || 10;
  const from = parseInt(query.offset, 10) || 0;

  if (query.sort && query.sort.column) {
    if (columns.includes(query.sort.column)) {
      sort = { [`${query.sort.column}.value`]: query.sort.ascending === 'true' ? 'asc' : 'desc' };
    }
  }

  return {
    size,
    from,
    body: { sort }
  };
};
