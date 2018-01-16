# FT Labs Correlations Game

## What is it?

This is an API for playing the FT Labs Correlations game.

## How do I play it?

The game is simple. We ask you which of three people (persons B, C, and D) have recently been mentioned in an article with person A. If you know the answer (or guess correctly), the same question will be asked, but with the person from the previous round being used as the seed for the options in this round.

## API

### API Order

To play the game to completion, the consumer of the API must interact with the endpoints (described later in this document) in a certain order. A typical interaction should look like this:

1. **GET** `/interface/start`
2. **GET** `/interface/question/:gameUUID`
3. **GET** `/interface/answer/:gameUUID/:submittedAnswer`

Steps *2.* and *3.* repeat until the game has either been won or lost by the user.

If an incorrect answer is given, the game will be declared as over, and the `/interface/question` endpoint will no longer return new questions for that gameUUID. At this point, the client must call `/interface/start` to begin a new game and get a new gameUUID.

### API Endpoints

_All example responses assume the request has been successfully completed_

#### **GET** `/interface/start`

```json
// Example Response
{
	"status" : "OK",
	"data" : {
		"gameID" : "19bc851b-3632-46df-917d-967605922b23"
	}
}
```

#### **GET** `/interface/question/:gameUUID`

```json
// Example Response
{
	"status" : "ok",
	"data" : {
		"seed" : "people:Xi Jinping",
		"options" : {
			"a" : "people:Christine Lagarde",
			"b" : "people:Donald Trump Jr.",
			"c" : "people:Alexis Tsipras"
		}
	}
}
```

#### **GET** `/interface/answer/:gameUUID/:submittedAnswer`

```json
// Example response (if correct answer is given)
{
	"status" : "ok",
	"correct" : true
}

// Example response (if incorrect answer is given)
{
	"status" : "ok",
	"correct" : false
}
```

## For local dev/testing: index routes

The following env params need to be set:

* CORRELATION_SERVICE_HOST=...
* CORRELATIONS_SERVICE_TOKEN=...

... and if you want to avoid using AWS DynamoDB

* DATABASE=PRETEND
   * NB: always start a new session after restarting the server, since this DB in in-memory only.

The following env params may be set:

* BARNIER_LIST=people:Michel Barnier,people:Nancy Pelosi
* DEBUG=correlations-game:\*,bin:lib:\*

... to explore alternative game mechanics

* MAX_CANDIDATES=10 # to limit the game size (default is -1, meaning no limit)
* FIRST_FEW_MAX=5 # which subset of the most-connected candidates to choose from
* GAME_VARIANT=any_seed # which is the default
   * Other values are:
   * any_seed                # pick any candidate, blacklist candidate
   * any_seed_kill_answer    # pick any candidate, blacklist candidate and answer
   * seed_from_answer        # pick initial any candidate then only from answer, blacklist candidate
   * seed_from_answer_or_any # pick initial any candidate then from answer or any, blacklist candidate
* GAME_DISTANCE_OF_WRONG1=2 # how many chainLengths away to start looking for the first wrong answer - the further away, the 'easier' the question becomes because the wrong answers are 'wronger'
* GAME_DISTANCE_OF_WRONG2=3 # ditto the 2nd wrong answer. Too far is bad because the number of candidates per link drops drastically after 3.
* TEST_MODE # Bypasses verification processes for use with Alexa tester (or other general purpose test tools)

### routes

* GET ```/``` - start a new session
* GET ```/stats``` - view the games stats, system response times, etc
