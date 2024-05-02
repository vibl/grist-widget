let isNewRecord = false;
let currentQueryID = null;

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
  // console.log("Fetcher: Ready.");
});

async function onRecord(query) {
  if (!query.send) return;
  console.log('query:', query)

/*   if (query.id === currentQueryID) return;
  currentQueryID = query.id; */
  try {
    const { id, endpointRef } = query;
    console.log('endpointRef:', endpointRef)
    const queriesTable = grist.getTable();
    await queriesTable.update({ id, fields: { send: false } });
    const endpoints = transposeAndIndex(
      "id",
      await grist.docApi.fetchTable(endpointRef.tableId)
    );
    const endpoint = endpoints.get(endpointRef.rowId);
    const { output_table, output_jsonata } = endpoint;
    const results = await sendRequest(endpoint, query);
    console.log('results:', results)
    const requestsTable = grist.getTable("Requests");
    const { id: requestId } = await requestsTable.create({ fields: { queryRef: id } });
    const output = await transformResults(output_jsonata, results);
    const rows = output.map((row) => ({ ...row, requests: [ "L", 1, requestId ] }));
    await upsertRowsIntoOutputTable(output_table, rows, requestId);
    await requestsTable.update({ id: requestId, fields: { success: true } });
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

function classifyPresence(incomingList, existingList, includedKeys, excludedKeys = []) {
  const results = {
    absent: [],
    present: [],
    similar: []
  };
  const filteredKeys = includedKeys.filter(key => !excludedKeys.includes(key));

  for( const incomingItem of incomingList) {
    const existingMatch = existingList.find(existingItem =>
      filteredKeys.every(key => incomingItem[key] === existingItem[key])
    );
    if (existingMatch) {
      results.similar.push(existingMatch);
      results.present.push(incomingItem);
    } else {
      results.absent.push(incomingItem);
    }
  }

  return results;
}

async function upsertRowsIntoOutputTable(tableId, rows, requestId) {
  console.log('requestId:', requestId)
  const retrievedRows = transpose(await grist.docApi.fetchTable(tableId));
  console.log('retrievedRows:', retrievedRows)
  const { absent, present, similar } = classifyPresence(rows, retrievedRows, ["url"]);
  const changedRows = present.map((row, index) => ({ 
    ...row,
    requests: [ ...row.requests, requestId ] 
  }));

  const outputTable = grist.getTable(tableId);

  function tableOperation(operation, rows) {
    function prepareRow(row, index) {
      const preparedRow = { fields: { 
        ...row,
        requests: [ ...row.requests, requestId ],
      } };
      if(operation === 'update') {
        preparedRow.id = similar[index].id;
      }
      return preparedRow;

    }
    return outputTable[operation](rows.map(prepareRow));
  }

  await tableOperation("update", changedRows);
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
