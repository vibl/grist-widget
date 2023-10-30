const columnName = 'row_insert_scheduler_order';
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
    const originalColumnName = Grist.mapColumnNamesBack(columnName);
    table.create({ fields: { [originalColumnName]: order } });    
    order++;   
  } catch (err) {
    handleError(err);
  }
}

async function main() {
    // Update the widget anytime the document data changes.
    grist.ready({columns: [{name: columnName, title: columnName, type: "Integer"}]});
    let job;
    
    const table = grist.getTable();

    grist.onOptions(async (options) => {

      if(!options?.[cronPatternOptionName] || !options?.[maxRunsOptionName]) {
        await grist.setOption({
          [cronPatternOptionName]: defaultCronPattern,
          [maxRunsOptionName]: defaultMaxRuns,
        });
        
        return;
      }
      console.log("options: ", options);
      const { [cronPatternOptionName]: cronPattern, [maxRunsOptionName]: maxRuns } = options;

      if(job?.isRunning()) {
        job.stop();
      }

      job = Cron(cronPattern, { maxRuns }, () => insertRow(table) );
    });
}

ready(main);
