const taskType = require('./task-type');
const establishment = require('./establishment');
const profiles = require('./profiles');

module.exports = aslSchema => {
  return Promise.resolve()
    .then(() => establishment(aslSchema))
    .then(establishmentDecorator => {
      return {
        taskType,
        establishment: establishmentDecorator,
        // profiles: profiles(aslSchema)
      };
    });
};
