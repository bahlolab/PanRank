
function loadAndParseCSV(url, callback) {
    fetch(url)
      .then(response => response.arrayBuffer())
      .then(buffer => {
        const firstBytes = new Uint8Array(buffer.slice(0, 2));
        const isGzip = firstBytes[0] === 0x1F && firstBytes[1] === 0x8B;
        let decompressed;
        if (isGzip) {
          decompressed = pako.inflate(buffer, { to: 'string' });
        } else {
          decompressed = new TextDecoder().decode(buffer);
        }
        Papa.parse(decompressed, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: function(results) {
            callback(results.data);
          }
        });
      })
}

// Join two datasets row-wise
function joinDataRowWise(data1, data2) {
    const maxRows = Math.max(data1.length, data2.length);
    const joinedData = [];
    for (let i = 0; i < maxRows; i++) {
        const row1 = data1[i] || {};
        const row2 = data2[i] || {};
        const joinedRow = { ...row1, ...row2 };
        joinedData.push(joinedRow);
    }
    return joinedData;
}

// Create DataTable
function createDataTable(data) {
    if ($.fn.DataTable.isDataTable('#data-table')) {
      let dataTable = $('#data-table').DataTable();
      dataTable.clear();
      dataTable.rows.add(data);
      dataTable.draw();
    } else {
      const columns = Object.keys(data[0] || {}).map(key => ({
          title: key,
          data: key,
          render: renderFun(key)
      }));
      $('#data-table').DataTable({
          data: data,
          columns: columns,
          order: [[4, 'desc']],
          dom: '<"top"lf>rtBip',//'frtBip',
          buttons: [
            { extend: 'csvHtml5',   text: 'Export CSV',   title: getFilename },
            { extend: 'excelHtml5', text: 'Export Excel', title: getFilename}
          ],
          initComplete: function() {
            // Create the custom select dropdown
            var select = $(makeSelect())
              .prependTo($(".dataTables_length"))
              .on('change', function() {
                var url1 = "data/fixed.csv.gz";
                var selectedUrl = $(this).val();
                loadData(url1, selectedUrl);
              });
          }
      });
    }
}

function getFilename() {
  return 'Genes4Epilepsy - ' + $('#file-select option:selected').text();
}

function renderFun(key) {
  if ( key === 'Ensembl' ) {
    return function(data) {
      return `<a href="https://ensembl.org/Homo_sapiens/Gene/Summary?g=${data}" target="_blank">${data}</a>`;
    };
  }
  if ( key === 'Symbol' ) {
    return function(data) {
      return '<div class="dropdown">' +
        `<a class="dropbtn">${data}</a>` +
        '<div class="dropdown-content">' +
        `<a href="https://www.genecards.org/cgi-bin/carddisp.pl?gene=${data}" target="_blank">GeneCards</a><br>` +
        `<a href="https://genome.ucsc.edu/cgi-bin/hgTracks?org=human&db=hg38&position=${data}" target="_blank">UCSC</a><br>` +
        `<a href="https://gtexportal.org/home/gene/${data}" target="_blank">GTEx</a><br>` +
        `<a href="https://gnomad.broadinstitute.org/gene/${data}" target="_blank">gnomAD</a>` +
        '</div></div>';
    };
  }
}
// Load and update data on dropdown change
async function loadData(url1, url2) {
    let data1 = [];
    let data2 = [];
    loadAndParseCSV(url1, function(parsedData1) {
      data1 = parsedData1;
      if (data2.length > 0) {
        const joinedData = joinDataRowWise(parsedData1, data2);
        createDataTable(joinedData);
      }
    });
    loadAndParseCSV(url2, function(parsedData2) {
      data2 = parsedData2;
      if (data1.length > 0) {
          const joinedData = joinDataRowWise(data1, parsedData2);
          createDataTable(joinedData);
      }
    });
}
