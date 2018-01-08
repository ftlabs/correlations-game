function renderListTemplate(content) {
    let response = {
        "version": "1.0",
        "response": {
            "directives": [
                {
                    "type": "Display.RenderTemplate",
                    "template": {
                        "type": "ListTemplate1",
                        "title": content.listTemplateTitle,
                        "token": content.templateToken,
                        "listItems": content.listItems,
                        "backButton": "HIDDEN"
                    }
                }
            ],
            "outputSpeech": {
                "type": "SSML",
                "ssml": "<speak>" + content.hasDisplaySpeechOutput + "</speak>"
            },
            "reprompt": {
                "outputSpeech": {
                    "type": "SSML",
                    "ssml": "<speak>" + content.hasDisplayRepromptText + "</speak>"
                }
            },
            "card": {
                "type": "Simple",
                "title": content.simpleCardTitle,
                "content": content.simpleCardContent
            }
        },
        "sessionAttributes": content.sessionAttributes

    }
    this.context.succeed(response);    
}


function renderListItems(items) {
    return items.map((x) => {
        return {
            "token": x,
            "textContent": {
                "primaryText":
                    {
                        "text": x,
                        "type": "PlainText"
                    }
            }
        }
    })
}

module.exports = {
    renderListTemplate,
    renderListItems
}