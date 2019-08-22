import chai from 'chai';
import chaiExclude from 'chai-exclude';
import config from 'config';
import _ from 'lodash';
import proxyquire from 'proxyquire';
import sinon from 'sinon';

import testData from './test-data';

chai.use(chaiExclude);
const { assert } = chai;

/**
 * Map a dot-separated string to an object in mock config
 *
 * @param {object} obj Object that will be accessed when getting property
 * @param {string} arg The dot-separated string of properties
 * @returns {object} The value of the mock config's specified property
 */
const mockConfigGet = (obj, arg) => {
  const properties = arg.split('.');
  return properties.length === 1
    ? obj[properties[0]]
    : mockConfigGet(obj[properties[0]], properties.slice(1).join('.'));
};

const mockConfig = () => sinon.stub(config, 'get').callsFake(arg => (
  mockConfigGet(testData.mockConfig, arg)
));

/**
 * Validate the contents of a link
 *
 * @param {string} link The link to be validated
 * @param {string} path A substring of the expected link occurring after the base path
 */
const validateLink = (link, path) => {
  const { hostname, protocol } = config.get('server');
  assert.strictEqual(link, `${protocol}://${hostname}/v1/notes${path}`);
};

afterEach(() => sinon.restore());

describe('Test notes-dao', () => {
  let configGetStub;
  let notesDAO;

  beforeEach(() => { configGetStub = mockConfig(); });

  const stubNotesDao = (stubs) => {
    notesDAO = proxyquire('api/v1/db/json/notes-dao', {
      config: {
        get: configGetStub,
      },
      ...stubs,
    });
  };

  describe('Test filterNotes', () => {
    const rawNotes = testData.validNotes;

    beforeEach(() => stubNotesDao({}));

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
      const existsSyncStub = sinon.stub().returns(true);
      const readdirSyncStub = sinon.stub().returns(['test.json']);
      const readJsonFileStub = sinon.stub().returns(testData.validNotes[0]);
      const stubs = {
        fs: {
          existsSync: existsSyncStub,
          readdirSync: readdirSyncStub,
        },
        './fs-operations': {
          readJsonFile: readJsonFileStub,
        },
      };
      stubNotesDao(stubs);
      const result = await notesDAO.getNotes({ studentId: '111111111' });
      assert.hasAllKeys(result, ['data', 'links']);
      validateLink(result.links.self, '?studentId=111111111');
      assert.deepEqualExcluding(result.data[0].attributes, testData.validNotes[0], ['id']);
    });
  });

  describe('Test getNoteById', () => {
    it('valid ID', async () => {
      const readJsonFileStub = sinon.stub().returns(testData.validNotes[0]);
      const stubs = {
        './fs-operations': {
          readJsonFile: readJsonFileStub,
        },
      };
      stubNotesDao(stubs);
      const result = await notesDAO.getNoteById('000000000');
      assert.deepEqualExcluding(result.data.attributes, testData.validNotes[0], ['id']);
    });
  });

  describe('Test postNote', () => {
    const testAttributes = testData.validPostBody.data.attributes;
    it('valid object', async () => {
      const stubs = {
        './fs-operations': {
          writeJsonFile: sinon.stub().returns(null),
          initStudentDir: sinon.stub().returns(null),
          incrementCounter: sinon.stub().returns(null),
          getCounter: sinon.stub().returns('0'),
          readJsonFile: sinon.stub().returns({ id: '000000000', ...testAttributes }),
        },
      };
      stubNotesDao(stubs);
      const result = await notesDAO.postNote(testData.validPostBody);
      assert.deepEqualExcluding(result.data.attributes, testAttributes, ['source']);
      validateLink(result.links.self, '/000000000');
      validateLink(result.data.links.self, '/000000000');
    });
  });

  describe('Test patchNoteById', () => {
    const testAttributes = testData.validPatchBody.data.attributes;
    it('valid object, valid ID', async () => {
      const stubs = {
        './fs-operations': {
          writeJsonFile: sinon.stub().returns(null),
          readJsonFile: sinon.stub().returns({ id: '000000000', ...testAttributes }),
        },
      };
      stubNotesDao(stubs);
      const result = await notesDAO.patchNoteById('000000000', testAttributes);
      _.forEach(['note', 'permissions'], (it) => {
        assert.equal(result.data.attributes[it], testAttributes[it]);
      });
    });
  });

  describe('Test deleteNoteById', () => {
    it('valid ID', async () => {
      const stubs = {
        './fs-operations': {
          deleteFile: sinon.stub().returns(true),
        },
      };
      stubNotesDao(stubs);
      const result = await notesDAO.deleteNoteById('000000000');
      assert.equal(result, true);
    });
  });
});
