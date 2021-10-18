const Knex = require('knex');
const { knexSnakeCaseMappers } = require('objection');
const config = require('../../config');

module.exports = Knex({
  client: 'postgres',
  connection: config.workflowdb,
  ...knexSnakeCaseMappers()
});
