module.exports = (query = {}, columns) => {
  const size = parseInt(query.limit, 10) || 10;
  const from = parseInt(query.offset, 10) || 0;

  const getSearchProp = field => `${field}.value`; // sort must use keyword type, so use the "value" mapping

  let sort = columns.map(col => ({ [getSearchProp(col)]: 'asc' }));

  // default sort order e.g.
  // [
  //   { 'site.value': 'asc' },
  //   { 'area.value': 'asc' },
  //   { 'name.value': 'asc' },
  // ]

  if (query.sort && query.sort.column && columns.includes(query.sort.column)) {
    sort = sort.filter(item => !(getSearchProp(query.sort.column) in item)); // remove the column
    sort.unshift({ [getSearchProp(query.sort.column)]: query.sort.ascending === 'true' ? 'asc' : 'desc' }); // put it first
  }

  // if there is no defined sort order and there is a search term then default to closest match
  if (!query.sort && query.term) {
    sort = undefined;
  }

  return {
    size,
    from,
    search_type: sort ? undefined : 'dfs_query_then_fetch',
    body: { sort }
  };
};
