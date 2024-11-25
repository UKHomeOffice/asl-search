const aslSchema = require('./asl-schema');
const config = require('../../config');

module.exports = () => ({
  init: async () => {
    let schema = null;
    try {
      schema = await aslSchema(config.asldb);
      return {schema};

    } catch (err) {
      if (schema) {
        schema.destroy(); // Ensure schema is destroyed on error
      }
      throw err;
    }
  }
});
