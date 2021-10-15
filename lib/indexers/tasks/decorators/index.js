const openClosed = require('./open-closed');
const taskType = require('./task-type');
const establishment = require('./establishment');
const profiles = require('./profiles');

module.exports = aslSchema => {
  return Promise.resolve()
    .then(() => establishment(aslSchema))
    .then(establishmentDecorator => {
      return {
        openClosed,
        taskType,
        establishment: establishmentDecorator,
        profiles: profiles(aslSchema)
      };
    });
};
