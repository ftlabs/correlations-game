const debug = require('debug')('responses:content');

function inputWasNotUnderstood(isRepeating, input = null, options = null){
	let phrase, phraseSSML;
	console.log('HEARD:', input);
	console.log('EXPECTED:', options);

	if(isRepeating) {
		phrase = `Sorry, I did not understand that. The possible answers were: `;
		phraseSSML = `Sorry, I did not understand that. Try selecting numbers instead of names. <break time="0.5s" /> The possible answers were: `;
		for(let i = 0; i < options.length; ++i) {
			phrase += `\n ${(i + 1)}) ${options[i]}. `;
			phraseSSML += `<break time="0.5s" />${(i + 1)}) ${options[i]}. `;
		}

	} else {
		phrase = `Sorry, I'm not sure what you said. For instructions, say "help".`;
		phraseSSML = phrase;
	}

	return {
		displayText : phrase,
		speech : phrase,
		ssml : `<speak>${phraseSSML}</speak>`
	};

}

function theAnswerGivenWasCorrect(articleData, newQuestion){

	return {
		displayText : `Correct. They were connected in the FT article:`,
		speech : `Correct. They were connected in the FT article, titled: ${articleData.title}. \n ${newQuestion.speech}`,
		ssml : `<speak>Correct. They were connected in the FT article, titled: ${articleData.title}. <break time="1s"/> ${newQuestion.ssml.replace('<speak>', '')}`,
		article: articleData.title,
		link: `https://ft.com/${articleData.id}`,
		question: newQuestion.displayText
	};

}

function theAnswerGivenWasNotCorrect(expectedAnswer, articleData){

	const textPhrase  = `Sorry, that is incorrect. The correct answer was ${expectedAnswer.replace('people:', '')}. They were connected in the FT article: ${articleData.title}.`;
	const voicePhrase = `Sorry, that is incorrect. The correct answer was ${expectedAnswer.replace('people:', '')}. They were connected in the FT article, titled: ${articleData.title}.`;

	return {
		displayText : textPhrase,
		speech : voicePhrase,
		ssml : `<speak>${voicePhrase}</speak>`,
		link: `https://ft.com/${articleData.id}`
	};

}

function askThePlayerAQuestion(data){
	const phrase = `Who was mentioned in a recent article with ${data.seed.printValue}?`;
	let displayText = phrase + ' ';
	let ssml = `<speak>${phrase}`;

	Object.keys(data.options).forEach((key, index) => {
		displayText += '\n' + (index + 1) + ') ' + data.options[key].printValue + '. ';
		ssml += '<break time="0.5s"/>' + (index + 1) + ') ' + data.options[key].printValue + '. ';
	});

	ssml += '</speak>';

	return {
		displayText: displayText,
		speech : displayText,
		ssml: ssml
	};

}

function theGameHasBeenWon(){

	const phrase = 'You have reached the end of the chain. There are no more connections to be made.';

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
