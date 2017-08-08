const debug = require('debug')('responses:content');
const optionNum = ["one", "two", "three"];

function inputWasNotUnderstood(isRepeating, input = null, options = null){
	let phrase, displayPhrase, phraseSSML;
	console.log('HEARD:', input);
	console.log('EXPECTED:', options);

	if(isRepeating) {
		phrase = `Sorry, I did not understand that. The possible answers were: `;
		displayPhrase = phrase;
		phraseSSML = `Sorry, I did not understand that. Try selecting numbers instead of names. <break time="0.5s" /> The possible answers were: `;
		for(let i = 0; i < options.length; ++i) {
			phrase += `\n ${optionNum[i]}) ${options[i]}. `;
			displayPhrase += `\n ${(i + 1)}) ${options[i]}. `;
			phraseSSML += `<break time="0.5s" />${optionNum[i]}) ${options[i]}. `;
		}

	} else {
		phrase = `Sorry, I'm not sure what you said. For instructions, say "help".`;
		phraseSSML = phrase;
		displayPhrase = phrase;
	}

	return {
		displayText : displayPhrase,
		speech : phrase,
		ssml : `<speak>${phraseSSML}</speak>`
	};

}

function theAnswerGivenWasCorrect(articleData, newQuestion){

	return {
		displayText : `Correct. They were connected in the FT article:`,
		speech : `Correct. They were connected in the FT article, titled: ${articleData.title}.`,
		ssml : `<speak>Correct. They were connected in the FT article, titled: ${articleData.title}. <break time="1s"/></speak>`,
		article: articleData.title,
		link: `https://ft.com/${articleData.id}`,
		question: newQuestion
	};

}

function theAnswerGivenWasNotCorrect(expectedAnswer, articleData, scoreData){
	const displayPhrase  = `Sorry, that is incorrect. The correct answer was ${expectedAnswer.replace('people:', '')}. They were connected in the FT article:`;
	const voicePhrase = `Sorry, that is incorrect. The correct answer was ${expectedAnswer.replace('people:', '')}. They were connected in the FT article, titled: ${articleData.title}.`;
	let scorePhrase = `You made ${scoreData.score} connections.`;

	if(parseInt(scoreData.score) >= parseInt(scoreData.scoreMax)) {
		scorePhrase += 'Well done, this is the highest score!';
	} else {
		scorePhrase += `The record to beat is ${scoreData.scoreMax}`;
	}

	return {
		displayText : displayPhrase,
		speech : voicePhrase,
		ssml : `<speak>${voicePhrase}</speak>`,
		article: articleData.title,
		link: `https://ft.com/${articleData.id}`,
		score: scorePhrase
	};

}

function askThePlayerAQuestion(data){
	const phrase = `Who was mentioned in a recent article with ${data.seed.printValue}?`;
	let displayText = phrase + ' ';
	let ssml = `<speak>${phrase}`;

	Object.keys(data.options).forEach((key, index) => {
		displayText += `\n ${(index + 1)}) ${data.options[key].printValue}. `;
		ssml += `<break time="0.5s"/> ${optionNum[index]}) ${data.options[key].printValue}. `;
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
