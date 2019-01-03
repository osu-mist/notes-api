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

/**
 * @summary Validate the contents of a link
 * @function
 * @param {string} link The link to be validated
 * @param {string} path A substring of the expected link occurring after the base path
 */
const validateLink = (link, path) => {
  const { hostname, protocol } = config.get('server');
  assert.strictEqual(link, `${protocol}://${hostname}/v1/notes${path}`);
};

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
    it('no optional parameters', async () => {
      sinon.replace(fs, 'existsSync', () => true);
      sinon.replace(fs, 'readdirSync', () => ['test.json']);
      sinon.replace(fsOps, 'readJSONFile', () => testData.validNotes[0]);
      const result = await notesDAO.getNotes({ studentID: '111111111' });
      assert.hasAllKeys(result, ['data', 'links']);
      validateLink(result.links.self, '?studentID=111111111');
      assert.deepEqualExcluding(result.data[0].attributes, testData.validNotes[0], ['id']);
    });
  });
  describe('Test postNote', () => {
    it('valid object', async () => {
      sinon.replace(fsOps, 'writeJSONFile', () => null);
      sinon.replace(fsOps, 'initStudentDir', () => null);
      sinon.replace(fsOps, 'getCounter', () => '0');
      sinon.replace(fsOps, 'incrementCounter', () => null);
      sinon.replace(
        fsOps,
        'readJSONFile',
        () => Object.assign({ id: '000000000' }, testData.validPostBody),
      );
      const result = await notesDAO.postNote(testData.validPostBody);
      assert.deepEqualExcluding(result.data.attributes, testData.validPostBody, ['source']);
      validateLink(result.links.self, '/000000000');
      validateLink(result.data.links.self, '/000000000');
    });
  });
});

afterEach(() => sinon.restore());