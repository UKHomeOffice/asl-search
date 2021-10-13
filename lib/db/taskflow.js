const Taskflow = require('@ukhomeoffice/taskflow/lib/db');
const config = require('../../config');

module.exports = Taskflow.connect(config.workflowdb);
