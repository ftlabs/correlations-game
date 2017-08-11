const debug = require('debug')('responses:content');
const optionNum = ["one", "two", "three"];

function inputWasNotUnderstood(isRepeating, input = null, options = null){
	let phrase, phraseSSML;
	let chips = [];
	console.log('HEARD:', input);
	console.log('EXPECTED:', options);

	if(isRepeating) {
		phrase = `Sorry, I did not understand that. The possible answers were: `;
		phraseSSML = `Sorry, I did not understand that. Try selecting numbers instead of names. <break time="0.5s" /> The possible answers were: `;
		for(let i = 0; i < options.length; ++i) {

			if(i === 2) {
				phrase += `or ${options[i].original}?`;
			} else {
				phrase += `${options[i].original}, `;
			}
			
			chips.push(options[i].original);
			phraseSSML += `<break time="0.5s" />${optionNum[i]}) ${options[i].original}. `;
		}

	} else {
		phrase = `Sorry, I'm not sure what you said. For instructions, say "help".`;
		phraseSSML = phrase;
	}

	return {
		displayText : phrase,
		speech : phrase,
		ssml : `<speak>${phraseSSML}</speak>`,
		chips: chips
	};

}

function theAnswerGivenWasCorrect(articleData, newQuestion, people){

	const illustration = (articleData.imageUrl !== undefined)?articleData.imageUrl:process.env.FT_LOGO;

	return {
		displayText : `Correct! ${people.submitted.replace('people:', '')} was mentioned with ${people.seed.replace('people:', '')} in the FT article:`,
		speech : `Correct! ${people.submitted.replace('people:', '')} was mentioned with ${people.seed.replace('people:', '')} in the FT article titled: ${articleData.title}.`,
		ssml : `<speak>Correct! ${people.submitted.replace('people:', '')} was mentioned with ${people.seed.replace('people:', '')} in the FT article titled: ${articleData.title}. <break time="1s"/></speak>`,
		article: articleData.title,
		link: `https://ft.com/${articleData.id}`,
		image: illustration,
		question: newQuestion,
		chips: newQuestion.chips
	};

}

function theAnswerGivenWasNotCorrect(people, articleData, scoreData){
	const displayPhrase = `That was not the correct answer. ${people.expected.replace('people:', '')} was mentioned with ${people.seed.replace('people:', '')} in the FT article titled:`;
	const voicePhrase = `That was not the correct answer. ${people.expected.replace('people:', '')} was mentioned with ${people.seed.replace('people:', '')} in the FT article titled: ${articleData.title}.`;
	let scorePhrase = `You made ${scoreData.score} connection${ (parseInt(scoreData.score)!== 1)?'s':'' }.`;
	const illustration = (articleData.imageUrl !== undefined)?articleData.imageUrl:process.env.FT_LOGO;

	if(parseInt(scoreData.score) >= parseInt(scoreData.scoreMax)) {
		if(scoreData.first) {
			scorePhrase += ' You are the first to achieve this high score.';
		} else {
			scorePhrase += ' You have matched the current highest score.';
		}
		
	} else {
		scorePhrase += ` The record to beat is ${scoreData.scoreMax}.`;
	}

	scorePhrase += ' Would you like to start a new game?'

	return {
		displayText : displayPhrase,
		speech : voicePhrase,
		ssml : `<speak>${voicePhrase}</speak>`,
		article: articleData.title,
		link: `https://ft.com/${articleData.id}`,
		image: illustration,
		score: scorePhrase
	};

}

function askThePlayerAQuestion(data, idx){
	const phrase = `Question ${idx}. ${data.seed.printValue} was mentioned in an article with which one of the following people?`;
	let displayText = phrase + ' ';
	let ssml = `<speak>${phrase}`;
	let chips = [];

	Object.keys(data.options).forEach((key, index) => {
		if(index === 2) {
			displayText += `or ${data.options[key].printValue}?`;
		} else {
			displayText += `${data.options[key].printValue}, `;
		}
		chips.push(data.options[key].printValue);
		ssml += `<break time="0.5s"/> ${optionNum[index]}) ${data.options[key].printValue}. `;
	});

	ssml += '</speak>';

	return {
		displayText: displayText,
		speech : displayText,
		ssml: ssml,
		chips: chips
	};

}

function theGameHasBeenWon(scoreData){

	const phrase = `You have exhausted the current set of connections, achieving ${scoreData.score} consecutive correct answers. Would you like to start a new game?`;

	return {
		displayText : phrase,
		speech : phrase,
		ssml : `<speak>${phrase}</speak>`
	};
}

function getTheInstructionsForPlayingTheGame(gameInProgress){

	let phrase = `"Make Connections" is a quiz game that tests your knowledge of people in the news. Once you've started a game, a question will be asked like the following. Who was recently mentioned in an article with Person A 1. Person B. 2. Person B. 3. Person C. Only one of the options is correct. Once the question has been asked, you can answer by either saying the name, or by saying the number that preceded it. If you are right, you'll be asked about another person. If you are wrong, it's game over - you can say "New Game", "Let's go again", or "Start" to begin a new game. At any point in the game, you can say "Disconnect" or "Stop" to stop playing the game. If you would like to hear the question again, just say "repeat". To hear these instructions at any point in the game, just say "help". `;

	if(!gameInProgress){
		phrase += `To play a game say "Start" or "Play"`;
	} else {
		phrase += `Would you like to continue your game?`;
	}

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
	win : theGameHasBeenWon,
	help : getTheInstructionsForPlayingTheGame
};
