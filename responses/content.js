const debug = require('debug')('responses:content');

function inputWasNotUnderstood(){

	const phrase = `Sorry, I'm not quite sure what you mean. Say "help" for instructions.`;

	return {
		displayText : phrase,
		speech : phrase,
		ssml : `<speak>${phrase}</speak>`
	};

}

function theAnswerGivenWasCorrect(articleHeadline, newQuestion){

	return {
		displayText : `Correct. They were connected in the FT article: ${articleHeadline}. ${newQuestion}`,
		ssml : `<speak>Correct. They were connected in the FT article: ${articleHeadline}. <break time="1s"/> ${newQuestion}</speak>`
	};

}

function theAnswerGivenWasNotCorrect(expectedAnswer, articleHeadline){

	const phrase = `Sorry, that is incorrect. The correct answer was ${expectedAnswer}. They were connected in the FT article ${articleHeadline}.`

	return {
		displayText : phrase,
		speech : phrase,
		ssml : `<speak>${phrase}</speak>`
	};

}

function askThePlayerAQuestion(personName, possibilities){

	const phrase = `Who was recently mentioned in an article with ${personName}?`;
	let displayText = phrase;
	let ssml = `<speak>${phrase}`;

	Object.keys(possibilities).forEach((key, index) => {
		displayText += (index + 1) + ') ' + possibilities[key].printValue + '. ';
		ssml += '<break time="1s"/>' + (index + 1) + ') ' + possibilities[key].printValue + '. ';
	});

	ssml += '</speak>';

	console.log('DEBUG text', displayText);
	console.log('DEBUG ssml', ssml);

	return {
		displayText: displayText,
		speech : displayText,
		ssml: ssml
	};

}

function theGameHasBeenWon(){

	const phrase = 'winner';

	return {
		displayText : phrase,
		speech : phrase,
		ssml : `<speak>${phrase}</speak>`
	};
}

module.exports = {
	misunderstood : inputWasNotUnderstood,
	correctAnswer : theAnswerGivenWasCorrect,
	incorrectAnswer : theAnswerGivenWasNotCorrect,
	askQuestion : askThePlayerAQuestion,
	win : theGameHasBeenWon
};