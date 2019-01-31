const appRoot = require('app-root-path');
const { assert } = require('chai');

const rows = appRoot.require('tests/unit/test-data.json').validNotes;
const { paginate } = appRoot.require('utils/paginator');

describe('Test paginator', () => {
  it('number of returned results should less then page size', (done) => {
    const page = { size: 10 };
    const { paginatedRows } = paginate(rows, page);
    assert.isAtMost(paginatedRows.length, page.size);
    done();
  });
});
