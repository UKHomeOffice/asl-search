const { get, pick } = require('lodash');

module.exports = async aslSchema => {
  const { schema: innerSchema } = await aslSchema;
  const { Establishment } = innerSchema;

  // preload all establishments into memory so that we don't have to query the db for every task
  return Establishment.queryWithDeleted().select('id', 'name')
    .then(establishments => {
      return task => {
        const establishmentId = get(task, 'data.establishmentId');

        if (establishmentId) {
          task.establishment = pick(establishments.find(e => e.id === establishmentId), 'id', 'name');
        }

        return task;
      };
    });
};
