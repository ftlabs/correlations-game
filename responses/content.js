const debug = require('debug')('responses:content');
const optionNum = ["one", "two", "three"];

function inputWasNotUnderstood(isRepeating, input = null, options = null, seedPerson = null){
	let phrase, phraseSSML;
	let chips = [];
	console.log('HEARD:', input);
	console.log('EXPECTED:', options);

	if(isRepeating) {
		phrase = `Sorry, I did not understand that. For ${seedPerson.replace('people:', '')}, the possible answers were: `;
		phraseSSML = `Sorry, I did not understand that. Try selecting numbers instead of names. <break time="0.5s" /> For ${seedPerson.replace('people:', '')}, the possible answers were: `;
		for(let i = 0; i < options.length; ++i) {

			if(i === 2) {
				phrase += `or ${options[i].original}?`;
			} else {
				phrase += `${options[i].original}, `;
			}

			chips.push(options[i].original);
			phraseSSML += `<break time="0.5s" />${optionNum[i]}, ${options[i].original}. `;
		}

	} else {
		phrase = `Sorry, I'm not sure what you said. For instructions, use "Help".`;
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

	const illustration = (articleData.mainImageUrl !== null)?articleData.mainImageUrl:process.env.FT_LOGO;

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
	const illustration = (articleData.mainImageUrl !== null)?articleData.mainImageUrl:process.env.FT_LOGO;

	if(parseInt(scoreData.score) >= parseInt(scoreData.scoreMax)) {
		if(scoreData.first) {
			scorePhrase += ' You are the first to achieve this high score today.';
		} else {
			scorePhrase += ' You have matched the current highest score today.';
		}

	} else {
		scorePhrase += ` The record to beat today is ${scoreData.scoreMax}.`;
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

function theGameWasInterrupted(scoreData = 0) {
	let scorePhrase = `You made ${scoreData.score} connection${ (parseInt(scoreData.score)!== 1)?'s':'' } so far.`;

	if(parseInt(scoreData.score) >= parseInt(scoreData.scoreMax)) {
		if(scoreData.first) {
			scorePhrase += ' You are the first to achieve this high score today.';
		} else {
			scorePhrase += ' You have matched the current highest score today.';
		}

	} else {
		scorePhrase += ` The record to beat today was ${scoreData.scoreMax}.`;
	}

	scorePhrase += ` Thank you for playing. Come back to make new connections soon`;

	return {
		displayText : scorePhrase,
		speech : scorePhrase,
		ssml : `<speak>${scorePhrase}</speak>`
	};

}

function askThePlayerAQuestion(data, idx){
	const phrase = `Question ${idx}. ${data.seed.printValue} was mentioned in a recent article with which one of the following people?`;
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

	let phrase = `"Make Connections" is a quiz game that tests your knowledge of people in the news.
	Once you've started a game, a question will be asked like the following.
	Who was recently mentioned in an article with Angela Merkel?
	1) Theresa May. 2) Sadiq Khan. 3) Richard Branson.
	Only one of the options is correct.
	Once the question has been asked, you can answer by either giving the name, or the number that preceded it.
	If you are right, you'll be asked about another person.
	If you are wrong, it's game over - you can use "Start" or "Play" to begin a new game.
	At any point in the game, you can use "Disconnect" or "Stop" to quit playing.
	If you would like to hear the question again, use "Repeat".
	To get these instructions again at any point, use "Help".`;

	let SSMLPhrase = `"Make Connections" is a quiz game that tests your knowledge of people in the news.
	Once you've started a game, a question will be asked like the following.
	Who was recently mentioned in an article with Angela Merkel?
	<break time="0.5s" />
	One, Theresa May.
	<break time="0.5s" />
	Two, Sadiq Khan.
	<break time="0.5s" />
	Three, Richard Branson.
	<break time="0.5s" />
	Only one of the options is correct.
	<break time="0.5s" />
	Once the question has been asked, you can answer by either giving the name, or by the number that preceded it.
	<break time="0.5s" />
	If you are right, you'll be asked about another person.
	If you are wrong, it's game over.
	<break time="0.5s" />
	You can say "Play" or "Start" to begin a new game.
	At any point in the game, you can say "Disconnect" or "Stop" to quit playing.
	<break time="0.5s" />
	If you would like to hear the question again, say "repeat".
	<break time="0.5s" />
	To hear these instructions again at any point,  say "help". `

	if(!gameInProgress){
		phrase += `Would you like to play now?`;
		SSMLPhrase += `<break time="1.5s" />Would you like to play now?`;
	} else {
		phrase += `Would you like to continue your game?`;
		SSMLPhrase += `<break time="0.5s" />Would you like to continue your game?`;
	}

	return {
		displayText : phrase,
		speech : phrase,
		ssml : `<speak>${SSMLPhrase}</speak>`
	};

}

module.exports = {
	misunderstood : inputWasNotUnderstood,
	correctAnswer : theAnswerGivenWasCorrect,
	incorrectAnswer : theAnswerGivenWasNotCorrect,
	askQuestion : askThePlayerAQuestion,
	win : theGameHasBeenWon,
	help : getTheInstructionsForPlayingTheGame,
	stop: theGameWasInterrupted
};
