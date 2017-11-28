'use strict';

function formatSlots(slots) {
    let formattedSlots = {};
    for (let s of slots) {
        formattedSlots[s.name] = {
            name: s.name,
            value: s.value
        }
    }
    return formattedSlots;
}

class RequestBuilder {
    constructor(options) {
        this.applicationId = options.applicationId;
        this.sessionId = options.sessionId;
        this.userId = options.userId;
        this.requestId = options.requestId;
        this.locale = options.locale;

        this.requestType = 'LaunchRequest';
        this.attributes = {};
    }
    updateAttributes(attributes) {
        this.attributes = attributes;
    }
    setSessionId(sessionId) {
        this.sessionId = sessionId;
    }
    buildRequest(intentName, slots, attributes, metaInfo) {
        const newRequest = {
            session: {
                attributes: this.attributes,
                sessionId: this.sessionId,
                application: {
                    applicationId: this.applicationId,
                },
                user: {
                    userId: this.userId,
                },
                new: true
            }, 
            request: {
                type: 'LaunchRequest',
                locale: this.locale,
                requestId: this.requestId,
                timestamp: + new Date()
            }
        }
        if (intentName) {            
            newRequest.request.type = 'IntentRequest';
            newRequest.request.intent = {
                name: intentName
            }
            if (slots) {
                const slotsObject = formatSlots(slots);
                newRequest.request.intent.slots = slotsObject;
            }
        }
        if (attributes) {
            newRequest.session.attributes = attributes;
        }
        if (metaInfo) {
            newRequest.session.sessionId = metaInfo.sessionId;
        }
        return newRequest;
    }
}

module.exports = RequestBuilder;  
