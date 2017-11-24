'use strict';

class RequestBuilder {
    constructor(options) {
        this.applicationId = options.applicationId;
        this.sessionId = options.sessionId;
        this.userId = options.userId;
        this.requestId = options.requestId;
        this.locale = options.locale;

        this.requestType = 'LaunchRequest';
    }
    buildRequest() {
        const request = {
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
        return request;
    }
}

module.exports = RequestBuilder;  
