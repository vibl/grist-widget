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

function transpose(data) {
  // Find the maximum length amongst all arrays in the object
  const maxLength = Math.max(...Object.values(data).map((arr) => arr.length));

  // Build the array of transposed objects
  const result = [];
  for (let i = 0; i < maxLength; i++) {
    let obj = {};
    for (const key in data) {
      // Check if there's an element at the current index
      if (data[key][i] !== undefined) {
        obj[key] = data[key][i];
      }
    }
    if (Object.keys(obj).length > 0) {
      result.push(obj);
    }
  }

  return result;
}

function indexBy(indexKey, data) {
  const map = new Map();
  for (const item of data) {
    if (item.hasOwnProperty(indexKey)) {
      map.set(item[indexKey], item);
    }
  }
  return map;
}

function transposeAndIndex(indexKey, data) {
  return indexBy(indexKey, transpose(data));
}

ready(function () {
  grist.ready({
    requiredAccess: "full",
  });
  grist.onNewRecord(setIsNewRecord);
  grist.onRecord(onRecord);
  // console.log("Fetcher: Ready.");
});

async function onRecord(request) {
  console.log('request:', request)
  console.log('isNewRecord:', isNewRecord)
  console.log('currentRecordID:', currentRecordID)

  if (!isNewRecord | !record.sent) return;
  if (request.id === currentRecordID) return;
  currentRecordID = request.id;
  try {
    const { id, queryRef } = request;
    const queries = transposeAndIndex(
      "id",
      await grist.docApi.fetchTable(queryRef.tableId)
    );
    const query = queries.get(queryRef.rowId);
    const endpoints = transposeAndIndex(
      "id",
      await grist.docApi.fetchTable("Endpoint")
    );
    const endpoint = endpoints.get(query.endpoint);
    const { output_table, output_jsonata } = endpoint;
    // const id = requestsTable.create({ fields: {  } });
    const results = await sendRequest(endpoint, query);
    const output = await transformResults(output_jsonata, results);
    const rows = output.map((row) => ({ ...row, request: id }));
    await insertRowsIntoOutputTable(output_table, rows);
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
    const queryParams = await jsonata(paramsJsonata).evaluate(query);
    const params = { ...endpointParams, ...queryParams };
    const queryString = new URLSearchParams(params).toString();
    url = `${endpointUrl}?${queryString}`; // url should end with "/" for this to work!
  }
  try {
    console.log("url:", url);
    const response = await fetch(url, options);
    return response.json();
  } catch (err) {
    handleError(err);
  }
}

async function transformResults(jsonataPattern, results) {
  return jsonata(jsonataPattern).evaluate(results);
}

function removeDuplicates(incoming, existing, includedKeys, excludedKeys = []) {
  return incoming.filter(
    (incomingRow) => !existing.some(
      (existingRow) => {
        const propsToCheck = includedKeys || Object.keys(incomingRow).filter(key => !excludedKeys.includes(key));
        return propsToCheck.every(
          (prop) => excludedKeys.includes(prop) ||incomingRow[prop] === existingRow[prop]
        );
      }
    )
  );
}

async function insertRowsIntoOutputTable(tableId, rows) {
  const retrievedRows = transpose(await grist.docApi.fetchTable(tableId));
  const filteredRows = removeDuplicates(rows, retrievedRows, ["url"]);
  const preparedRows = filteredRows.map((row) => ({ fields: row }));
  const outputTable = grist.getTable(tableId);
  await outputTable.create(preparedRows);
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
