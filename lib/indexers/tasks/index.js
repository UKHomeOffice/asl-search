const through = require('through2');
const { pick } = require('lodash');
const ElasticsearchWritableStream = require('elasticsearch-writable-stream');
const deleteIndex = require('../utils/delete-index');

const reset = esClient => {
  console.log(`Rebuilding index tasks`);
  return Promise.resolve()
    .then(() => deleteIndex(esClient, 'tasks'))
    .then(() => {
      return esClient.indices.create({
        index: 'tasks',
        body: {
          settings: {
            analysis: {
              analyzer: {
                default: {
                  tokenizer: 'whitespace',
                  filter: ['lowercase', 'stop']
                }
              },
              normalizer: {
                licenceNumber: {
                  type: 'custom',
                  filter: ['lowercase']
                }
              }
            }
          },
          mappings: {
            properties: {

            }
          }
        }
      });
    });
};

const decorateTask = (aslSchema, task) => {
  return task;
};

const transformToIndex = task => {
  return {
    index: 'tasks',
    id: task.id,
    type: '_doc',
    body: {
      status: task.status,
      model: pick(task, 'data.model'),
      action: pick(task, 'data.action')
    }
  };
};

module.exports = ({ aslSchema, taskflowDb, esClient, options = {} }) => {
  if (options.reset && options.id) {
    throw new Error('Do not define an id when resetting indexes');
  }

  const bulkIndexStream = new ElasticsearchWritableStream(esClient, { highWaterMark: 256, flushTimeout: 500 });

  let taskCount = 0;

  return Promise.resolve()
    .then(() => {
      if (options.reset) {
        return reset(esClient);
      }
    })
    .then(() => {
      return new Promise((resolve, reject) => {
        const query = taskflowDb.select('*')
          .from('cases')
          .whereNot('status', 'autoresolved')
          .where(builder => {
            if (options.id) {
              builder.where({ id: options.id });
            }
          });

        return query
          .stream(readStream => {
            readStream
              .pipe(through.obj((task, enc, callback) => {
                taskCount++;
                process.stdout.write('.');
                return callback(null, decorateTask(aslSchema, task));
              }))
              .pipe(through.obj((task, enc, callback) => {
                return callback(null, transformToIndex(task));
              }))
              .pipe(bulkIndexStream)
              .on('error', err => {
                throw new Error(err);
              });
          })
          .then(() => {
            console.log(`\nindexed ${taskCount} tasks`);
            resolve();
          })
          .catch(err => reject(err));
      });
    })
    .then(() => esClient.indices.refresh({ index: 'tasks' }))
    .catch(err => console.log(err));
};
