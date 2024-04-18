let currentRecordID = null;
let table;

ready(function () {
  grist.ready({
    requiredAccess: "full",
    columns: [
      {
        name: "config",
        type: "Text",
        strictType: true,
        title: "Config",
        description: "Config for request (url, options, parameters) and output (tableId and jsonataPattern)",
      },
      {
        name: "send",
        type: "Bool",
        title: "Send",
        description: "Fetch now",
      },
      {
        name: "response",
        type: "Text",
        strictType: true,
        title: "Response",
        description: "Receives response body",
      },
    ],
  });
  table = grist.getTable();
  grist.onRecord(onRecord);
  console.log("Fetcher: Ready.");
});

async function onRecord(rawRecord, mappedColNamesToRealColNames) {
  try {
    const record = mapGristRecord(
      rawRecord,
      mappedColNamesToRealColNames,
      ["config", "send", "response"]
    );
    if (!record) {
      throw new Error("Please map all required columns first.");
    }
    if (record.send) {
      const { id, config } = record;
      const { request, output: { tableId, jsonataPattern } } = JSON.parse(config);
      const results = await sendRequest(request);
      const output = await transformResults(results, jsonataPattern);
      const outputStr = JSON.stringify(output, null, 2);
      await table.update({ id, fields: { output: outputStr } });
      await insertRowsIntoOutputTable(tableId, output);
      await table.update({ id, fields: { send: false } });
    }
  } catch (err) {
    handleError(err);
  }
}

async function sendRequest(request) {
  const { url, options, parameters } = request;
  options.method = options?.body && !parameters ? "POST" : "GET";
  const parametersStr = (new URLSearchParams(parameters)).toString();
  const completeURL = `${url}?${parametersStr}`; // url should end with "/" for this to work!
  try {
    const response = await fetch(completeURL, options);
    return response.json();
  } catch (err) {
    handleError(err);
  }
}

async function transformResults(results, jsonataPattern) {
  return jsonata(jsonataPattern).evaluate(results);
}

async function insertRowsIntoOutputTable(tableId, output) {
  console.log('output:', output)
  const outputTable = grist.getTable(tableId);
  await outputTable.create(output.map(row => ({ fields: row })));
}

function mapGristRecord(record, colMap, requiredTruthyCols) {
  //const mappedRecord = grist.mapColumnNames(record);
  // Unfortunately, Grist's mapColumnNames function doesn't handle optional column mappings
  // properly, so we need to map stuff ourselves.
  const mappedRecord = { id: record.id };
  if (colMap) {
    for (const [mappedColName, realColName] of Object.entries(colMap)) {
      if (realColName in record) {
        mappedRecord[mappedColName] = record[realColName];
      }
    }
  }
  return mappedRecord;
}

function handleError(err) {
  console.error("Fetcher error:", err);
}

function ready(fn) {
  if (document.readyState !== "loading") {
    fn();
  } else {
    document.addEventListener("DOMContentLoaded", fn);
  }
}
