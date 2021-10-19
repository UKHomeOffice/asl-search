const closed = ['resolved', 'rejected', 'discarded-by-asru', 'discarded-by-applicant', 'withdrawn-by-applicant'];

module.exports = task => (
  {
    ...task,
    open: !closed.includes(task.status)
  }
);
