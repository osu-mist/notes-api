const appRoot = require('app-root-path');
const chai = require('chai');
const chaiExclude = require('chai-exclude');
const config = require('config');
const fs = require('fs');
const _ = require('lodash');
const sinon = require('sinon');

const testData = require('./test-data');

chai.use(chaiExclude);
const { assert } = chai;

/**
 * @summary Map a dot-separated string to an object in mock config
 * @param {Object} obj Object that will be accessed when getting property
 * @param {String} arg The dot-separated string of properties
 * @returns {Object} The value of the mock config's specified property
 */
const mockConfigGet = (obj, arg) => {
  const properties = arg.split('.');
  return properties.length === 1
    ? obj[properties[0]]
    : mockConfigGet(obj[properties[0]], properties.slice(1).join('.'));
};

const mockConfig = () => sinon.replace(config, 'get', arg => (
  mockConfigGet(testData.mockConfig, arg)
));

mockConfig();
const fsOps = appRoot.require('api/v1/db/json/fs-operations');
const notesDAO = appRoot.require('api/v1/db/json/notes-dao');
sinon.restore();

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
      sinon.replace(fsOps, 'readJsonFile', () => testData.validNotes[0]);
      const result = await notesDAO.getNotes({ studentId: '111111111' });
      assert.hasAllKeys(result, ['data', 'links']);
      validateLink(result.links.self, '?studentId=111111111');
      assert.deepEqualExcluding(result.data[0].attributes, testData.validNotes[0], ['id']);
    });
  });

  describe('Test getNoteById', () => {
    it('valid ID', async () => {
      sinon.replace(fsOps, 'readJsonFile', () => testData.validNotes[0]);
      const result = await notesDAO.getNoteById('000000000');
      assert.deepEqualExcluding(result.data.attributes, testData.validNotes[0], ['id']);
    });
  });

  describe('Test postNote', () => {
    const testAttributes = testData.validPostBody.data.attributes;
    it('valid object', async () => {
      _.forEach(['writeJsonFile', 'initStudentDir', 'incrementCounter'], (it) => {
        sinon.replace(fsOps, it, () => null);
      });
      sinon.replace(fsOps, 'getCounter', () => '0');
      sinon.replace(
        fsOps, 'readJsonFile', () => Object.assign({ id: '000000000' }, testAttributes),
      );
      const result = await notesDAO.postNote(testData.validPostBody);
      assert.deepEqualExcluding(result.data.attributes, testAttributes, ['source']);
      validateLink(result.links.self, '/000000000');
      validateLink(result.data.links.self, '/000000000');
    });
  });

  describe('Test patchNoteById', () => {
    const testAttributes = testData.validPatchBody.data.attributes;
    it('valid object, valid ID', async () => {
      sinon.replace(fsOps, 'writeJsonFile', () => null);
      sinon.replace(
        fsOps, 'readJsonFile', () => Object.assign({ id: '000000000' }, testAttributes),
      );
      const result = await notesDAO.patchNoteById('000000000', testAttributes);
      _.forEach(['note', 'permissions'], (it) => {
        assert.equal(result.data.attributes[it], testAttributes[it]);
      });
    });
  });

  describe('Test deleteNoteById', () => {
    it('valid ID', async () => {
      sinon.replace(fsOps, 'deleteFile', () => true);
      const result = await notesDAO.deleteNoteById('000000000');
      assert.equal(result, true);
    });
  });
});

beforeEach(() => mockConfig());

afterEach(() => sinon.restore());
