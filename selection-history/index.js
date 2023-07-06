const column = 'SelectionHistory';
let table;

function ready(fn) {
  if (document.readyState !== 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

function onRecord(row, mappings) {
  console.log('onRecord', row, mappings);
  try {
    // If there is no mapping, test the original record.
    row = grist.mapColumnNames(row) || row;
    if (!row.hasOwnProperty(column)) {
      throw new Error(`Need a visible column named "${column}". You can map a custom column in the Creator Panel.`);
    }
    table.update({
      id: row.id, 
      fields: { [column]: new Date() },
  })
   
  } catch (err) {
    handleError(err);
  }
}

ready(function() {
  // Update the widget anytime the document data changes.
  grist.ready({columns: [{name: column, title: "Action"}]});
  grist.onRecord(onRecord);
  table = grist.getTable();
});
