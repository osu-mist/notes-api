const _ = require('lodash');
const appRoot = require('app-root-path');
const chai = require('chai');
const chaiExclude = require('chai-exclude');
const fs = require('fs');
const sinon = require('sinon');
const config = require('config');

const testData = require('./test-data');

const fsOps = appRoot.require('/utils/fs-operations');

chai.use(chaiExclude);
const { assert } = chai;
sinon.replace(fsOps, 'validateDBPath', () => null);
const mockConfig = {
  server: {
    protocol: 'https',
    hostname: 'localhost',
  },
  api: {
    dbDirectoryPath: null,
  },
};
sinon.replace(config, 'get', property => mockConfig[property]);
const notesDAO = appRoot.require('/api/v1/db/json/notes-dao');

describe('Test notes-dao', () => {
  describe('Test filterNotes', () => {
    const rawNotes = testData.validNotes;

    it('empty queryParams', () => {
      const queryParams = {};
      const result = notesDAO.filterNotes(rawNotes, queryParams);
      assert.sameDeepMembers(rawNotes, result);
    });
    it('filter using q', () => {
      _.forEach(testData.validQueryParams.q, (it) => {
        const queryParams = { q: it };
        const result = notesDAO.filterNotes(rawNotes, queryParams);
        _.forEach(result, note => assert.include(note.note, queryParams.q));
      });
    });
    it('filter using sources', () => {
      _.forEach(testData.validQueryParams.sources, (it) => {
        const queryParams = { sources: it };
        const result = notesDAO.filterNotes(rawNotes, queryParams);
        _.forEach(result, note => assert.include(queryParams.sources, note.source));
      });
    });
    it('filter using contextTypes', () => {
      _.forEach(testData.validQueryParams.contextTypes, (it) => {
        const queryParams = { contextTypes: it };
        const result = notesDAO.filterNotes(rawNotes, queryParams);
        _.forEach(result, note => assert.include(
          queryParams.contextTypes, note.context.contextType,
        ));
      });
    });
  });
  describe('Test getNotes', () => {
    it('No optional parameters', async () => {
      sinon.replace(fs, 'existsSync', () => true);
      sinon.replace(fs, 'readdirSync', () => ['test.json']);
      sinon.replace(fsOps, 'readJSONFile', () => testData.validNotes[0]);
      const result = await notesDAO.getNotes({ studentID: '111111111' });
      assert.hasAllKeys(result, ['data', 'links']);
      const { hostname, protocol } = config.get('server');
      assert.strictEqual(
        result.links.self,
        `${protocol}://${hostname}/v1/notes?studentID=111111111`,
      );
      assert.deepEqualExcluding(result.data[0].attributes, testData.validNotes[0], ['id']);
    });
  });
});

afterEach(() => sinon.restore());
