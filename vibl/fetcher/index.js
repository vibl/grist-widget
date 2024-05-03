let isNewRecord = false;
let currentRequestID = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  grist.onRecord(onRecord);
  console.log("Fetcher: Ready.");
});

async function onRecord(request) {
  console.log('request:', request)
  if (!request.sent || request.sent_at || !request.query) return; // Not requested or already sent.
  console.log('request:', request);
  console.log('currentRequestID:', currentRequestID);
  if (request.id === currentRequestID) return;
  currentRequestID = request.id;
  try {
    const { id, endpointRef } = request;
    const queriesTable = grist.getTable();
    await queriesTable.update({ id, fields: { send: false } });
    const endpoint = await getEndpoint(endpointRef);
    console.log('endpoint:', endpoint);
    const { output_table, output_jsonata } = endpoint;
    const results = await sendRequest(endpoint, request);
    console.log('request results:', results);
    const rows = await transformResults(output_jsonata, results);
    await upsertRowsIntoOutputTable(output_table, rows, id);
    await requestsTable.update({ id: requestId, fields: { sent_at: new Date() } });
  } catch (err) {
    handleError(err);
  }
}

async function getEndpoint(endpointRef) {
  const endpointTableRows = await grist.docApi.fetchTable(endpointRef.tableId);
  const endpoints = transposeAndIndex("id", endpointTableRows);
  return endpoints.get(endpointRef.rowIds[0]);
}

async function sendRequest(endpoint, request) {
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
    const requestBody = await jsonata(bodyJsonata).evaluate(request);
    options.body = { ...endpointBody, ...requestBody };
    console.log('options.body:', options.body)
    url = endpointUrl;
  } else {
    options.method = "GET";
    const endpointParams = JSON.parse(endpointParamsStr);
    const requestParams = await jsonata(paramsJsonata).evaluate(request);
    const params = { ...endpointParams, ...requestParams };
    const paramsString = new URLSearchParams(params).toString();
    url = `${endpointUrl}?${paramsString}`; // url should end with "/" for this to work!
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

function classifyPresence(incomingList, existingList, includedKeys, excludedKeys = []) {
  const results = {
    absent: [],
    duplicate: [],
    original: []
  };
  const filteredKeys = includedKeys.filter(key => !excludedKeys.includes(key));

  for( const incomingItem of incomingList) {
    const existingMatch = existingList.find(existingItem =>
      filteredKeys.every(key => incomingItem[key] === existingItem[key])
    );
    if (existingMatch) {
      results.original.push(existingMatch);
      results.duplicate.push(incomingItem);
    } else {
      results.absent.push(incomingItem);
    }
  }

  return results;
}

async function upsertRowsIntoOutputTable(tableId, rows, requestId) {
  const retrievedRows = transpose(await grist.docApi.fetchTable(tableId));
  const { absent, duplicate, original } = classifyPresence(rows, retrievedRows, ["url"]);
  const outputTable = grist.getTable(tableId);

  function tableOperation(operation, rows) {
    const prepareRow = (row, i) => operation === 'create'
      ? {
          fields: {
            ...row,
            requests: [ "L", requestId]
          }
        }
      : {
          id: original[i].id,
          fields: {
            ...row,
            requests: [...original[i].requests, requestId]
          }
        };
    
    return outputTable[operation](rows.map(prepareRow));
  }

  await tableOperation("update", duplicate);
  await tableOperation("create", absent);
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
