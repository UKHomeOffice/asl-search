const Cacheable = require('./cacheable');
const { get, pick } = require('lodash');

module.exports = aslSchema => {
  const { Profile } = aslSchema;
  const cache = Cacheable();

  return task => {
    let licenceHolderId = get(task, 'data.modelData.licenceHolderId') || get(task, 'data.data.licenceHolderId');

    if (licenceHolderId) {
      return task;
    }

    return cache.query(Profile, licenceHolderId)
      .then(licenceHolder => {
        return {
          ...task,
          licenceHolder: pick(licenceHolder, 'id', 'name', 'firstName', 'lastName')
        };
      });
  };
};
