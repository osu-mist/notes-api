const appRoot = require('app-root-path');
const { assert } = require('chai');
const mockData = require('./mock-data');

const notesDAO = appRoot.require('/api/v1/db/json/notes-dao');

describe('Test notes-dao', () => {
  describe('Test filterNotes', () => {
    it('empty queryParams', (done) => {
      const queryParams = {};
      const rawNotes = mockData.validNotes;
      const result = notesDAO.filterNotes(rawNotes, queryParams);
      assert.sameDeepMembers(rawNotes, result);
      done();
    });
  });
});
