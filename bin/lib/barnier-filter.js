const debug = require('debug')('bin:lib:barner-filter');

const CANDIDATES = {};
const ONTOLOGY = 'people';

// handle people listed with and without the ONTOLOGY prefix.
if (process.env.BARNIER_LIST !== undefined) {
	process.env.BARNIER_LIST.split(',').forEach( b => {
		const bPieces = b.split(':');
		if (bPieces.length > 2) {
			debug(`on startup: skipping b=${b}: too many colons`);
			return;
		}
		if (bPieces.length === 2 && bPieces[0] !== ONTOLOGY) {
			debug(`on startup: skipping b=${b}: does not seem to be in the ${ONTOLOGY} ontology`);
			return;
		}
		const name = bPieces.pop();

		// load up both with and without ontology prefix
		CANDIDATES[name] = true;
		CANDIDATES[`${ONTOLOGY}:${name}`] = true;
	});
}

function filterIndividualsFromGivenList(listOfPeople){
	return listOfPeople.filter(person => {
		return !checkIfIndividualFallsFoulOfFilter(person);
	});
}

function checkIfIndividualFallsFoulOfFilter (person) {
	return CANDIDATES.hasOwnProperty(person);
}

module.exports = {
	filter : filterIndividualsFromGivenList,
	check : checkIfIndividualFallsFoulOfFilter,
	list : function(){
		return Object.keys(CANDIDATES).filter(c => {
			return c.startsWith(ONTOLOGY);
		});
	},
};
