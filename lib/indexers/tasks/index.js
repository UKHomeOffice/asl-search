const { Transform } = require('stream');
const winston = require('winston');
const { get, pick } = require('lodash');
const ElasticsearchWritableStream = require('elasticsearch-writable-stream');
const deleteIndex = require('../utils/delete-index');
const getDecorators = require('./decorators');

const columnsToIndex = [
  'id',
  'open',
  'status',
  'type',
  'establishment',
  'subject',
  'licenceHolder',
  'asruUser',
  'createdAt',
  'updatedAt',
  'assignedTo'
];

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
              open: {
                type: 'boolean'
              },
              status: {
                type: 'keyword',
                fields: {
                  value: {
                    type: 'keyword'
                  }
                }
              },
              createdAt: {
                type: 'date',
                fields: {
                  value: {
                    type: 'date'
                  }
                }
              },
              updatedAt: {
                type: 'date',
                fields: {
                  value: {
                    type: 'date'
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
                properties: {
                  lastName: {
                    type: 'text',
                    fields: {
                      value: {
                        type: 'keyword'
                      }
                    }
                  },
                  firstName: {
                    type: 'text',
                    fields: {
                      value: {
                        type: 'keyword'
                      }
                    }
                  }
                }
              },
              subject: {
                properties: {
                  lastName: {
                    type: 'text',
                    fields: {
                      value: {
                        type: 'keyword'
                      }
                    }
                  },
                  firstName: {
                    type: 'text',
                    fields: {
                      value: {
                        type: 'keyword'
                      }
                    }
                  }
                }
              },
              assignedTo: {
                properties: {
                  lastName: {
                    type: 'text',
                    fields: {
                      value: {
                        type: 'keyword'
                      }
                    }
                  },
                  firstName: {
                    type: 'text',
                    fields: {
                      value: {
                        type: 'keyword'
                      }
                    }
                  }
                }
              },
              establishment: {
                properties: {
                  name: {
                    type: 'text',
                    fields: {
                      value: {
                        type: 'keyword'
                      }
                    }
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

const taskDecorator = decorators => {
  return new Transform({
    objectMode: true,
    transform: async (task, enc, done) => {
      const decoratedTask = await Object.keys(decorators).reduce(async (decoratedTask, key) => {
        return decorators[key](await decoratedTask);
      }, Promise.resolve(task));
      done(null, decoratedTask);
    }
  });
};

const documentTransform = new Transform({
  objectMode: true,
  transform: (task, enc, done) => {
    const document = {
      index: 'tasks',
      id: task.id,
      type: '_doc',
      body: {
        model: get(task, 'data.model') || '',
        modelStatus: get(task, 'data.modelData.status') || '',
        action: get(task, 'data.action') || '',
        licenceNumber: get(task, 'data.modelData.licenceNumber') || '',
        ...pick(task, columnsToIndex)
      }
    };

    if (document.body.model === 'project') {
      document.body.projectTitle = get(task, 'data.modelData.title') || '';
    }

    done(null, document);
  }
});

module.exports = async ({ aslSchema, taskflowDb, esClient, options = {} }) => {
  if (options.reset && options.id) {
    throw new Error('Do not define an id when resetting indexes');
  }

  const logger = winston.createLogger({ level: 'debug', transports: [ new winston.transports.Console() ] });
  const bulkIndexStream = new ElasticsearchWritableStream(esClient, { highWaterMark: 256, flushTimeout: 500, logger });

  let taskCount = 0;

  const counter = new Transform({
    objectMode: true,
    transform: (data, enc, done) => {
      taskCount++;
      done(null, data);
    }
  });

  if (options.reset) {
    await reset(esClient);
  }

  const decorators = await getDecorators(aslSchema);

  await new Promise((resolve, reject) => {
    const query = taskflowDb.select('*')
      .from('cases')
      .whereNot('status', 'autoresolved')
      .where(builder => {
        if (options.id) {
          builder.where({ id: options.id });
        }
      });

    return query.stream(readStream => {
      readStream
        .pipe(counter)
        .pipe(taskDecorator(decorators))
        .pipe(documentTransform)
        .pipe(bulkIndexStream)
        .on('finish', resolve)
        .on('error', reject);
    });
  });

  console.log(`\nindexed ${taskCount} tasks`);
  await esClient.indices.refresh({ index: 'tasks' });
};
