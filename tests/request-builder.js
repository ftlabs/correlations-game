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
    }
    buildRequest(intentName, slots, state) {
        const newRequest = {
            session: {
                attributes: {},
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
        if (state) {
            newRequest.session.attributes.STATE = state;
        }
        return newRequest;
    }
}

module.exports = RequestBuilder;  
