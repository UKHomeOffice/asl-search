const { reduce } = require('lodash');

// Converts datatable query filters into elasticsearch boolean querys.
//
// Filters need to be of type 'keyword', otherwise they may not work correctly (or at all).
// e.g. if your mapping is as follows:
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
// then you must use `site.value` and not just `site`.
//
module.exports = {
  // AND query output:
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
  andFilter: (filters, childProp) => {
    return reduce(filters, (acc, filter, key) => {
      return acc.concat(filter.map(value => {
        const path = childProp ? `${key}.${childProp}` : key;
        return {
          term: {
            [path]: value
          }
        };
      }));
    }, []);
  },

  // OR query output:
  // [
  //   {
  //     terms: { 'nacwos.name': [ 'Brian Proudfoot', 'Ian Ayers' ] } // Brian OR Ian
  //   },
  //   {
  //     terms: { 'nvssqps.name': [ 'Kingsley Collins', 'Aaron Harris' ] } // AND Kingsley OR Aaron
  //   }
  // ];
  orFilter: (filters, childProp) => {
    return reduce(filters, (acc, filter, key) => {
      const path = childProp ? `${key}.${childProp}` : key;
      return acc.concat({
        'terms': {
          [path]: filter
        }
      });
    }, []);
  }
};
