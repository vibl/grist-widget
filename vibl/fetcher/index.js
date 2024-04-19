let isNewRecord = false;
let currentRecordID = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function setIsNewRecord() {
  isNewRecord = true;
  await sleep(1000);
  isNewRecord = false;
}

function transposeAndIndex(indexKey, data) {
  const keys = Object.keys(data);
  const result = new Map();

  // Assuming all arrays are of the same length
  const length = data[keys[0]].length;

  for (let i = 0; i < length; i++) {
    let obj = {};
    keys.forEach((key) => {
      obj[key] = data[key][i];
    });
    indexValue = obj[indexKey];
    result.set(indexValue, obj);
  }
  return result;
}

/* async function fetchRows(tableId) {
  const table = grist.getTable(tableId);
  const rows = await table.fetch();
  return rows;
}
 */
ready(function () {
  grist.ready({
    requiredAccess: "full",
  });
  grist.onNewRecord(setIsNewRecord);
  grist.onRecord(onRecord);
  // console.log("Fetcher: Ready.");
});

async function onRecord(request) {
  if (!isNewRecord) return;
  if (request.id === currentRecordID) return;
  currentRecordID = request.id;
  try {
    const { id, queryRef } = request;
    const queries = transposeAndIndex("id",await grist.docApi.fetchTable(queryRef.tableId));
    const query = queries.get(queryRef.rowId);
    const endpoints = transposeAndIndex("id", await grist.docApi.fetchTable("Endpoint"));
    const endpoint = endpoints.get(query.endpoint);
    const { output_table, output_jsonata } = endpoint;
    // const id = requestsTable.create({ fields: {  } });
    const results = await sendRequest(endpoint, query);
    const output = await transformResults(output_jsonata, results);
    await insertRowsIntoOutputTable(output_table, output);
    requestsTable = grist.getTable();
    requestsTable.update({ id, fields: { success: true } });
  } catch (err) {
    handleError(err);
  }
}

async function sendRequest(endpoint, query) {
  const {
    body: endpointBodyStr,
    body_jsonata: bodyJsonata,
    url: endpointUrl,
    params: endpointParamsStr,
    params_jsonata: paramsJsonata,
  } = endpoint;
  let url;
  const options = {};
  if (endpointBodyStr) {
    options.method = "POST";
    const endpointBody = JSON.parse(endpointBodyStr);
    const queryBody = await jsonata(bodyJsonata).evaluate(query);
    options.body = { ...endpointBody, ...queryBody };
    url = endpointUrl;
  } else {
    options.method = "GET";
    const endpointParams = JSON.parse(endpointParamsStr);
    console.log('paramsJsonata:', paramsJsonata)
    console.log('query:', query)
    const queryParams = await jsonata(paramsJsonata).evaluate(query);
    console.log('queryParams:', queryParams)
    const params = { ...endpointParams, ...queryParams };
    console.log('params:', params)
    const queryString = new URLSearchParams(params).toString();
    console.log('queryString:', queryString)
    url = `${endpointUrl}?${queryString}`; // url should end with "/" for this to work!
  }
  try {
    const response = await fetch(url, options);
    return response.json();
  } catch (err) {
    handleError(err);
  }
}

async function transformResults(jsonataPattern, results) {
  return jsonata(jsonataPattern).evaluate(results);
}

async function insertRowsIntoOutputTable(tableId, output) {
  const outputTable = grist.getTable(tableId);
  const rows = output.map((row) => ({ fields: row }));
  await outputTable.create(rows);
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
