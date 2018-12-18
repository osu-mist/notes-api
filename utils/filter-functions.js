const _ = require('lodash');

const filterNotes = (rawNotes, filterParams, sortKey) => {
  const {
    q, sources, contextTypes,
  } = filterParams;

  rawNotes = contextTypes
    ? _.filter(rawNotes, it => _.includes(contextTypes, it.context.contextType))
    : rawNotes;
  rawNotes = q ? _.filter(rawNotes, it => _.includes(it.note, q)) : rawNotes;
  // sort first by sortKey, and then by lastModified within each sorted group
  rawNotes = _.orderBy(
    rawNotes,
    [
      sortKey === 'contextType' ? it => it.context[sortKey] : it => it[sortKey],
      it => it.lastModified,
    ],
    [sortKey === 'lastModified' ? 'desc' : 'asc', 'desc'],
  );
  _.forEach(rawNotes, (it) => {
    it.source = 'advisorPortal';
  });
  rawNotes = sources ? _.filter(rawNotes, it => _.includes(sources, it.source)) : rawNotes;
  return rawNotes;
};

module.exports = { filterNotes };
