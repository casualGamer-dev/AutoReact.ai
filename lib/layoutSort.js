// Ported from FUNCTIONS/functions/index.js (sortFunction/sortXaxis + row-building loop, lines 60-129).
// Kept behavior-identical so on-device detections group into rows/cols the same way the old
// cloud function did; only var->let/no-implicit-globals cleanup, no logic changes.

function sortByY(a, b) {
  if (a.y0 === b.y0) return 0;
  return a.y0 < b.y0 ? -1 : 1;
}

function sortByX(a, b) {
  if (a.x0 === b.x0) return 0;
  return a.x0 < b.x0 ? -1 : 1;
}

function groupIntoRows(sortedPredictions) {
  let yCounter = 0;
  let counterRows = 0;
  const row = [];

  for (let i = 0; i < sortedPredictions.length; i++) {
    row[counterRows] = row[counterRows] || [];
    if (sortedPredictions[i].y0 > yCounter) {
      counterRows++;
      row[counterRows] = row[counterRows] || [];
      yCounter = sortedPredictions[i].y0 + sortedPredictions[i].height;
      if (sortedPredictions[i].y0 < yCounter) {
        row[counterRows - 1].push(sortedPredictions[i]);
      }
    } else if (sortedPredictions[i].y0 < yCounter) {
      row[counterRows - 1].push(sortedPredictions[i]);
    }
  }
  // the loop above preallocates row[counterRows] ahead of the next possible
  // row, leaving a trailing empty array on the last iteration - drop it.
  return row.filter((r) => r.length > 0);
}

function orderRowsByX(rows) {
  const rowOrder = [];
  for (let i = 0; i < rows.length; i++) {
    rowOrder[i] = [];
    let xCounter = 0;
    for (let j = 0; j < rows[i].length; j++) {
      if (rows[i].length === 1) {
        rowOrder[i].push(rows[i][j]);
      } else if (rows[i].length > 1) {
        if (rows[i][j].x0 > xCounter) {
          xCounter = rows[i][j].x0;
          rowOrder[i].push(rows[i][j]);
        } else {
          rowOrder[i].unshift(rows[i][j]);
        }
        rowOrder[i] = rowOrder[i].sort(sortByX);
      }
    }
  }
  return rowOrder;
}

// predictions: {object, x0, y0, x1, y1, width, height, accuracy}[] -> element[][] sorted top-to-bottom, left-to-right
function sortIntoRows(predictions) {
  const sorted = [...predictions].sort(sortByY);
  return orderRowsByX(groupIntoRows(sorted));
}

module.exports = { sortIntoRows, sortByY, sortByX };
