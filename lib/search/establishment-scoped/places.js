const { get, merge } = require('lodash');
const sortParams = require('../helpers/sort-params');
const filtersToBoolQuery = require('../helpers/filters-to-bool-query');
const util = require('util');

const sortable = ['name', 'site', 'area'];
const index = 'places';

module.exports = (client) => {
  const search = async ({ query, defaultParams }) => {
    const params = merge({}, defaultParams, sortParams(query.term, query, sortable));

    if (query.filters) {
      if (query.filters.nacwos) {
        query.filters['nacwos.name'] = query.filters.nacwos;
        delete query.filters.nacwos;
      }
      if (query.filters.nvssqps) {
        query.filters['nvssqps.name'] = query.filters.nvssqps;
        delete query.filters.nvssqps;
      }
      params.body.query.bool.filter = params.body.query.bool.filter.concat(filtersToBoolQuery(query.filters));
    }

    if (!query.term) {
      console.log(util.inspect(params, false, null, true));
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

    console.log(util.inspect(params, false, null, true));
    return client.search(params);
  };

  const getFilters = async (defaultParams) => {
    const aggregationParams = merge({}, defaultParams, {
      size: 0, // return only aggregations, we don't want any documents
      body: {
        aggs: {
          site: {
            terms: { field: 'site.value', size: 1000 } // defaults to 10 results per aggregation, up the limit to 1000
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

    // console.log(util.inspect(response, false, null, true));

    const getValues = key => get(response.body, `aggregations.${key}.buckets`, []).map(b => b.key).sort();

    const getLabelValues = key => getValues(key).map(value => ({ label: value, value }));

    const filters = [
      { key: 'site', values: getValues('site') },
      { key: 'suitability', values: getValues('suitability') },
      { key: 'holding', values: getValues('holding') },
      { key: 'nacwos', values: getLabelValues('nacwos') },
      { key: 'nvssqps', values: getLabelValues('nvssqps') }
    ];

    console.log(util.inspect(filters, false, null, true));

    return filters;
  };

  return {
    search,
    getFilters
  };
};
