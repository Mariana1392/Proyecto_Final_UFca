export default {
  default: {
    paths: ['features/**/*.feature'],
    import: ['features/support/**/*.js', 'features/step_definitions/**/*.js'],
    format: ['summary', 'progress-bar'],
    publishQuiet: true
  }
};
