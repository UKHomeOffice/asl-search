const Cacheable = require('./cacheable');
const { get } = require('lodash');

const columns = ['id', 'firstName', 'lastName'];

module.exports = aslSchema => {
  const { Profile } = aslSchema;
  const cache = Cacheable();

  return async task => {
    const subjectId = get(task, 'data.subject');
    const licenceHolderId = get(task, 'data.modelData.licenceHolderId') || get(task, 'data.data.licenceHolderId');
    const assignedAsruId = get(task, 'assignedTo');

    if (subjectId) {
      task.subject = await cache.query(Profile, subjectId, columns);
    }

    if (licenceHolderId) {
      task.licenceHolder = await cache.query(Profile, licenceHolderId, columns);
    }

    if (assignedAsruId) {
      task.assignedTo = await cache.query(Profile, assignedAsruId, columns);
    }

    return task;
  };
};
