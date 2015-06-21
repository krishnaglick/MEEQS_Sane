import Ember from 'ember';
import Base from 'simple-auth/authenticators/base';
import config from '../config/environment';

export default Base.extend({
    restore: function(data) {
        return new Ember.RSVP.Promise(function(resolve, reject) {
            if (!Ember.isEmpty(data.token)) {
                Ember.$.ajax({
                    url: config.APP.api_host + '/validate',
                    type: 'POST',
                    data: JSON.stringify({
                        token: data.token
                    }),
                    contentType: 'application/json'
                }).then(function() {
                    resolve(data);
                }, function(err) {
                    reject(err);
                });
            } else {
                reject();
            }
        });
    },
    authenticate: function(credentials) {
        return new Ember.RSVP.Promise(function(resolve, reject) {
            Ember.$.ajax({
                url: config.APP.api_host + '/auth',
                type: 'POST',
                data: JSON.stringify({
                    username: credentials.username,
                    password: credentials.password
                }),
                contentType: 'application/json'
            }).then(function(response) {
                Ember.run(function() {
                    resolve({ token: response.token });
                });
            }, function(xhr, status, error) {
                Ember.run(function() {
                    reject(error);
                });
            });
        });
    },
    invalidate: function(/* data */) {
        return new Ember.RSVP.Promise(function(resolve, reject) {
            Ember.$.ajax({
                url: config.APP.api_host + '/logout',
                type: 'GET'
            }).then(function() {
                Ember.run(function() {
                    resolve();
                });
            }, function(err) {
                Ember.run(function() {
                    reject(err);
                });
            });
        });
    }
});
