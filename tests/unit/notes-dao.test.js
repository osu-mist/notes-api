const _ = require('lodash');
const appRoot = require('app-root-path');
const { assert } = require('chai');
const testData = require('./test-data');

const notesDAO = appRoot.require('/api/v1/db/json/notes-dao');

describe('Test notes-dao', () => {
  describe('Test filterNotes', () => {
    const rawNotes = testData.validNotes;

    it('empty queryParams', (done) => {
      const queryParams = {};
      const result = notesDAO.filterNotes(rawNotes, queryParams);
      assert.sameDeepMembers(rawNotes, result);
      done();
    });
    it('filter using q', (done) => {
      _.forEach(testData.validQueryParams.q, (it) => {
        const queryParams = { q: it };
        const result = notesDAO.filterNotes(rawNotes, queryParams);
        _.forEach(result, note => assert.include(note.note, queryParams.q));
      });
      done();
    });
    it('filter using sources', (done) => {
      _.forEach(testData.validQueryParams.sources, (it) => {
        const queryParams = { sources: it };
        const result = notesDAO.filterNotes(rawNotes, queryParams);
        _.forEach(result, note => assert.include(queryParams.sources, note.source));
      });
      done();
    });
    it('filter using contextTypes', (done) => {
      _.forEach(testData.validQueryParams.contextTypes, (it) => {
        const queryParams = { contextTypes: it };
        const result = notesDAO.filterNotes(rawNotes, queryParams);
        _.forEach(result, note => assert.include(
          queryParams.contextTypes, note.context.contextType,
        ));
      });
      done();
    });
  });
});
