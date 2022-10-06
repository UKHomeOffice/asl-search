const sortParams = require('../helpers/sort-params');

const index = 'enforcements';
const sortable = ['caseNumber', 'createdAt', 'updatedAt'];

module.exports = client => async (term = '', query = {}) => {
  const params = {
    index,
    ...sortParams(query, sortable)
  };

  params.body.query = { bool: {} };

  params.body.highlight = {
    fields: {
      '*': { type: 'plain', pre_tags: '**', post_tags: '**' }
    }
  };

  if (!term) {
    return client.search(params);
  }

  // search subset of fields
  const fields = [
    'subjects.profile.firstName',
    'subjects.profile.lastName',
    'subjects.establishment',
    'subjects.establishmentKeywords'
  ];

  const licenceNumberFields = [
    'caseNumber',
    'subjects.flags.project.licenceNumber',
    'subjects.flags.establishment.licenceNumber',
    'subjects.flags.profile.pilLicenceNumber'
  ];

  const tokeniser = await client.indices.analyze({ index, body: { text: term } });
  const tokens = tokeniser.body.tokens.map(t => t.token);

  params.body.query.bool.minimum_should_match = tokens.length;
  params.body.query.bool.should = [
    ...tokens.map(token => ({
      multi_match: {
        fields: licenceNumberFields,
        query: token,
        operator: 'OR',
        boost: 2
      }
    })),
    ...tokens.map(token => ({
      multi_match: {
        fields,
        query: token,
        fuzziness: 'AUTO',
        operator: 'and'
      }
    }))
  ];

  return client.search(params);
};
