const column = 'SelectionHistory';
const msWindow = 2000;
let table;

function ready(fn) {
  if (document.readyState !== 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

function onRecord(row, mappings) {
  try {
    // If there is no mapping, test the original record.
    row = grist.mapColumnNames(row) || row;
    if (!row.hasOwnProperty(column)) {
      throw new Error(`Need a visible column named "${column}". You can map a custom column in the Creator Panel.`);
    }
    const now = new Date();
    if (row[column] && now - row[column] < msWindow) {
      // Don't update if the value is already near the current time.
      return;
    }
    table.update({
      id: row.id, 
      fields: { [column]: now },
  })
   
  } catch (err) {
    handleError(err);
  }
}

ready(function() {
  // Update the widget anytime the document data changes.
  grist.ready({columns: [{name: column, title: "Selection History", type: "DateTime"}]});
  grist.onRecord(onRecord);
  table = grist.getTable();
});
