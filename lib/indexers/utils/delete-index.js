const { get } = require('lodash');

const wait = (t = 30000) => new Promise(resolve => setTimeout(resolve, t));

const reset = (client, index, options = {}) => {
  return Promise.resolve()
    .then(() => client.indices.delete({ index }))
    .catch(e => {
      if (get(e, 'body.error.type') === 'index_not_found_exception') {
        return;
      }
      if (get(e, 'body.error.type') === 'snapshot_in_progress_exception' && !options.retry) {
        return wait(30000).then(() => reset(client, index, { retry: true }));
      }
      throw e;
    });
};
module.exports = reset;
