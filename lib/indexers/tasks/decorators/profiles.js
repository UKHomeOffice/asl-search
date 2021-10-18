const Cacheable = require('./cacheable');
const { get, pick } = require('lodash');

const cleanModel = profile => pick(profile, 'id', 'firstName', 'lastName');

module.exports = aslSchema => {
  const { Profile } = aslSchema;
  const cache = Cacheable();

  return async task => {
    const subjectId = get(task, 'data.subject');
    const licenceHolderId = get(task, 'data.modelData.licenceHolderId') || get(task, 'data.data.licenceHolderId');
    const assignedAsruId = get(task, 'assignedTo');

    if (subjectId) {
      task.subject = cleanModel(await cache.query(Profile, subjectId));
    }

    if (licenceHolderId) {
      task.licenceHolder = cleanModel(await cache.query(Profile, licenceHolderId));
    }

    if (assignedAsruId) {
      task.assignedTo = cleanModel(await cache.query(Profile, assignedAsruId));
    }

    return task;
  };
};
