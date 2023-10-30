const columnName = 'row_insert_scheduler_order';
const cronPatternOptionName = "cronPattern"; // "Cron pattern";
const maxRunsOptionName = "maxRuns"; "Max runs";
const intervalMs = 1000;
const defaultCronPattern = "* * * * *";
const defaultMaxRuns = 1e9;
let columnMappings;
let order = 1;

function ready(fn) {
  if (document.readyState !== 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

function getMappings(_, mappings) {
  columnMappings = mappings;
}

async function insertRow(table) {
  if(!columnMappings) {
    console.warn("Waiting for column mappings...");
    return;
  }

  const column = columnMappings?.[columnName] || columnName

  try {
    await table.create({ fields: { [column]: order } });    
    order++;   
  } catch (err) {
    console.error(err);
  }
}

async function main() {
    // Update the widget anytime the document data changes.
    grist.ready({
      columns: [{
        name: columnName, 
        title: columnName, 
        description: "This column will receive incremental integers in order of insertion, starting from 1.",
        type: "Int",
      }],
      requiredAccess: "full",
    });

    grist.onRecord(getMappings);

    let job;
    const table = grist.getTable();

    grist.onOptions(async (options) => {

      if(!options?.[cronPatternOptionName] || !options?.[maxRunsOptionName]) {
        await grist.setOptions({
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
