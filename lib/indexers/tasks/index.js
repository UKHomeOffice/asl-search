const through = require('through2');
const { get, pick } = require('lodash');
const ElasticsearchWritableStream = require('elasticsearch-writable-stream');
const deleteIndex = require('../utils/delete-index');
const getDecorators = require('./decorators');

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
                },
                name: {
                  tokenizer: 'ngram',
                  filter: ['lowercase', 'asciifolding']
                }
              },
              normalizer: {
                licenceNumber: {
                  type: 'custom',
                  filter: ['lowercase']
                }
              },
              tokenizer: {
                ngram: {
                  type: 'ngram',
                  min_gram: 4,
                  max_gram: 4,
                  token_chars: ['letter', 'whitespace']
                }
              }
            }
          },
          mappings: {
            properties: {
              status: {
                type: 'keyword',
                fields: {
                  value: {
                    type: 'keyword'
                  }
                }
              },
              model: {
                type: 'keyword',
                fields: {
                  value: {
                    type: 'keyword'
                  }
                }
              },
              type: {
                type: 'keyword',
                fields: {
                  value: {
                    type: 'keyword'
                  }
                }
              },
              licenceNumber: {
                type: 'keyword',
                normalizer: 'licenceNumber'
              },
              licenceHolder: {
                type: 'text',
                analyzer: 'name'
              },
              establishment: {
                type: 'text',
                fields: {
                  value: {
                    type: 'keyword'
                  }
                }
              },
              projectTitle: {
                type: 'text',
                fields: {
                  value: {
                    type: 'keyword'
                  }
                }
              }
            }
          }
        }
      });
    });
};

const decorateTask = (task, decorators) => {
  return Object.keys(decorators).reduce((decoratedTask, key) => {
    return decorators[key](decoratedTask);
  }, task);
};

const transformToDoc = task => {
  return {
    index: 'tasks',
    id: task.id,
    type: '_doc',
    body: {
      model: get(task, 'data.model'),
      action: get(task, 'data.action'),
      licenceNumber: get(task, 'data.modelData.licenceNumber'),
      ...pick(task, 'status', 'type', 'establishment', 'licenceHolder')
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
    .then(() => getDecorators(aslSchema))
    .then(decorators => {
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
                const decoratedTask = decorateTask(task, decorators);
                console.log(decoratedTask);
                return callback(null, decoratedTask);
              }))
              .pipe(through.obj((task, enc, callback) => {
                const doc = transformToDoc(task);
                console.log(doc);
                return callback(null, doc);
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
