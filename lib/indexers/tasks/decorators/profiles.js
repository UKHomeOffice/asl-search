const Cacheable = require('./cacheable');
const { get, pick } = require('lodash');

module.exports = aslSchema => {
  const { Profile } = aslSchema;
  const cache = Cacheable();

  return async task => {
    const licenceHolderId = get(task, 'data.modelData.licenceHolderId') || get(task, 'data.data.licenceHolderId');

    if (licenceHolderId) {
      const licenceHolder = await cache.query(Profile, licenceHolderId);
      task.licenceHolder = pick(licenceHolder, 'id', 'firstName', 'lastName');
    }

    const assignedAsruId = get(task, 'assignedTo');

    if (assignedAsruId) {
      const asruUser = await cache.query(Profile, assignedAsruId);
      task.asruUser = pick(asruUser, 'id', 'firstName', 'lastName');
    }

    return task;
  };
};
