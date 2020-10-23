const { reduce } = require('lodash');

// Convert datatable query filters into boolean query, e.g.
//
// in:
// {
//   suitability: [ 'CAT', 'DOG' ],
//   site: [ 'Apollo House' ]
// }
//
// out:
// [
//   {
//     term: { 'suitability.value': 'CAT' }
//   },
//   {
//     term: { 'suitability.value': 'DOG' }
//   },
//   {
//     term: { 'site.value': 'lunar' }
//   }
// ];
//
// Ensure the mapping was defined in the following format, where '.value' needs to be of type 'keyword', otherwise
// the filters may not work correctly (or at all):
//
// site: {
//   type: 'text',
//   fields: {
//     value: {
//       type: 'keyword'
//     }
//   }
// },
//
//
module.exports = queryFilters => {
  return reduce(queryFilters, (acc, filter, key) => {
    return acc.concat(filter.map(value => {
      return {
        term: {
          [`${key}.value`]: value
        }
      };
    }));
  }, []);
};
