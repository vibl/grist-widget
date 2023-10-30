const columnName = 'row_insert_scheduler_order';
const cronPatternOptionName = "cronPattern"; // "Cron pattern";
const maxRunsOptionName = "maxRuns"; "Max runs";
const intervalMs = 1000;
const defaultCronPattern = "* * * * *";
const defaultMaxRuns = 100_000;
const cronPatternEl = document.getElementById('cronPattern');
const maxRunsEl = document.getElementById('maxRuns');
let table;
let isPaused = true;
let columnMappings;
let order = 1;
let job;

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

function startPause() {
  isPaused = !isPaused;
  if(isPaused) {
    if(job) {
      job.schedule();
    } else {
      job.resume();
    }

  } else {
    job.pause();
  }
}

async function saveOptionsAndRestart() {
  const cronPattern = cronPatternEl.value;
  const maxRuns = Number(maxRunsEl.value);
  await grist.setOptions({ cronPattern, maxRuns });
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
    table = grist.getTable();

    grist.onOptions(async (options) => {

      if(!options?.cronPattern || !options?.maxRuns) {
        await grist.setOptions({
          cronPattern: defaultCronPattern,
          maxRuns: defaultMaxRuns,
        });
        
        return;
      }

      cronPatternEl.value = cronPattern;
      maxRunsEl.value = maxRuns;
      console.log("Widget row-insert-scheduler options: ", options);

      if(job?.isRunning()) {
        job.stop();
      }

      job = Cron(cronPattern, { maxRuns, paused: true }, () => insertRow(table));
    });
}

ready(main);
