let isNewRecord = true; // TODO: change to false

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function setIsNewRecord() {
  isNewRecord = true;
  sleep(1000);
  isNewRecord = false;
}

ready(function () {
  grist.ready({
    requiredAccess: "full",
  });
  // grist.onNewRecord(setIsNewRecord);
  grist.onRecord(onRecord);
  // console.log("Fetcher: Ready.");
});

async function onRecord(record) {
  if (!isNewRecord) return;
  console.log('record:', record);
  try {
    const {
      id,
      query_endpoint_output_table,
      query_endpoint_output_jsonata
    } = record;
    requestsTable = grist.getTable();
    const endpoints = await grist.docApi.fetchTable("Endpoint");
    console.log('endpoints:', endpoints);
    const queries = await grist.docApi.fetchTable("Queries");
    console.log('queries:', queries);
    const requests = await grist.docApi.fetchTable("Requests");
    console.log('requests:', requests);
    const selectedTable = await grist.fetchSelectedTable();
    console.log('selectedTable:', selectedTable)

    // const id = requestsTable.create({ fields: {  } });
    const results = await sendRequest(record);
    const output = await transformResults(query_endpoint_output_jsonata, results);
    await insertRowsIntoOutputTable(query_endpoint_output_table, output);
    requestsTable.update({ id, fields: { success: true } });
  } catch (err) {
    handleError(err);
  }
}

async function sendRequest(record) {
  const {
    query_endpoint_body_jsonata,
    query_endpoint_body,
    query_endpoint_url,
  } = record;
  let url = query_endpoint_url;
  const options = {};
  if (query_endpoint_body) {
    options.method = "POST";
    const endpoint_body = JSON.parse(query_endpoint_body);
    const query_body = await jsonata(query_endpoint_body_jsonata).evaluate(record);
    options.body = { ...endpoint_body, ...query_body };
  } else {
    options.method = "GET";
    const endpoint_parameters = JSON.parse(query_endpoint_params);
    const query_parameters = await jsonata(query_endpoint_params_jsonata).evaluate(record);
    const parameters = { ...endpoint_parameters, ...query_parameters };
    const parametersStr = new URLSearchParams(parameters).toString();
    url = `${query_endpoint_url}?${parametersStr}`; // url should end with "/" for this to work!
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
