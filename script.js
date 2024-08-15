
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
      const columns = Object.keys(data[0] || {})
          .filter(key => key !== 'OMIM')
          .map(key => ({
              title: key,
              data: key,
              render: renderFun(key)
          }));
      $('#data-table').DataTable({
          data: data,
          columns: columns,
          order: [[5, 'desc']],
          dom: '<"top"lf>rtBip',//'frtBip',
          buttons: [
            { extend: 'csvHtml5',   text: 'Export CSV',   title: getFilename, exportOptions: {orthogonal: 'export'}},
            { extend: 'excelHtml5', text: 'Export Excel', title: getFilename, exportOptions: {orthogonal: 'export'}}
          ],
          drawCallback: function() {
            var summaries = document.querySelectorAll('[id^="gene-dropdown"]');
            summaries.forEach(element => {
                // Extract gene ID from the element's ID
                const geneId = element.id.replace('gene-dropdown-', '');
                element.addEventListener('mouseover', function() {
                  fetchGeneSummary(geneId);
                });
            });
          },
          initComplete: function() {
            var table = this.api();
            
            var subset = $(
                '<label for="subset">Subset:</label>' +
                '<select id="subset" class="custom-select">' +
                '<option value="-">Novel Only</option>' +
                '<option value="">All Genes</option>' +
                '</select>')
                .prependTo($(".dataTables_length"))
                .on('change', function() {
                    var filter = $(this).val();
                    table.column(3)
                         .search(filter)
                         .draw();
                });
            subset.trigger('change');
        
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
  if ( key === 'NCBI Gene' ) {
    return function(data) {
      return  `<a href="https://www.ncbi.nlm.nih.gov/gene/${data}" target="_blank">${data}</a>`;
    };
  }
  if ( key === 'Symbol' ) {
    return function(data, type, row) {
      if (type === 'display') {
        return '<div class="dropdown">' +
          `<a class="dropbtn" id="gene-dropdown-${row["NCBI Gene"]}">${data}</a>` +
          '<div class="dropdown-content">' +
          `<a href="https://panelapp.agha.umccr.org/panels/entities/${data}" target="_blank" class="button">PanelApp</a>` +
          (row["OMIM"] ? `<a href="https://www.omim.org/entry/${row["OMIM"]}" target="_blank" class="button">OMIM</a>` : '') +
          `<a href="https://gtexportal.org/home/gene/${row["Ensembl"]}" target="_blank" class="button">GTEx</a>` +
          `<a href="https://gnomad.broadinstitute.org/gene/${row["Ensembl"]}" target="_blank" class="button">gnomAD</a>` +
          `<a href="https://genome.ucsc.edu/cgi-bin/hgTracks?org=human&db=hg38&position=${row["Ensembl"]}" target="_blank" class="button">UCSC</a>` +
          `<a href="https://www.genecards.org/cgi-bin/carddisp.pl?gene=${data}" target="_blank" class="button">GeneCards</a><br>` +
          `<font color="#49A942"><b><div class="gene-title" id="gene-title-${row["NCBI Gene"]}"></div></b></font>` +
          `<div class="gene-summary" id="gene-summary-${row["NCBI Gene"]}"></div>` +
          '</div></div>';
      }
      return data;
    };
  }
}

function fetchGeneSummary(geneId) {
    var apiUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gene&id=' + geneId + '&retmode=json';
    var text = document.getElementById('gene-summary-' + geneId).innerText;

    if (text === '') {
      fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            var geneTitle = data.result[geneId]?.description || 'Title unavailable';
            var geneSummary = data.result[geneId]?.summary || 'Summary unavailable';
            document.getElementById('gene-title-' + geneId).innerText = geneTitle;
            document.getElementById('gene-summary-' + geneId).innerText = geneSummary;
        })
        .catch(error => {
            document.getElementById('gene-summary-' + geneId).innerText = '';
        });
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
