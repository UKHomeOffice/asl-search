const { get, merge, pick, isEmpty } = require('lodash');
const sortParams = require('../helpers/sort-params');
const { andFilter, orFilter } = require('../helpers/filters');

const sortable = ['site', 'area', 'name'];
const index = 'places';

module.exports = (client) => {
  const search = async ({ query, defaultParams }) => {
    const params = merge({}, defaultParams, sortParams(query, sortable));

    if (query.filters) {
      const andFilters = pick(query.filters, ['suitability', 'holding']);

      if (!isEmpty(andFilters)) {
        params.body.query.bool.filter = params.body.query.bool.filter.concat(andFilter(andFilters, 'value'));
      }

      const orFilters = pick(query.filters, ['nacwos', 'nvssqps']);

      if (!isEmpty(orFilters)) {
        params.body.query.bool.filter = params.body.query.bool.filter.concat(orFilter(orFilters, 'name'));
      }
      if (query.filters.site) {
        params.body.query.bool.filter = params.body.query.bool.filter.concat(orFilter({ site: query.filters.site }, 'value'));
      }
    }

    if (!query.term) {
      return client.search(params);
    }

    const fields = [
      'name',
      'site',
      'area',
      'nacwos.firstName',
      'nacwos.lastName',
      'nvssqps.firstName',
      'nvssqps.lastName'
    ];

    const tokeniser = await client.indices.analyze({ index, body: { text: query.term } });
    const tokens = tokeniser.body.tokens.map(t => t.token);

    params.body.query.bool.minimum_should_match = tokens.length;
    params.body.query.bool.should = [
      ...tokens.map(token => ({
        multi_match: {
          fields,
          query: token,
          fuzziness: 'AUTO',
          operator: 'and',
          boost: 1.5
        }
      }))
    ];

    return client.search(params);
  };

  const getFilters = async (defaultParams) => {
    const aggregationParams = merge({}, defaultParams, {
      size: 0, // return only aggregations, we don't want any documents
      body: {
        aggs: {
          site: {
            terms: { field: 'site.value', size: 1000 } // defaults to 10 values per aggregation, up the limit to 1000
          },
          area: {
            terms: { field: 'area.value', size: 1000 }
          },
          suitability: {
            terms: { field: 'suitability.value', size: 1000 }
          },
          holding: {
            terms: { field: 'holding.value', size: 1000 }
          },
          nacwos: {
            terms: { field: 'nacwos.name.value', size: 1000 }
          },
          nvssqps: {
            terms: { field: 'nvssqps.name.value', size: 1000 }
          }
        }
      }
    });

    const response = await client.search(aggregationParams);

    const getValues = key => get(response.body, `aggregations.${key}.buckets`, []).map(b => b.key).sort();
    const getLabelValues = key => getValues(key).map(value => ({ label: value, value }));

    const filters = [
      { key: 'site', values: getValues('site') },
      { key: 'area', values: getValues('area') },
      { key: 'suitability', values: getValues('suitability') },
      { key: 'holding', values: getValues('holding') },
      { key: 'nacwos', values: getLabelValues('nacwos') },
      { key: 'nvssqps', values: getLabelValues('nvssqps') }
    ];

    return filters;
  };

  return {
    search,
    getFilters
  };
};
