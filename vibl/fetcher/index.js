let isNewRecord = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function setIsNewRecord() {
  isNewRecord = true;
  sleep(1000);
  isNewRecord = false;
}

function transposeAndIndex(data, indexKey) {
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
  try {
    const { id, query_id } = request;
    const queries = transposeAndIndex(await grist.docApi.fetchTable("Queries"));
    const query = queries.get(query_id);
    const endpoints = transposeAndIndex(await grist.docApi.fetchTable("Endpoint"));
    const endpoint = endpoints.get(query.endpoint);
    const { output_table, output_jsonata } = endpoint;
    // const id = requestsTable.create({ fields: {  } });
    const results = await sendRequest(endpoint, request);
    const output = await transformResults(output_jsonata, results);
    await insertRowsIntoOutputTable(output_table, output);
    requestsTable = grist.getTable();
    requestsTable.update({ id, fields: { success: true } });
  } catch (err) {
    handleError(err);
  }
}

async function sendRequest(endpoint, request) {
  const {
    body: endpointBodyStr,
    body_jsonata: bodyJsonata,
    url: endpointUrl,
    params: endpointParamsStr,
    params_jsonata: paramsJsonata,
  } = endpoint;
  let url = endpointUrl;
  const options = {};
  if (body) {
    options.method = "POST";
    const endpointBody = JSON.parse(endpointBodyStr);
    const queryBody = await jsonata(bodyJsonata).evaluate(request);
    options.body = { ...endpointBody, ...queryBody };
  } else {
    options.method = "GET";
    const endpointParams = JSON.parse(endpointParamsStr);
    const queryParams = await jsonata(paramsJsonata).evaluate(request);
    const params = { ...endpointParams, ...queryParams };
    const queryString = new URLSearchParams(params).toString();
    url = `${query_endpoint_url}?${queryString}`; // url should end with "/" for this to work!
  }
  try {
    const response = await fetch(url, options);
    return response.json();
  } catch (err) {
    handleError(err);
  }
}

async function transformResults(jsonata, results) {
  return jsonata(jsonata).evaluate(results);
}

async function insertRowsIntoOutputTable(tableId, output) {
  const outputTable = grist.getTable(tableId);
  await outputTable.upsert(output.map((row) => ({ fields: row })));
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
