let currentRecordID = null;
let table;
const REQUIRED_COLUMNS = ["request", "doFetch", "response"];

ready(function () {
  // Set up a global error handler.
  window.addEventListener("error", function (err) {
    handleError(err);
  });
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
        name: "doFetch",
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

async function onRecord(record, mappedColNamesToRealColNames) {
  try {
    const mappedRecord = mapGristRecord(
      record,
      mappedColNamesToRealColNames,
      REQUIRED_COLUMNS
    );
    if (!mappedRecord) {
      throw new Error("Please map all required columns first.");
    }
    console.log("mappedRecord:", JSON.stringify(mappedRecord, null, 2));
    if (mappedRecord.doFetch) {
      console.log("doFetch is true");
      table.update({ id: record.id, fields: { doFetch: false } });
    }
  } catch (err) {
    handleError(err);
  }
}

async function sendRequest(mappedRecord) {
  const { request } = mappedRecord;
  const { url, options, body, parameters } = request;
  options.method = options.body && !parameters ? "POST" : "GET";
  try {
    const response = await fetch(url, options);
    const body = await response.text();
    console.log("response body:", body);
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
  if (!setStatus(err)) {
    console.error("autoaction: FATAL: ", err);
    document.body.innerHTML = String(err);
    return;
  }
  console.error("autoaction: ", err);
}

function ready(fn) {
  if (document.readyState !== "loading") {
    fn();
  } else {
    document.addEventListener("DOMContentLoaded", fn);
  }
}
