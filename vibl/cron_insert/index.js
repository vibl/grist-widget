const columnName = 'cron_insert_order';
const cronPatternOptionName = "Cron pattern";
const maxRunsOptionName = "Max runs"
const intervalMs = 1000;
const defaultCronPattern = "* * * * *";
const defaultMaxRuns = 1e9;
let order = 1;

function ready(fn) {
  if (document.readyState !== 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

function insertRow(table) {
  try {
    const originalColumnName = mappings?.[column] || column;
    table.create({ fields: { [originalColumnName]: order } });    
    order++;   
  } catch (err) {
    handleError(err);
  }
}

async function main() {
    // Update the widget anytime the document data changes.
    grist.ready({columns: [{name: column, title: column, type: "Integer"}]});
    let job;
    
    const table = grist.getTable();

    grist.onOptions((options) => {
      let { [cronPatternOptionName]: cronPattern, [maxRunsOptionName]: maxRuns } = options;
    
      if(!cronPattern) {
        cronPattern = defaultCronPattern;
        grist.setOption(cronPatternOptionName, cronPattern);
      }
  
      if(!maxRuns) {
        maxRuns = defaultMaxRuns;
        grist.setOption(maxRunsOptionName, maxRuns);
      }

      if(job?.isRunning()) {
        job.stop();
      }

      job = Cron(cronPattern, { maxRuns }, () => insertRow(table) );
    });
}

ready(main);
