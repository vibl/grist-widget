let currentRecordID = null;
let table;

ready(function () {
  grist.ready({
    requiredAccess: "full",
    columns: [
      {
        name: "request",
        type: "Text",
        strictType: true,
        title: "Request",
        description: "Request options: url, options, parameters",
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
      ["request", "send", "response"]
    );
    if (!record) {
      throw new Error("Please map all required columns first.");
    }
    if (record.send) {
      console.log("send:", JSON.stringify(record, null, 2));
      await sendRequest(record);
      table.update({ id: record.id, fields: { send: false } });
    }
  } catch (err) {
    handleError(err);
  }
}

async function sendRequest(record) {
  const { request } = record;
  console.log('request:', request)
  const { url, options, parameters } = JSON.parse(request);
  options.method = options?.body && !parameters ? "POST" : "GET";
  const parametersStr = (new URLSearchParams(parameters)).toString();
  const completeURL = url + parametersStr; // url should end with "/" for this to work!
  console.log('completeURL:', completeURL);
  console.log('options:', options);
  try {
    const response = await fetch(completeURL, options);
    const body = await response.text();
    console.log("response body:", body);
    table.update({ id: record.id, fields: { response: body } });
  } catch (err) {
    handleError(err);
  }
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
